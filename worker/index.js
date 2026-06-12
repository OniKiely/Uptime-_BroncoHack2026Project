/**
 * Uptime! — Gemini API proxy worker
 *
 * Keeps the Gemini API key off the client.
 * The extension calls this worker; the worker adds the key and forwards
 * the request to Gemini. Includes per-IP daily rate limiting via KV.
 *
 * Environment variables (set as Cloudflare secrets):
 *   GEMINI_API_KEY  — your Google AI Studio API key
 *
 * KV namespace binding (set in the Cloudflare dashboard):
 *   RATE_LIMIT_KV   — stores per-IP daily request counts
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const DAILY_LIMIT  = 50;  // max Gemini calls per IP per day

// CORS headers — Chrome extensions send requests from chrome-extension:// origins
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {

    // ── Preflight ────────────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const ip       = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const today    = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const kvKey    = `rl:${ip}:${today}`;

    if (env.RATE_LIMIT_KV) {
      const raw   = await env.RATE_LIMIT_KV.get(kvKey);
      const count = raw ? parseInt(raw, 10) : 0;

      if (count >= DAILY_LIMIT) {
        return json({ error: 'Daily limit reached. Try again tomorrow.' }, 429);
      }

      // Increment count; expire at midnight UTC by storing TTL until end of day
      const secondsUntilMidnight = 86400 - (Date.now() / 1000 % 86400);
      await env.RATE_LIMIT_KV.put(kvKey, String(count + 1), {
        expirationTtl: Math.ceil(secondsUntilMidnight),
      });
    }

    // ── Parse + validate request body ────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body?.contents) {
      return json({ error: 'Missing required field: contents' }, 400);
    }

    // ── Forward to Gemini ────────────────────────────────────────────────────
    let geminiRes;
    try {
      geminiRes = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
    } catch (err) {
      return json({ error: 'Failed to reach Gemini API', detail: err.message }, 502);
    }

    const data = await geminiRes.json();
    return json(data, geminiRes.status);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
