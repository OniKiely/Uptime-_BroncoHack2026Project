// background.js — service worker: manages sitting timer, alarms, idle detection

const DEFAULT_THRESHOLD = 45; // minutes before break alert
const IDLE_THRESHOLD_SECONDS = 300; // 5 min of no input = idle

// ── State helpers ─────────────────────────────────────────────────────────────

// Single entry point for reading all persisted state
async function getState() {
  const defaults = {
    sessionStart: Date.now(),
    totalSittingToday: 0,
    breakCount: 0,
    lastBreakTime: null,
    streak: 0,
    sittingThreshold: DEFAULT_THRESHOLD,
    lastReward: null,
    isIdle: false,
    siteCategory: 'other',
    lastTabSwitchTime: 0,
    recentTabSwitches: 0,
    lastMidnightReset: new Date().toDateString(),
    demoMode: false,
    timeByCategory: {},
  };
  const stored = await chrome.storage.local.get(null);
  return { ...defaults, ...stored };
}

// Single entry point for writing state — pass only the keys you want to update
async function setState(updates) {
  await chrome.storage.local.set(updates);
}

// ── Initialization ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await setState({
    sessionStart: Date.now(),
    totalSittingToday: 0,
    breakCount: 0,
    lastBreakTime: null,
    streak: 0,
    sittingThreshold: DEFAULT_THRESHOLD,
    lastReward: null,
    isIdle: false,
    siteCategory: 'other',
    lastTabSwitchTime: 0,
    recentTabSwitches: 0,
    lastMidnightReset: new Date().toDateString(),
    demoMode: false,
    snoozeUsed: false,
    timeByCategory: {},
  });
  scheduleBreakAlarm();
  scheduleMidnightReset();
  scheduleTickAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  await checkMidnightReset(state);
  scheduleBreakAlarm();
  scheduleTickAlarm();
  await updateBadge();
});

// ── Alarm scheduling ──────────────────────────────────────────────────────────

// Schedule the next break alarm based on current threshold / demo mode
function scheduleBreakAlarm() {
  chrome.alarms.clear('break');
  chrome.storage.local.get(['sittingThreshold', 'demoMode'], (data) => {
    const demo = data.demoMode || false;
    const threshold = demo ? 2 : (data.sittingThreshold || DEFAULT_THRESHOLD);
    chrome.alarms.create('break', { delayInMinutes: threshold });
    updateBadge();
  });
}

// Schedule an alarm to fire just after midnight for daily stat reset
function scheduleMidnightReset() {
  chrome.alarms.clear('midnight');
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const minutesUntilMidnight = (midnight - now) / 60000;
  chrome.alarms.create('midnight', { delayInMinutes: minutesUntilMidnight });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'break') {
    await handleBreakAlarm();
  } else if (alarm.name === 'tick') {
    await updateBadge();
    await trackCategoryTime();
  } else if (alarm.name === 'midnight') {
    const state = await getState();
    await checkMidnightReset(state);
    scheduleMidnightReset();
  }
});

// ── Break alarm handler ───────────────────────────────────────────────────────

async function handleBreakAlarm(forced = false) {
  // Query actual idle state directly — don't trust stored value (service worker can be killed)
  const idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  if (idleState !== 'active') {
    scheduleBreakAlarm();
    return;
  }

  const state = await getState();

  if (!forced) {
    // Never interrupt during meetings — check again in 5 min
    if (state.siteCategory === 'meetings') {
      chrome.alarms.create('break', { delayInMinutes: 5 });
      return;
    }

    // Skip if user is rapidly switching tabs (in flow) — check again in 5 min
    const timeSinceLastSwitch = Date.now() - (state.lastTabSwitchTime || 0);
    if (state.recentTabSwitches >= 3 && timeSinceLastSwitch < 60000) {
      chrome.alarms.create('break', { delayInMinutes: 5 });
      return;
    }
  }

  // Don't open a second reward tab if one is already on screen
  const existing = await chrome.tabs.query({ url: chrome.runtime.getURL('reward.html') });
  if (existing.length > 0) return;

  // Add current session minutes to today's total before opening break screen
  const sessionMinutes = Math.round((Date.now() - state.sessionStart) / 60000);
  await setState({
    totalSittingToday: (state.totalSittingToday || 0) + sessionMinutes,
    recentTabSwitches: 0,
    breakInProgress: true,
  });

  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('reward.html') });
  await setState({ rewardTabId: tab.id });
}

// Add 1 minute to today's tally for the current site category
async function trackCategoryTime() {
  const state = await getState();
  if (!state.siteCategory) return;
  const timeByCategory = state.timeByCategory || {};
  timeByCategory[state.siteCategory] = (timeByCategory[state.siteCategory] || 0) + 1;
  await setState({ timeByCategory });
}

// ── Idle detection ────────────────────────────────────────────────────────────

chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);

chrome.idle.onStateChanged.addListener(async (newState) => {
  const isIdle = newState === 'idle' || newState === 'locked';
  await setState({ isIdle });

  if (!isIdle) {
    // User is back — restart session clock
    await setState({ sessionStart: Date.now() });
    // Only reschedule if the alarm was cleared while idle (don't stack alarms)
    const existing = await chrome.alarms.get('break');
    if (!existing) scheduleBreakAlarm();
  }
});

// ── Reward tab close detection ────────────────────────────────────────────────

// If user closes the reward tab before completing the break, remind them again in 5 min
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (!state.breakInProgress || state.rewardTabId !== tabId) return;

  // Tab was closed early — clear the flag and reschedule a nudge
  await setState({ breakInProgress: false, rewardTabId: null });
  chrome.alarms.create('break', { delayInMinutes: 5 });
  await updateBadge();

  const earlyCloseMessages = {
    coding:   'Still coding? 💻 Timer reset for 5 min — your wrists need a break!',
    social:   'Back to the scroll? 😅 We reset for 5 min. Go stand up!',
    video:    'Still watching? 🍿 Timer reset for 5 min — your eyes need a break.',
    meetings: 'Back to the call? 😢 We reset for 5 min. Stretch when you can!',
    other:    'Tab closed early 😢 Timer reset for 5 min. Remember to stand up!',
  };
  const nudgeMsg = earlyCloseMessages[state.siteCategory] || earlyCloseMessages.other;

  await chrome.notifications.create('break-skipped', {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Uptime! — We saw that 👀',
    message: nudgeMsg,
    priority: 2,
  });
});

// ── Tab switch tracking (rapid switching = user is in flow, don't interrupt) ──

chrome.tabs.onActivated.addListener(async () => {
  const state = await getState();
  const now = Date.now();
  const timeSinceLast = now - (state.lastTabSwitchTime || 0);
  const recentCount = timeSinceLast < 30000 ? (state.recentTabSwitches || 0) + 1 : 1;
  await setState({ lastTabSwitchTime: now, recentTabSwitches: recentCount });
});

// ── Message bus ───────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'SITE_CATEGORY':
      await setState({ siteCategory: message.category });
      return { ok: true };

    case 'SNOOZE':
      // Delay next break by 15 minutes — only allowed once per session
      chrome.alarms.clear('break');
      chrome.alarms.create('break', { delayInMinutes: 15 });
      await setState({ snoozeUsed: true });
      await updateBadge();
      return { ok: true };

    case 'BREAK_NOW':
      await handleBreakAlarm(true);
      return { ok: true };

    case 'BREAK_COMPLETED':
      await onBreakCompleted();
      return { ok: true };

    case 'GET_STATE': {
      const state = await getState();
      const alarm = await chrome.alarms.get('break');
      const minutesUntilBreak = alarm
        ? Math.max(0, Math.round((alarm.scheduledTime - Date.now()) / 60000))
        : null;
      const currentSessionMinutes = Math.round((Date.now() - state.sessionStart) / 60000);
      return { ...state, minutesUntilBreak, currentSessionMinutes };
    }

    case 'SET_DEMO_MODE':
      await setState({ demoMode: message.enabled });
      scheduleBreakAlarm();
      return { ok: true };

    default:
      return { ok: false, error: 'Unknown message type' };
  }
}

// ── Break completion ──────────────────────────────────────────────────────────

async function onBreakCompleted() {
  const state = await getState();
  const newBreakCount = (state.breakCount || 0) + 1;

  // Update streak: did the user break yesterday? today already?
  let newStreak = state.streak || 0;
  if (state.lastBreakTime) {
    const lastDate = new Date(state.lastBreakTime).toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastDate === yesterday && newBreakCount === 1) {
      newStreak += 1; // new day, continuing streak
    } else if (lastDate !== new Date().toDateString() && lastDate !== yesterday) {
      newStreak = 1; // streak broken — reset
    }
  } else {
    newStreak = 1; // very first break ever
  }

  await setState({
    breakCount: newBreakCount,
    lastBreakTime: Date.now(),
    sessionStart: Date.now(), // reset sitting clock after break
    streak: newStreak,
    snoozeUsed: false,        // fresh snooze available next session
    breakInProgress: false,
    rewardTabId: null,
  });

  scheduleBreakAlarm();
  await updateBadge();
}

// ── Badge & notification ──────────────────────────────────────────────────────

// Tick every minute to keep the icon badge up to date
function scheduleTickAlarm() {
  chrome.alarms.clear('tick');
  chrome.alarms.create('tick', { periodInMinutes: 1 });
}

// Update the icon badge with minutes until next break
async function updateBadge() {
  const alarm = await chrome.alarms.get('break');
  if (!alarm) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const minsLeft = Math.max(0, Math.round((alarm.scheduledTime - Date.now()) / 60000));

  // Hide badge when plenty of time left — let the icon breathe
  if (minsLeft > 10) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  // Single character only so it barely clips the corner
  const label = minsLeft === 0 ? '!' : `${minsLeft}`;
  chrome.action.setBadgeText({ text: label });

  // Color shifts green → orange → red as break approaches
  if (minsLeft <= 0) {
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }); // red: overdue
  } else if (minsLeft <= 5) {
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // orange: soon
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#1D9E75' }); // green: all good
  }

  // Send a heads-up notification when 5 minutes remain
  if (minsLeft === 5) {
    chrome.notifications.create('break-warning', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Uptime! — Break in 5 minutes 🧍',
      message: 'Finish your thought. A fun fact is waiting for you.',
      priority: 1,
    });
  }
}

// ── Midnight daily reset ──────────────────────────────────────────────────────

async function checkMidnightReset(state) {
  const today = new Date().toDateString();
  if (state.lastMidnightReset !== today) {
    await setState({
      totalSittingToday: 0,
      breakCount: 0,
      sessionStart: Date.now(),
      lastMidnightReset: today,
      timeByCategory: {},
    });
  }
}
