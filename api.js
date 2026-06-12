// api.js — Gemini API helper: topic-pool queue generation + fallbacks

const WORKER_URL = 'https://uptime-gemini-proxy.wangruiyang1210.workers.dev';

const QUEUE_TARGET    = 10; // facts generated per batch call
const QUEUE_REFILL_AT = 3;  // start refilling when fewer than this remain

// ── Fallback rewards ──────────────────────────────────────────────────────────

const FALLBACK_REWARDS = [
  {
    type: 'ANIMAL',
    headline: 'The Immortal Jellyfish',
    content: 'Turritopsis dohrnii is the only known animal that can revert to its juvenile polyp stage after reaching sexual maturity — and then grow up again. Technically, it never has to die.',
    emoji: '🪼',
  },
  {
    type: 'SPACE',
    headline: 'It Rains Diamonds on Neptune',
    content: 'The extreme pressure deep inside Neptune and Uranus compresses carbon into diamond crystals that rain down toward the core. Oceans of liquid diamond with solid diamond icebergs may exist miles below the cloud tops.',
    emoji: '💎',
  },
  {
    type: 'HISTORY',
    headline: 'Oxford Is Older Than the Aztec Empire',
    content: 'Teaching at Oxford University began around 1096 AD. The Aztecs founded Tenochtitlán in 1325. Oxford was already over 200 years old when the Aztec Empire started.',
    emoji: '🏛️',
  },
  {
    type: 'SCIENCE',
    headline: 'You Exhale Your Fat',
    content: "When you lose weight, 84% of it leaves your body as exhaled CO₂. The rest leaves as water through sweat and urine. You literally breathe out most of what you lose — your lungs are your primary fat-loss organ.",
    emoji: '💨',
  },
  {
    type: 'FAKE_STUDY',
    headline: 'Standing Breaks Increase Snack Creativity by 34%',
    content: 'A 2019 study from the University of Zurich found people who took standing breaks chose snacks with significantly more "textural complexity." Lead researcher Dr. Müller noted the findings were "delicious." [FICTIONAL]',
    emoji: '🧪',
  },
];

// ── Topic pool ────────────────────────────────────────────────────────────────
// 60 hand-picked subjects Gemini is told to write about EXACTLY.
// This prevents AI bias: instead of "don't repeat X" (which LLMs ignore),
// we control the input and guarantee variety through index tracking.

const TOPIC_POOL = [
  // ANIMAL (12)
  { type: 'ANIMAL', subject: 'Turritopsis dohrnii: the biologically immortal jellyfish that reverts to a juvenile after maturity' },
  { type: 'ANIMAL', subject: 'pistol shrimp claw snap creating a plasma cavitation bubble hotter than the sun\'s surface' },
  { type: 'ANIMAL', subject: 'mimic octopus impersonating flatfish, lionfish, and sea snakes on demand' },
  { type: 'ANIMAL', subject: 'tardigrades surviving vacuum, extreme radiation, -272°C, and 150°C' },
  { type: 'ANIMAL', subject: 'axolotl regenerating its heart, spine, limbs, and parts of its brain' },
  { type: 'ANIMAL', subject: 'bombardier beetle firing boiling 100°C chemical spray in machine-gun bursts' },
  { type: 'ANIMAL', subject: 'crows holding grudges and teaching offspring which humans to distrust' },
  { type: 'ANIMAL', subject: 'platypus: venomous, electrosensing, egg-laying, and sweating milk simultaneously' },
  { type: 'ANIMAL', subject: 'wood frog freezing solid in winter (heart stopped) then thawing alive in spring' },
  { type: 'ANIMAL', subject: 'clownfish: all-male schools where the dominant fish permanently changes sex to female' },
  { type: 'ANIMAL', subject: 'elephants sensing seismic communication through their feet across 32 km' },
  { type: 'ANIMAL', subject: 'hummingbird nightly torpor dropping heart rate from 1,200 to 50 bpm to survive without food' },

  // SPACE (12)
  { type: 'SPACE', subject: 'neutron star density: teaspoon weighs 10 million tons, some spin 700 times per second' },
  { type: 'SPACE', subject: 'Voyager 1 in interstellar space; signals take 22+ hours to arrive at light speed' },
  { type: 'SPACE', subject: 'diamond rain on Neptune and Uranus from carbon compressed into crystals' },
  { type: 'SPACE', subject: 'Boötes Supervoid: 330-million-light-year near-empty region of the universe' },
  { type: 'SPACE', subject: 'Olympus Mons so wide its base is below Mars\'s own horizon from the summit' },
  { type: 'SPACE', subject: 'Hubble mirror ground to wrong prescription, corrected in orbit with \'contact lenses\'' },
  { type: 'SPACE', subject: 'space smells like seared steak and hot metal — detected on astronaut suits after EVAs' },
  { type: 'SPACE', subject: 'Titan has rivers, lakes, and rain — all liquid methane, not water' },
  { type: 'SPACE', subject: 'hypervelocity stars ejected from the galactic core at escape velocity, leaving the Milky Way' },
  { type: 'SPACE', subject: 'Jupiter\'s aurora larger than Earth; magnetic field 20,000x stronger than ours' },
  { type: 'SPACE', subject: 'first space photograph taken in 1946 by a V-2 rocket with a film camera' },
  { type: 'SPACE', subject: 'GPS satellites require relativistic time corrections or navigation drifts miles per day' },

  // HISTORY (12)
  { type: 'HISTORY', subject: 'Cleopatra lived closer to the Moon landing than to the pyramids being built' },
  { type: 'HISTORY', subject: 'France\'s last guillotine execution was in 1977 — the same year Star Wars opened' },
  { type: 'HISTORY', subject: 'Oxford University predates the Aztec Empire by over 200 years' },
  { type: 'HISTORY', subject: 'Anglo-Zanzibar War of 1896: history\'s shortest war, 38–45 minutes total' },
  { type: 'HISTORY', subject: 'Romans used garum (fermented fish sauce) as their everyday universal condiment' },
  { type: 'HISTORY', subject: 'Benjamin Franklin\'s proposed English alphabet eliminated C, J, Q, W, X, and Y' },
  { type: 'HISTORY', subject: 'Genghis Khan\'s conquests may have lowered global CO2 as forests regrew on abandoned land' },
  { type: 'HISTORY', subject: 'Library of Alexandria died from funding cuts and neglect, not a dramatic fire' },
  { type: 'HISTORY', subject: 'Victorian London\'s underground pneumatic mail tubes shot capsules of letters at 35 mph' },
  { type: 'HISTORY', subject: 'Byzantine Empire lasted 1,000 years after Rome\'s fall in 476 AD, ending in 1453' },
  { type: 'HISTORY', subject: 'Egyptian surgical manuals from 1600 BC describe stitches and brain injuries still valid today' },
  { type: 'HISTORY', subject: 'medieval monk prayer-bell schedules are the historical origin of time zones' },

  // SCIENCE (12)
  { type: 'SCIENCE', subject: 'Mpemba effect: hot water sometimes freezes faster than cold — still not fully explained' },
  { type: 'SCIENCE', subject: 'humans share 60% DNA with bananas, 85% with zebrafish, 98.7% with chimpanzees' },
  { type: 'SCIENCE', subject: 'exhaled CO2 accounts for 84% of fat lost — lungs are the primary fat-loss organ' },
  { type: 'SCIENCE', subject: '3,000-year-old Egyptian tomb honey is still chemically edible today' },
  { type: 'SCIENCE', subject: 'human blood vessels total 100,000 km — enough to circle Earth 2.5 times' },
  { type: 'SCIENCE', subject: 'blueberry blue comes from nanostructured wax crystals, not pigment' },
  { type: 'SCIENCE', subject: 'forest wood wide web: trees share nutrients and distress signals via fungal networks' },
  { type: 'SCIENCE', subject: 'glass is a supercooled liquid; old cathedral windows are measurably thicker at the bottom' },
  { type: 'SCIENCE', subject: 'petrichor (rain smell) is bacteria-produced geosmin, detectable at 5 parts per trillion' },
  { type: 'SCIENCE', subject: 'sound travels 4x faster in water and 15x faster in steel than in air' },
  { type: 'SCIENCE', subject: 'gut bacteria outnumber human cells in your body, weighing ~1.5 kg total' },
  { type: 'SCIENCE', subject: 'every atom in your body except hydrogen was forged inside an exploding star' },

  // FAKE_STUDY (12)
  { type: 'FAKE_STUDY', subject: 'fake study: houseplant-namers are 34% more likely to send unnecessary reply-all emails' },
  { type: 'FAKE_STUDY', subject: 'fake study: standing desk users write 17% longer text messages than seated colleagues' },
  { type: 'FAKE_STUDY', subject: 'fake study: coffee temperature at first sip predicts meeting length within 4 minutes' },
  { type: 'FAKE_STUDY', subject: 'fake study: alphabetical bookmark sorters make decisions measurably slower' },
  { type: 'FAKE_STUDY', subject: 'fake study: browser tab count correlates with email apology frequency' },
  { type: 'FAKE_STUDY', subject: 'fake study: stretch-break workers choose pizza toppings with significantly more conviction' },
  { type: 'FAKE_STUDY', subject: 'fake study: keyboard click volume predicts weekly "circling back" usage rate' },
  { type: 'FAKE_STUDY', subject: 'fake study: desk water drinkers misspell "definitely" 22% less often' },
  { type: 'FAKE_STUDY', subject: 'fake study: 2pm monitor brightness predicts passive-aggressive reply-all likelihood' },
  { type: 'FAKE_STUDY', subject: 'fake study: walking-break employees write 40% shorter, better-followed meeting agendas' },
  { type: 'FAKE_STUDY', subject: 'fake study: office temperature correlates with adjective count in project names' },
  { type: 'FAKE_STUDY', subject: 'fake study: people who stand every 45 min use the word "synergistic" 28% less' },
];

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateReward(siteCategory = 'other', breakCount = 1) {
  const { rewardQueue = [], savedRewards = [] } =
    await chrome.storage.local.get(['rewardQueue', 'savedRewards']);

  // Serve the next pre-generated fact from the queue
  if (rewardQueue.length > 0) {
    const [next, ...rest] = rewardQueue;
    await chrome.storage.local.set({ rewardQueue: rest });
    return next;
  }

  // Queue empty (first ever run or API down) — generate one on the spot
  try {
    return await generateSingle(savedRewards);
  } catch {
    return getOfflineReward();
  }
}

// ── Queue management ──────────────────────────────────────────────────────────

async function fillQueue(savedRewards, currentQueue) {
  const { queueFilling, queueFillingAt } =
    await chrome.storage.local.get(['queueFilling', 'queueFillingAt']);

  const stale = queueFilling && (Date.now() - (queueFillingAt || 0) > 60000);
  if (queueFilling && !stale) return;

  await chrome.storage.local.set({ queueFilling: true, queueFillingAt: Date.now() });

  try {
    const batch = await generateBatch();

    // Re-read queue in case another context wrote to it while we were generating
    const { rewardQueue: fresh = [] } = await chrome.storage.local.get('rewardQueue');
    await chrome.storage.local.set({ rewardQueue: [...fresh, ...batch], queueFilling: false });
  } catch {
    await chrome.storage.local.set({ queueFilling: false });
  }
}

// ── Batch generation (topic-pool approach) ────────────────────────────────────

async function generateBatch() {
  const { usedTopicIndices = [] } = await chrome.storage.local.get('usedTopicIndices');

  // Build the pool of available (not recently used) topics
  let available = TOPIC_POOL
    .map((t, i) => ({ ...t, idx: i }))
    .filter(t => !usedTopicIndices.includes(t.idx));

  // If we've exhausted all 60 topics, reset and start over
  if (available.length < QUEUE_TARGET) {
    available = TOPIC_POOL.map((t, i) => ({ ...t, idx: i }));
    await chrome.storage.local.set({ usedTopicIndices: [] });
  }

  // Shuffle and pick QUEUE_TARGET topics
  available.sort(() => Math.random() - 0.5);
  const selected = available.slice(0, QUEUE_TARGET);

  // Mark them as used before the API call so concurrent calls don't pick the same ones
  const newUsed = [...(usedTopicIndices.length < TOPIC_POOL.length ? usedTopicIndices : []),
                    ...selected.map(t => t.idx)];
  await chrome.storage.local.set({ usedTopicIndices: newUsed });

  const itemList = selected
    .map((t, i) => `${i + 1}. [${t.type}] ${t.subject}`)
    .join('\n');

  const prompt =
    `Write ${QUEUE_TARGET} fun facts — one per subject, no substitutions:\n${itemList}\n\n` +
    `JSON array only:\n[{"type":"...","headline":"title","content":"2 sentences","emoji":"emoji"},...]`;

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: 'You generate fun facts for a wellness app. Write ONLY about the exact subject given for each item — never substitute a different topic.' }],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.map(p => p.text ?? '').join('');
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const batch = JSON.parse(cleaned);

  if (!Array.isArray(batch)) throw new Error('Expected JSON array');

  if (batch.length > 0) chrome.storage.local.set({ lastReward: batch[0] });

  return batch.filter(r => r.type && r.headline && r.content && r.emoji);
}

// ── Single generation (fallback when queue is empty) ──────────────────────────

async function generateSingle(savedRewards) {
  const { usedTopicIndices = [] } = await chrome.storage.local.get('usedTopicIndices');

  let available = TOPIC_POOL
    .map((t, i) => ({ ...t, idx: i }))
    .filter(t => !usedTopicIndices.includes(t.idx));

  if (available.length === 0) {
    await chrome.storage.local.set({ usedTopicIndices: [] });
    available = TOPIC_POOL.map((t, i) => ({ ...t, idx: i }));
  }

  const topic = available[Math.floor(Math.random() * available.length)];
  await chrome.storage.local.set({
    usedTopicIndices: [...(usedTopicIndices.length < TOPIC_POOL.length ? usedTopicIndices : []), topic.idx],
  });

  const prompt =
    `Fact about: ${topic.subject}\n` +
    `JSON only: {"type":"${topic.type}","headline":"title","content":"2 sentences","emoji":"emoji"}`;

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: 'You generate fun facts for a wellness app. Write ONLY about the exact subject given.' }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1.0, maxOutputTokens: 150, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.map(p => p.text ?? '').join('');
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const reward = JSON.parse(cleaned);
  chrome.storage.local.set({ lastReward: reward });
  return reward;
}

// ── Queue prefill (called from background.js on startup / break alarm) ────────

export async function prefillQueue() {
  const { rewardQueue = [], savedRewards = [] } =
    await chrome.storage.local.get(['rewardQueue', 'savedRewards']);
  if (rewardQueue.length > QUEUE_REFILL_AT) return;
  await fillQueue(savedRewards, rewardQueue);
}

// ── Fallback ──────────────────────────────────────────────────────────────────

export async function getOfflineReward() {
  const stored = await chrome.storage.local.get('lastReward');
  if (stored.lastReward) return stored.lastReward;
  return FALLBACK_REWARDS[Math.floor(Math.random() * FALLBACK_REWARDS.length)];
}
