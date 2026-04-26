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
  });
  scheduleBreakAlarm();
  scheduleMidnightReset();
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  await checkMidnightReset(state);
  scheduleBreakAlarm();
});

// ── Alarm scheduling ──────────────────────────────────────────────────────────

// Schedule the next break alarm based on current threshold / demo mode
function scheduleBreakAlarm() {
  chrome.alarms.clear('break');
  chrome.storage.local.get(['sittingThreshold', 'demoMode'], (data) => {
    const demo = data.demoMode || false;
    const threshold = demo ? 2 : (data.sittingThreshold || DEFAULT_THRESHOLD);
    chrome.alarms.create('break', { delayInMinutes: threshold });
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
  } else if (alarm.name === 'midnight') {
    const state = await getState();
    await checkMidnightReset(state);
    scheduleMidnightReset();
  }
});

// ── Break alarm handler ───────────────────────────────────────────────────────

async function handleBreakAlarm() {
  const state = await getState();

  // Skip if user is already idle — no point interrupting
  if (state.isIdle) {
    scheduleBreakAlarm();
    return;
  }

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

  // Add current session minutes to today's total before opening break screen
  const sessionMinutes = Math.round((Date.now() - state.sessionStart) / 60000);
  await setState({
    totalSittingToday: (state.totalSittingToday || 0) + sessionMinutes,
    recentTabSwitches: 0,
  });

  chrome.tabs.create({ url: chrome.runtime.getURL('reward.html') });
}

// ── Idle detection ────────────────────────────────────────────────────────────

chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);

chrome.idle.onStateChanged.addListener(async (newState) => {
  const isIdle = newState === 'idle' || newState === 'locked';
  await setState({ isIdle });

  if (!isIdle) {
    // User is back — restart session clock and reschedule break alarm
    await setState({ sessionStart: Date.now() });
    scheduleBreakAlarm();
  }
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
      // Delay next break by 15 minutes from now
      chrome.alarms.clear('break');
      chrome.alarms.create('break', { delayInMinutes: 15 });
      return { ok: true };

    case 'BREAK_NOW':
      await handleBreakAlarm();
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
  });

  scheduleBreakAlarm();
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
    });
  }
}
