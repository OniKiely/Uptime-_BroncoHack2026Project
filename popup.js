// popup.js — live timer, stats display, snooze/break buttons, demo mode

let pollInterval = null;
let logoClickCount = 0;
let logoClickTimer = null;

// ── Entry point ───────────────────────────────────────────────────────────────

async function init() {
  await refresh();
  pollInterval = setInterval(refresh, 1000);

  document.getElementById('snooze-btn').addEventListener('click', onSnooze);
  document.getElementById('break-btn').addEventListener('click', onBreakNow);
  document.getElementById('logo').addEventListener('click', onLogoClick);
  document.getElementById('collection-btn').addEventListener('click', openCollection);
}

// ── State refresh (called every second) ──────────────────────────────────────

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (!state) return;

  updateTimer(state);
  updateProgress(state);
  updateStats(state);
  updateStreak(state);
  updateDemoBadge(state);
  updateSnoozeButton(state.snoozeUsed || false);
}

// ── Timer display ─────────────────────────────────────────────────────────────

function updateTimer(state) {
  const mins = state.currentSessionMinutes || 0;
  document.getElementById('timer-display').textContent = formatMins(mins);
  document.getElementById('quip').textContent = getQuip(mins, state.minutesUntilBreak, state.breakCount);

  // Show when the current session started (e.g. "Started at 2:34 PM")
  if (state.sessionStart) {
    const t = new Date(state.sessionStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    document.getElementById('session-start').textContent = `Started at ${t}`;
  }

  // Tint the otter based on how long they've been sitting
  const icon = document.getElementById('logo-icon');
  icon.classList.toggle('warn',   mins >= 30 && mins < 60);
  icon.classList.toggle('danger', mins >= 60);
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function updateProgress(state) {
  const threshold = state.demoMode ? 2 : (state.sittingThreshold || 45);
  const elapsed = state.currentSessionMinutes || 0;
  const pct = Math.min(100, Math.round((elapsed / threshold) * 100));

  const fill = document.getElementById('progress-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('warn', pct >= 80);

  const eta = state.minutesUntilBreak;
  let etaText;
  if (state.breakInProgress)  etaText = 'stand up! 🎁';
  else if (eta == null)       etaText = '—';
  else if (eta === 0)         etaText = 'now!';
  else                        etaText = `in ${eta}m`;
  document.getElementById('break-countdown').textContent = etaText;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function updateStats(state) {
  document.getElementById('break-count').textContent = state.breakCount || 0;
  document.getElementById('total-sitting').textContent =
    formatMins((state.totalSittingToday || 0) + (state.currentSessionMinutes || 0));
}

// ── Streak ────────────────────────────────────────────────────────────────────

function updateStreak(state) {
  const s = state.streak || 0;
  const text = s >= 1
    ? `${s}-day streak! Your future self is grateful.`
    : 'Complete 3 breaks today to start a streak!';
  document.getElementById('streak-text').textContent = text;
}

// ── Demo mode badge ───────────────────────────────────────────────────────────

function updateDemoBadge(state) {
  document.getElementById('demo-badge').classList.toggle('hidden', !state.demoMode);
}

// ── Cheeky copy ───────────────────────────────────────────────────────────────

function getQuip(mins, minsUntilBreak, breakCount) {
  if (mins === 0) return "Timer is running — we've got your back. 👍";
  if (mins < 5)  return "Just getting started. Your spine approves. 👍";
  if (mins < 20) return `${mins}m in. Still in the green. Carry on.`;
  if (mins < 35) return `${mins}m sitting. Your lumbar is watching you.`;
  if (mins < 50) return `${mins}m? A blobfish is waiting for you. 🐡`;
  if (mins < 65) return `${mins} minutes of sitting. Your future self is filing a complaint.`;
  return `${mins} minutes. Your lumbar disc is giving you looks. 😤`;
}

// ── Buttons ───────────────────────────────────────────────────────────────────

async function onSnooze() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (state.snoozeUsed) return; // guard against double-click
  await chrome.runtime.sendMessage({ type: 'SNOOZE' });
  updateSnoozeButton(true);
}

// Reflect snooze state on the button — called every refresh cycle
function updateSnoozeButton(used) {
  const btn = document.getElementById('snooze-btn');
  btn.disabled = used;
  btn.textContent = used ? 'You need this break 😅' : 'Snooze 15m';
  btn.classList.toggle('btn-disabled', used);
}

async function onBreakNow() {
  await chrome.runtime.sendMessage({ type: 'BREAK_NOW' });
  window.close();
}

async function openCollection() {
  await chrome.action.setPopup({popup: "collection.html"});
  window.location.assign('collection.html');
}


// ── Demo mode: click logo 3x within 2 seconds ─────────────────────────────────

async function onLogoClick() {
  logoClickCount += 1;
  clearTimeout(logoClickTimer);

  if (logoClickCount >= 3) {
    logoClickCount = 0;
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    const next = !state.demoMode;
    await chrome.runtime.sendMessage({ type: 'SET_DEMO_MODE', enabled: next });
    await refresh();
    flashLogo();
    return;
  }

  logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 2000);
}

function flashLogo() {
  const icon = document.getElementById('logo-icon');
  icon.style.transform = 'scale(1.4)';
  setTimeout(() => { icon.style.transform = ''; }, 300);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMins(totalMins) {
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Start ─────────────────────────────────────────────────────────────────────

init();
