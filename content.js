// content.js — runs on every page: detects site category and typing pauses

const TYPING_PAUSE_MS = 30000; // 30 seconds of no keystrokes = good interrupt moment

// ── Site category detection ───────────────────────────────────────────────────

const SITE_RULES = [
  {
    category: 'meetings',
    hosts: ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'whereby.com', 'webex.com'],
  },
  {
    category: 'coding',
    hosts: ['github.com', 'stackoverflow.com', 'codepen.io', 'replit.com', 'codesandbox.io'],
    hostSuffixes: ['.dev', 'localhost'],
  },
  {
    category: 'video',
    hosts: ['youtube.com', 'www.youtube.com', 'netflix.com', 'twitch.tv', 'vimeo.com'],
  },
  {
    category: 'reading',
    hosts: [
      'docs.google.com', 'notion.so', 'medium.com', 'substack.com',
      'wikipedia.org', 'dev.to', 'hashnode.com',
    ],
  },
];

// Classify the current page's hostname into a category
function detectCategory() {
  const host = location.hostname;

  for (const rule of SITE_RULES) {
    if (rule.hosts && rule.hosts.some((h) => host === h || host.endsWith('.' + h))) {
      return rule.category;
    }
    if (rule.hostSuffixes && rule.hostSuffixes.some((s) => host.endsWith(s) || host === s.replace(/^\./, ''))) {
      return rule.category;
    }
  }

  return 'other';
}

// Send the detected category to background.js
function reportCategory() {
  const category = detectCategory();
  chrome.runtime.sendMessage({ type: 'SITE_CATEGORY', category }).catch(() => {
    // Service worker may be inactive — safe to ignore
  });
}

// Report once on load, then again if the URL changes (SPAs)
reportCategory();

let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    reportCategory();
  }
});
urlObserver.observe(document.body, { childList: true, subtree: true });

// ── Typing pause detection ────────────────────────────────────────────────────

let typingPauseTimer = null;

// Every keystroke resets the timer; when it expires the user has paused typing
document.addEventListener('keydown', () => {
  clearTimeout(typingPauseTimer);
  typingPauseTimer = setTimeout(onTypingPause, TYPING_PAUSE_MS);
});

// Tell background.js this is a good moment to interrupt if a break is due
function onTypingPause() {
  chrome.runtime.sendMessage({ type: 'TYPING_PAUSE' }).catch(() => {});
}
