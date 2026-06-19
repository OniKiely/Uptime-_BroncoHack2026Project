# Changelog

All notable changes to Uptime! are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.0] — 2026-06-19

### Added

- **Streak reward — daily unlockable artwork** — Completing 3 breaks in a day unlocks a special full-page reward screen. A randomly selected piece of original mascot artwork (15 illustrations by human artist @Osprey.Mobius) is shown, cycling through the full set before any image repeats. An AI-generated meme caption personalised with the day's stats (streak day, sitting time, breaks) is fetched from Gemini and displayed alongside the artwork.

- **Artwork download** — Users can download the day's streak illustration directly from the reward page.

- **Caption copy / share card** — The AI caption can be copied to clipboard to pair with the downloaded image as a shareable card.

- **Same-day image consistency** — Opening the streak reward page multiple times in one day (e.g. from the collection page) reuses the same artwork instead of burning through the pool. `currentStreakImage` and `lastStreakRewardDate` are stored to enforce this.

- **Collection page claim banner** — If the user misses the streak reward button on the reward screen, a persistent "Claim Your Streak Reward" banner appears at the top of the Collection page for the rest of the day (visible whenever `breakCount >= 3`). Disappears automatically at midnight when daily stats reset.

---

## [1.1.0] — 2026-06-18

### Fixed

- **Startup alarm race condition** — A stale break alarm from the previous Chrome session could fire immediately on startup before `onStartup` had a chance to clear it. Fixed by adding a staleness guard in `onAlarm`: alarms more than 60 seconds overdue are discarded and rescheduled fresh.

- **Daily stats wiped on extension update** — `onInstalled` reset `totalSittingToday`, `breakCount`, and streak unconditionally, including when Chrome silently auto-updated the extension from the Web Store. Fixed by checking `details.reason`; state is only wiped on first `'install'`.

- **Idle return fired break too early** — The break alarm was not rescheduled when the user returned from idle, only when it was missing entirely. After a long idle, the session timer reset correctly but the alarm could fire minutes later instead of after the full threshold. Fixed by always calling `scheduleBreakAlarm()` on idle return.

- **Midnight reset alarm lost after Chrome restart** — `scheduleMidnightReset()` was only called in `onInstalled`, not `onStartup`. If Chrome restarted, the midnight alarm was never re-scheduled, causing `timeByCategory` to accumulate across multiple days without resetting.

- **Today's Sessions total could diverge from SAT TODAY** — `trackCategoryTime()` had an early return when `siteCategory` was falsy that incremented `totalSittingToday` but skipped `timeByCategory`. Removed the early return; both fields now always increment together using `'other'` as fallback.

- **Repeat AI rewards** — Gemini ignored negative constraints ("don't repeat these topics"). Replaced the banned-list prompt approach with a 60-topic pool tracked by index in storage. Topics are selected positively, guaranteeing unique subjects for 60 breaks before the pool cycles.

- **Queue filling stuck after reward tab closed early** — `fillQueue()` ran inside the reward tab; closing the tab mid-Gemini-call left `queueFilling: true` permanently. Moved all queue filling to the service worker (`background.js`) so it survives tab close.

- **Demo mode alarm disappearing after 2–3 breaks** — The break alarm was consumed when an existing reward tab was detected, and `handleBreakAlarm()` returned early without rescheduling. Added `scheduleBreakAlarm()` at that early return path.

- **`totalSittingToday` reset on Chrome close** — The daily sitting total was previously only updated at break time. Moved accumulation to the per-minute tick so the value persists continuously to storage.

### Changed

- **Gemini API key moved behind Cloudflare Worker proxy** — The API key is no longer bundled in the extension. All Gemini requests are routed through a serverless Cloudflare Worker (`uptime-gemini-proxy`), keeping the key secure on the server side.

- **Token usage optimized** — Reduced `maxOutputTokens` from 2500 → 1024 (batch) and 300 → 150 (single). Shortened system instruction and reward format strings. No visible change to reward quality.

---

## [1.0.0] — 2026-04-12

Initial release — submitted to BroncoHack 2026 (Sport & Fitness / Health & Wellness track).

### Features
- 45-minute sitting timer with idle detection (5-minute threshold)
- AI-generated break rewards via Google Gemini 2.5 Flash (5 types: Animal, Space, History, Science, Fake Study)
- 30-second countdown screen — reward only revealed after waiting
- Daily stats: breaks completed, total sitting time, streak counter
- Icon badge showing minutes until next break (color-coded green → orange → red)
- Meeting detection — never interrupts Google Meet, Zoom, or Teams
- Flow detection — delays break when user is rapidly switching tabs
- Snooze (once per session, 15-minute delay)
- Demo mode (2-minute threshold, toggle with 3 logo clicks)
- Site category tracking (coding, video, meetings, social, other)
- Reward collection page
- 5 offline fallback rewards
