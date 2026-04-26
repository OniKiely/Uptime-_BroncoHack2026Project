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
}

// ── Timer display ─────────────────────────────────────────────────────────────

function updateTimer(state) {
  const mins = state.currentSessionMinutes || 0;
  document.getElementById('timer-display').textContent = formatMins(mins);
  document.getElementById('quip').textContent = getQuip(mins, state.minutesUntilBreak, state.breakCount);

  // Swap logo icon based on how long they've been sitting
  const icon = document.getElementById('logo-icon');
  if (mins >= 60)      icon.textContent = '😩';
  else if (mins >= 30) icon.textContent = '😐';
  else                 icon.textContent = '🧍';
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
  document.getElementById('break-countdown').textContent =
    eta != null ? `in ${eta}m` : '—';
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
  if (mins < 5)  return "Just getting started. Your spine approves. 👍";
  if (mins < 20) return `${mins}m in. Still in the green. Carry on.`;
  if (mins < 35) return `${mins}m sitting. Your lumbar is watching you.`;
  if (mins < 50) return `${mins}m? A blobfish is waiting for you. 🐡`;
  if (mins < 65) return `${mins} minutes of sitting. Your future self is filing a complaint.`;
  return `${mins} minutes. Your lumbar disc is giving you looks. 😤`;
}

// ── Buttons ───────────────────────────────────────────────────────────────────

async function onSnooze() {
  await chrome.runtime.sendMessage({ type: 'SNOOZE' });
  const btn = document.getElementById('snooze-btn');
  btn.textContent = 'Snoozed ✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = '+15 min'; btn.disabled = false; }, 3000);
}

async function onBreakNow() {
  await chrome.runtime.sendMessage({ type: 'BREAK_NOW' });
  window.close();
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
    flashLogo(next);
    return;
  }

  logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 2000);
}

function flashLogo(demoOn) {
  const icon = document.getElementById('logo-icon');
  icon.textContent = demoOn ? '⚡' : '🧍';
  setTimeout(() => { icon.textContent = demoOn ? '⚡' : '🧍'; }, 800);
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
