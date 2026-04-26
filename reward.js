// reward.js — countdown timer, reward reveal, and break completion

import { generateReward } from './api.js';

const COUNTDOWN_SECONDS = 30;
const CIRCUMFERENCE = 327; // 2 * π * 52 ≈ 326.7, matches SVG r=52

let rewardData = null;
let tickInterval = null;
let breakCompleted = false;


// ── Entry point ───────────────────────────────────────────────────────────────

async function init() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

  // Kick off API call immediately so reward is ready when countdown ends
  const rewardPromise = generateReward(
    state.siteCategory || 'other',
    (state.breakCount || 0) + 1
  );

  startCountdown(rewardPromise);
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function startCountdown(rewardPromise) {
  let secondsLeft = COUNTDOWN_SECONDS;
  const numberEl = document.getElementById('countdown-number');
  const circleEl = document.getElementById('countdown-circle');
  const pauseMsg  = document.getElementById('pause-msg');

  updateRing(circleEl, numberEl, secondsLeft);

  tickInterval = setInterval(async () => {
    secondsLeft -= 1;
    updateRing(circleEl, numberEl, secondsLeft);

    if (secondsLeft <= 0) {
      clearInterval(tickInterval);
      rewardData = await rewardPromise;
      revealReward(rewardData);
    }
  }, 1000);

  // Added once — pause countdown when user switches away, resume on return
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(tickInterval);
      tickInterval = null;
      document.title = '⏸ Timer paused — Uptime!';
    } else {
      document.title = 'Uptime! — Break Time';

      if (!breakCompleted && secondsLeft > 0) {
        // Show the message when user returns so they actually see it
        pauseMsg.classList.remove('hidden');
        setTimeout(() => pauseMsg.classList.add('hidden'), 2500);

        tickInterval = setInterval(async () => {
          secondsLeft -= 1;
          updateRing(circleEl, numberEl, secondsLeft);

          if (secondsLeft <= 0) {
            clearInterval(tickInterval);
            rewardData = await rewardPromise;
            revealReward(rewardData);
          }
        }, 1000);
      }
    }
  });
}

// Update the SVG ring and number display
function updateRing(circleEl, numberEl, secondsLeft) {
  const progress = secondsLeft / COUNTDOWN_SECONDS; // 1 → full ring, 0 → empty
  circleEl.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  numberEl.textContent = secondsLeft;
}

// ── Reveal ────────────────────────────────────────────────────────────────────

function revealReward(reward) {
  breakCompleted = true;

  // Tell background.js the break is done (updates streak, breakCount, session)
  chrome.runtime.sendMessage({ type: 'BREAK_COMPLETED' });

  // Save to collection (cap at 50 entries)
  chrome.storage.local.get(['savedRewards'], ({ savedRewards = [] }) => {
    const updated = [{ ...reward, earnedAt: Date.now() }, ...savedRewards].slice(0, 50);
    chrome.storage.local.set({ savedRewards: updated });
  });

  // Populate card content
  document.getElementById('reward-type').textContent = reward.type.replace('_', ' ');
  document.getElementById('reward-emoji').textContent = reward.emoji;
  document.getElementById('reward-headline').textContent = reward.headline;
  document.getElementById('reward-content').textContent = reward.content;

  // Hide "Learn more" for fictional content — there's nothing real to search for
  const learnMore = document.getElementById('learn-more');
  if (reward.type === 'FAKE_STUDY') {
    learnMore.style.display = 'none';
  } else {
    const query = encodeURIComponent(reward.headline + ' fact');
    learnMore.href = `https://www.google.com/search?q=${query}`;
  }

  // Swap screens
  document.getElementById('waiting-screen').classList.add('hidden');
  document.getElementById('reveal-screen').classList.remove('hidden');

  // Apply themed background + spawn particles
  spawnParticles(reward.emoji, reward.type);

  // Small delay so the card is in the DOM before we trigger the flip
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('reward-card').classList.add('flipped');
    });
  });
}

// ── Particles ─────────────────────────────────────────────────────────────────

function spawnParticles(emoji, type) {
  // Shift background to the reward's theme
  document.body.className = `theme-${type}`;

  const COUNT = 18;

  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    p.textContent = emoji;
    p.style.left            = `${Math.random() * 100}vw`;
    p.style.fontSize        = `${1.2 + Math.random() * 2}rem`;
    p.style.animationDuration  = `${5 + Math.random() * 5}s`;
    p.style.animationDelay     = `${Math.random() * 4}s`;
    // Slight horizontal drift via a random horizontal offset animation
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

// ── Buttons ───────────────────────────────────────────────────────────────────

document.getElementById('share-btn').addEventListener('click', () => {
  if (!rewardData) return;
  const text = `${rewardData.emoji} ${rewardData.headline}\n${rewardData.content}\n\n— via Uptime! break reward`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('share-btn');
    btn.textContent = 'Copied! ✓';
    setTimeout(() => { btn.textContent = 'Share this fact'; }, 2000);
  });
});

document.getElementById('back-btn').addEventListener('click', () => {
  window.close();
});

// ── Guard: no reward if tab is closed before countdown ends ───────────────────

window.addEventListener('beforeunload', () => {
  if (!breakCompleted) clearInterval(tickInterval);
  // BREAK_COMPLETED is intentionally NOT sent here — no reward for quitting early
});

// ── Start ─────────────────────────────────────────────────────────────────────

init();
