// streak_reward.js — image selection, stats display, caption generation

import { generateStreakCaption } from './api.js';

const TOTAL_IMAGES = 15;

// ── Entry point ───────────────────────────────────────────────────────────────

async function init() {
  const state = await chrome.storage.local.get([
    'streak', 'totalSittingToday', 'breakCount', 'usedStreakImages',
  ]);

  const streak           = state.streak           || 1;
  const totalSittingToday = state.totalSittingToday || 0;
  const breakCount       = state.breakCount        || 3;
  const usedStreakImages = state.usedStreakImages   || [];

  // ── Header ──────────────────────────────────────────────────────────────────
  document.getElementById('streak-label').textContent = `Day ${streak} streak`;

  // ── Stats ───────────────────────────────────────────────────────────────────
  document.getElementById('stat-sat').textContent    = formatMins(totalSittingToday);
  document.getElementById('stat-breaks').textContent = breakCount;
  document.getElementById('stat-streak').textContent = streak;

  // ── Artwork ─────────────────────────────────────────────────────────────────
  // Reuse today's image if the page is opened more than once (e.g. via collection)
  // so we don't burn through the pool on repeat visits in the same day.
  const today = new Date().toDateString();
  const { lastStreakRewardDate, currentStreakImage } =
    await chrome.storage.local.get(['lastStreakRewardDate', 'currentStreakImage']);

  let imgIndex;
  if (lastStreakRewardDate === today && currentStreakImage) {
    imgIndex = currentStreakImage;
  } else {
    imgIndex = selectStreakImage(usedStreakImages);
    await chrome.storage.local.set({ lastStreakRewardDate: today, currentStreakImage: imgIndex });
  }

  const imgSrc = chrome.runtime.getURL(`streak_reward/${imgIndex}.PNG`);
  document.getElementById('mascot-img').src = imgSrc;

  // ── Buttons ─────────────────────────────────────────────────────────────────
  document.getElementById('download-btn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href     = imgSrc;
    a.download = `uptime-streak-day${streak}.png`;
    a.click();
  });

  document.getElementById('close-btn').addEventListener('click', () => window.close());

  // ── Caption (async — show loading state first) ───────────────────────────────
  const captionEl = document.getElementById('caption-text');
  const copyBtn   = document.getElementById('copy-btn');

  const caption = await generateStreakCaption({ streak, totalSittingToday, breakCount });
  captionEl.textContent = caption;
  captionEl.classList.remove('loading');

  copyBtn.disabled = false;
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(caption).then(() => {
      copyBtn.textContent = 'Copied! ✓';
      setTimeout(() => { copyBtn.textContent = 'Copy caption'; }, 2000);
    });
  });
}

// ── Image selection (same pool pattern as topic pool) ─────────────────────────

function selectStreakImage(usedStreakImages) {
  const all = Array.from({ length: TOTAL_IMAGES }, (_, i) => i + 1);
  let available = all.filter(i => !usedStreakImages.includes(i));
  let currentUsed = usedStreakImages;

  // Full set seen — reset and start a new cycle
  if (available.length === 0) {
    available   = all;
    currentUsed = [];
  }

  const selected = available[Math.floor(Math.random() * available.length)];
  chrome.storage.local.set({ usedStreakImages: [...currentUsed, selected] });
  return selected;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMins(totalMins) {
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

init();
