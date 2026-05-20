// api.js — Gemini API helper: generates rewards and manages fallbacks

import { GEMINI_API_KEY } from './config.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Fallback rewards ──────────────────────────────────────────────────────────
// Shown instantly if the API is slow or fails during demo

const FALLBACK_REWARDS = [
  {
    type: 'ANIMAL',
    headline: 'The Mantis Shrimp',
    content: 'Mantis shrimps punch with the force of a bullet — 1,500 Newtons — fast enough to cavitate water around their claws. They also see 16 types of color receptor compared to your 3.',
    emoji: '🦐',
  },
  {
    type: 'SPACE',
    headline: 'A Day Longer Than a Year',
    content: "Venus rotates so slowly that one full day is longer than its entire year. You'd celebrate New Year's before you ever saw the next sunrise.",
    emoji: '🪐',
  },
  {
    type: 'HISTORY',
    headline: 'Napoleon Was Above Average Height',
    content: "Napoleon stood 5'7\" — taller than the average Frenchman of his era. The \"short Napoleon\" myth was British war propaganda, amplified by a unit conversion error between French and English inches.",
    emoji: '👑',
  },
  {
    type: 'SCIENCE',
    headline: 'You Are Mostly Empty Space',
    content: 'If you removed all the empty space from every atom in every person on Earth, all 8 billion of us would fit inside a sugar cube. You are almost entirely nothing.',
    emoji: '⚛️',
  },
  {
    type: 'FAKE_STUDY',
    headline: 'Standing Breaks Increase Snack Creativity by 34%',
    content: 'A 2019 study from the University of Zurich found people who took standing breaks chose snacks with significantly more "textural complexity." Lead researcher Dr. Müller noted the findings were "delicious." [FICTIONAL]',
    emoji: '🧪',
  },
];

// ── Prompt builder ────────────────────────────────────────────────────────────

const REWARD_TYPES = ['ANIMAL', 'SPACE', 'HISTORY', 'SCIENCE', 'FAKE_STUDY'];

const REWARD_INSTRUCTIONS = {
  ANIMAL:     'A micro-story or surprising fact about an obscure or cute animal. Include the animal\'s name as the headline.',
  SPACE:      'A mind-bending fact about space or the universe that makes reality feel strange.',
  HISTORY:    'A genuinely weird or funny historical fact almost nobody knows.',
  SCIENCE:    'A counterintuitive science fact that sounds fake but is real.',
  FAKE_STUDY: 'A made-up but completely plausible-sounding scientific study with an absurd finding. Label it clearly as "fictional" in the content.',
};

function buildPrompt(siteCategory, breakCount, recentHeadlines = []) {
  // Pick the type here in JS so the model can't default to ANIMAL every time
  const type = REWARD_TYPES[Math.floor(Math.random() * REWARD_TYPES.length)];

  const avoidClause = recentHeadlines.length > 0
    ? `\n\nThe user has already seen these facts — do NOT repeat or closely paraphrase any of them: ${recentHeadlines.join(' | ')}. Pick a completely different subject.`
    : '';

  return `The user just completed break #${breakCount} today. They were working on: ${siteCategory}.

Generate a "${type}" reward: ${REWARD_INSTRUCTIONS[type]}${avoidClause}

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "type": "${type}",
  "headline": "short punchy title",
  "content": "the fact or story, max 2-3 sentences",
  "emoji": "one relevant emoji"
}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

// Call after the user completes their break timer
export async function generateReward(siteCategory = 'other', breakCount = 1) {
  // Read recent headlines so Gemini knows what to avoid
  const { savedRewards = [] } = await chrome.storage.local.get('savedRewards');
  const recentHeadlines = savedRewards.slice(0, 15).map(r => r.headline);

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: 'You are the reward engine for "Uptime!", a wellness Chrome extension. Generate a single delightful reward for a user who just completed a standing break. Keep it under 3 sentences. Make it the kind of thing they\'d want to tell a friend. Be specific, surprising, and a little weird.',
          }],
        },
        contents: [{
          parts: [{ text: buildPrompt(siteCategory, breakCount, recentHeadlines) }],
        }],
        generationConfig: {
          temperature: 1.2,
          maxOutputTokens: 300,
          thinkingConfig: { thinkingBudget: 0 }, // disable thinking — not needed for fun facts
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.warn('[Uptime] Gemini API error:', response.status, errBody?.error?.message);
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    // Join all parts — Gemini 2.5 may return thinking + answer as separate parts
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const raw = parts.map(p => p.text ?? '').join('');
    console.log('[Uptime] Gemini raw response:', raw);

    // Gemini sometimes wraps JSON in ```json ... ``` — strip it
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const reward = JSON.parse(cleaned);

    // Cache the last successful reward as an extra safety net
    chrome.storage.local.set({ lastReward: reward });

    return reward;
  } catch (err) {
    console.warn('[Uptime] Gemini API failed, using fallback:', err.message);
    return getOfflineReward();
  }
}

// ── Fallback ──────────────────────────────────────────────────────────────────

// Returns last cached API reward, or a hardcoded one if nothing is cached
export async function getOfflineReward() {
  const stored = await chrome.storage.local.get('lastReward');
  if (stored.lastReward) return stored.lastReward;
  return FALLBACK_REWARDS[Math.floor(Math.random() * FALLBACK_REWARDS.length)];
}
