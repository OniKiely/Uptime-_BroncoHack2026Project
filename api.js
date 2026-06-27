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
// 120 hand-picked subjects Gemini is told to write about EXACTLY.
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
  { type: 'ANIMAL', subject: 'mantis shrimp seeing 16 color channels (humans have 3) and punching with 1,500 N force' },
  { type: 'ANIMAL', subject: 'sea cucumber evisceration: expelling organs at predators, then regrowing them in weeks' },
  { type: 'ANIMAL', subject: 'honey badger\'s loose skin lets it twist inside its own hide to bite anything gripping it' },
  { type: 'ANIMAL', subject: 'lyrebird mimicking chainsaws, car alarms, and camera shutters with pitch-perfect accuracy' },
  { type: 'ANIMAL', subject: 'naked mole rat: cold-blooded mammal, cancer-immune, lives 37 years (10× expected for its size)' },
  { type: 'ANIMAL', subject: 'hagfish releasing instant slime that clogs predator gills, then tying itself in a knot to escape' },
  { type: 'ANIMAL', subject: 'electric eel generating 600 V, then using its field to remotely control prey muscles' },
  { type: 'ANIMAL', subject: 'vampire bat sharing regurgitated blood meals with unsuccessful colony members who went hungry' },
  { type: 'ANIMAL', subject: 'dung beetle navigating by the Milky Way — the only non-human animal proven to use the galaxy as a compass' },
  { type: 'ANIMAL', subject: 'cuttlefish showing REM-like sleep with rapid eye movement and flickering skin-color changes' },
  { type: 'ANIMAL', subject: 'immortal hydra: no biological aging detected — every cell continuously replaced, theoretically never dies' },

  // SPACE (24)
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
  { type: 'SPACE', subject: 'magnetars: neutron stars with magnetic fields so strong they would erase a credit card from 1,000 km away' },
  { type: 'SPACE', subject: 'observable universe is 93 billion light-years across despite being only 13.8 billion years old' },
  { type: 'SPACE', subject: 'M87 black hole image required 8 petabytes of data and a virtual Earth-sized telescope' },
  { type: 'SPACE', subject: 'Moon is drifting 3.8 cm farther from Earth every year — days were once only 18 hours long' },
  { type: 'SPACE', subject: '1859 Carrington Event solar flare would destroy global power grids and internet if it hit today' },
  { type: 'SPACE', subject: 'Pluto\'s heart-shaped nitrogen glacier Tombaugh Regio is 1,000 km wide and made of frozen gas' },
  { type: 'SPACE', subject: 'ISS astronauts see 16 sunrises and 16 sunsets every day while orbiting Earth every 90 minutes' },
  { type: 'SPACE', subject: 'Venus rotates so slowly its day (243 Earth days) is longer than its year (225 Earth days)' },
  { type: 'SPACE', subject: 'TRAPPIST-1 system: 7 Earth-sized planets orbiting a star 39 light-years away, 3 in the habitable zone' },
  { type: 'SPACE', subject: 'cosmic microwave background radiation: still-detectable thermal afterglow of the Big Bang' },
  { type: 'SPACE', subject: 'Mercury\'s iron core is proportionally larger than Earth\'s — outer layers stripped by an ancient impact' },

  // HISTORY (24)
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
  { type: 'HISTORY', subject: 'ancient Romans brushed their teeth with urine — ammonia was the most effective whitening agent available' },
  { type: 'HISTORY', subject: 'Napoleon was average height for his era (5\'7") — the myth came from English propaganda misusing French inches' },
  { type: 'HISTORY', subject: 'Eiffel Tower was designed to be demolished in 1909, saved only because it doubled as a radio antenna' },
  { type: 'HISTORY', subject: 'ancient Greek Olympic athletes competed entirely naked; shoes and clothing were banned' },
  { type: 'HISTORY', subject: 'tea was introduced to Britain in 1660 — before that, beer was the standard breakfast drink for all ages' },
  { type: 'HISTORY', subject: 'the Ottoman Empire was still active when Mickey Mouse debuted in 1928' },
  { type: 'HISTORY', subject: 'world\'s first commercial airline flight: 1914, 23 miles across Tampa Bay, completed in 23 minutes' },
  { type: 'HISTORY', subject: 'during Prohibition the U.S. government deliberately poisoned industrial alcohol, killing roughly 10,000 people' },
  { type: 'HISTORY', subject: 'medieval Europeans knew Earth was round — the flat-Earth myth was invented by 19th-century writers' },
  { type: 'HISTORY', subject: 'ancient Egyptians used crocodile dung as a contraceptive pessary — it worked partly due to acidic pH' },
  { type: 'HISTORY', subject: 'the Great Wall of China is not visible from space with the naked eye, despite the persistent myth' },

  // SCIENCE (24)
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
  { type: 'SCIENCE', subject: 'quantum entanglement: two particles share state instantly regardless of distance — Einstein called it "spooky action at a distance"' },
  { type: 'SCIENCE', subject: 'time runs measurably slower at sea level than at altitude — verified by atomic clocks on commercial flights' },
  { type: 'SCIENCE', subject: 'water expands 9% when it freezes — the rare property that makes ice float and keeps aquatic life alive in winter' },
  { type: 'SCIENCE', subject: 'sharp pain travels at 30 m/s via A-fibers; dull ache travels at 2 m/s via C-fibers' },
  { type: 'SCIENCE', subject: 'lightning bolt surface temperature is ~30,000 K — five times hotter than the sun\'s surface' },
  { type: 'SCIENCE', subject: 'human body emits bioluminescence, but it\'s 1,000× too dim for our eyes to detect' },
  { type: 'SCIENCE', subject: 'dogs can detect cancer, Parkinson\'s disease, and hypoglycemia by smell with over 90% accuracy in trials' },
  { type: 'SCIENCE', subject: 'the Baader-Meinhof phenomenon: noticing something for the first time makes you see it everywhere — a cognitive frequency illusion' },
  { type: 'SCIENCE', subject: 'ant colonies solve the travelling-salesman routing problem to near-optimal efficiency using pheromone trails' },
  { type: 'SCIENCE', subject: 'the color orange had no English word before 1502 — saffron-colored objects were simply called yellow-red' },
  { type: 'SCIENCE', subject: 'Fibonacci spirals appear in sunflower seeds, pine cones, and nautilus shells — an emergent result of optimal packing math' },

  // FAKE_STUDY (24)
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
  { type: 'FAKE_STUDY', subject: 'fake study: people who name their Roombas are 3× more likely to apologize after bumping into furniture' },
  { type: 'FAKE_STUDY', subject: 'fake study: window-seat workers submit expense reports rounded to the nearest $5 significantly more often' },
  { type: 'FAKE_STUDY', subject: 'fake study: employees who use dark mode average 0.8 fewer "per my last email" incidents per quarter' },
  { type: 'FAKE_STUDY', subject: 'fake study: the farther a person sits from the whiteboard, the more they use the phrase "big picture"' },
  { type: 'FAKE_STUDY', subject: 'fake study: post-it note color predicted manager approval rate with 74% accuracy across three industries' },
  { type: 'FAKE_STUDY', subject: 'fake study: people who say "no worries" instead of "you\'re welcome" finish their coffee 3 minutes faster' },
  { type: 'FAKE_STUDY', subject: 'fake study: users with 7+ pinned browser tabs send 26% more "quick question" Slack messages daily' },
  { type: 'FAKE_STUDY', subject: 'fake study: people who bring leftovers for lunch are 19% more likely to decline recurring meeting invites' },
  { type: 'FAKE_STUDY', subject: 'fake study: those who write "per our conversation" begin their next scheduled meeting 2.3 minutes late on average' },
  { type: 'FAKE_STUDY', subject: 'fake study: typing speed inversely correlates with frequency of using bullet points in email' },
  { type: 'FAKE_STUDY', subject: 'fake study: mug ownership count correlates inversely with video call background complexity' },
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

// ── Streak caption generation ─────────────────────────────────────────────────

const CAPTION_FALLBACKS = [
  "Standing up daily: the one healthy habit my doctor actually believes.",
  "Broke 3 times today, fixed my back once. Net positive.",
  "My spine filed a formal thank-you note and I framed it.",
  "Three breaks taken. Zero excuses left. Posture: temporarily redeemed.",
  "Sat like a champion, stood like a legend. Repeat tomorrow.",
];

export async function generateStreakCaption({ streak, totalSittingToday, breakCount }) {
  const prompt =
    `Day ${streak} streak. ${totalSittingToday} minutes sat today. ${breakCount} breaks done. ` +
    `Write a short, funny, slightly self-aware meme caption for this sitting break achievement. ` +
    `1 sentence, under 15 words. Return ONLY the caption text.`;

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.3, maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const caption = parts.map(p => p.text ?? '').join('').trim()
      .replace(/^["']|["']$/g, ''); // strip any surrounding quotes Gemini sneaks in

    if (!caption) throw new Error('empty response');
    return caption;
  } catch {
    return CAPTION_FALLBACKS[Math.floor(Math.random() * CAPTION_FALLBACKS.length)];
  }
}

// ── Fallback ──────────────────────────────────────────────────────────────────

export async function getOfflineReward() {
  const stored = await chrome.storage.local.get('lastReward');
  if (stored.lastReward) return stored.lastReward;
  return FALLBACK_REWARDS[Math.floor(Math.random() * FALLBACK_REWARDS.length)];
}
