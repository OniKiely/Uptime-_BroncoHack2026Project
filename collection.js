const mainMenuButton = document.getElementById('mainMenuButton');
const gridContainer  = document.getElementById('grid-container');
const statsList      = document.getElementById('stats-list');
const showMoreRow    = document.getElementById('show-more-row');

const INITIAL_SHOW = 6; // 2 rows of 3

mainMenuButton.addEventListener('click', async () => {
  await chrome.action.setPopup({ popup: 'popup.html' });
  window.location.assign('popup.html');
});

const CATEGORY_META = {
  coding:   { emoji: '💻', label: 'Coding' },
  social:   { emoji: '📱', label: 'Social' },
  video:    { emoji: '🎬', label: 'Video' },
  meetings: { emoji: '📹', label: 'Meetings' },
  other:    { emoji: '🌐', label: 'Browsing' },
};

async function init() {
  const { savedRewards = [], timeByCategory = {}, breakCount = 0 } =
    await chrome.storage.local.get(['savedRewards', 'timeByCategory', 'breakCount']);

  // ── Streak reward banner ───────────────────────────────────────────────────
  if (breakCount >= 3) {
    document.getElementById('streak-banner').classList.remove('hidden');
    document.getElementById('streak-banner-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('streak_reward.html') });
      window.close();
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const entries = Object.entries(timeByCategory).filter(([, mins]) => mins > 0);
  if (entries.length === 0) {
    statsList.innerHTML = '<span class="stats-empty">No sessions recorded yet today.</span>';
  } else {
    entries.sort((a, b) => b[1] - a[1]);
    for (const [cat, mins] of entries) {
      const meta = CATEGORY_META[cat] || { emoji: '🌐', label: cat };
      const pill = document.createElement('div');
      pill.className = 'stats-pill';
      pill.innerHTML = `<span>${meta.emoji} ${meta.label}</span><strong>${formatMins(mins)}</strong>`;
      statsList.appendChild(pill);
    }
  }

  // ── Rewards ────────────────────────────────────────────────────────────────
  if (savedRewards.length === 0) {
    gridContainer.innerHTML = '<p class="empty-msg">Complete a break to earn your first reward! 🎁</p>';
    return;
  }

  const visible  = savedRewards.slice(0, INITIAL_SHOW);
  const hidden   = savedRewards.slice(INITIAL_SHOW);

  visible.forEach(r => addItem(r.headline, r.emoji, r.type));

  if (hidden.length > 0) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.textContent = `Show ${hidden.length} more`;
    showMoreRow.appendChild(btn);

    btn.addEventListener('click', () => {
      hidden.forEach(r => addItem(r.headline, r.emoji, r.type));
      showMoreRow.remove();
    });
  }
}

function addItem(headline, emoji, type) {
  const item = document.createElement('div');
  item.className = 'item';

  const emojiEl = document.createElement('span');
  emojiEl.className = 'emoji';
  emojiEl.textContent = emoji;

  const headlineEl = document.createElement('span');
  headlineEl.className = 'headline';
  headlineEl.textContent = headline;

  const typeEl = document.createElement('span');
  typeEl.className = 'type';
  typeEl.textContent = type.replace('_', ' ');

  item.append(emojiEl, headlineEl, typeEl);
  gridContainer.appendChild(item);
}

function formatMins(totalMins) {
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

init();
