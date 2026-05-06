# TrendPulse

Automated YouTube trend tracking agent for a faceless Shorts channel. Every day at **6AM WAT**, it scans YouTube for trending videos across AI, automation, tech, business, and real estate niches — downloads keyframes from each video, fetches the transcript, sends everything to GPT-4o for analysis, then delivers a 3-part Telegram report per video so you can recreate it same day.

## How It Works

1. Searches 22 keywords across all niches in parallel via YouTube Data API v3
2. Fetches view counts for all results in a single batched call
3. Filters to videos published in the last 48 hours with 100k+ views
4. Deduplicates, ranks by view count, picks the top 3
5. For each of the top 3 videos:
   - Fetches full metadata (title, description, tags, likes, duration)
   - Fetches the transcript via `youtube-transcript`
   - Uses `yt-dlp` to resolve the signed stream URL, then pipes it to `ffmpeg` to extract 10 keyframes (frame 1 at 2s for the hook, frames 2–10 distributed evenly across the video)
   - Sends transcript + frames to GPT-4o for analysis
6. Sends 3 Telegram messages per video: trend overview → AI analysis → ready-to-use script

## What GPT-4o Analyses

- **Why it's trending** — structural, emotional, and informational hooks driving views
- **Visual strategy** — text overlays, pacing, transitions, thumbnail composition
- **Hook analysis** — exactly what makes the first 3 seconds work
- **Generated script** — timestamped 60-second Shorts script with a fresh angle on the same topic
- **Suggested title** — optimised for click-through
- **Hook overlay** — single sentence for a text overlay

## Niches Covered

- AI & Automation — `AI automation 2026`, `n8n automation`, `ChatGPT automation`, and more
- Tech & Engineering — `system design 2026`, `software architecture explained`, and more
- Business & Income — `passive income 2026`, `faceless YouTube automation`, and more
- Real Estate Tech — `proptech 2026`, `real estate investing AI`, and more

## Stack

- **NestJS** + TypeScript
- **@nestjs/schedule** — cron scheduling (no Redis needed)
- **Axios** — YouTube Data API v3 + Telegram Bot API
- **yt-dlp** — resolves YouTube signed stream URLs (system binary, updated daily by the community)
- **fluent-ffmpeg** — extracts 10 keyframes per video from the stream URL in a single pass
- **youtube-transcript** — fetches auto-generated or manual captions
- **OpenAI SDK** — GPT-4o vision analysis
- **Render** — deployed as a background worker

## Prerequisites

### ffmpeg

Required for frame extraction.

**Windows (dev):**

```bash
winget install ffmpeg
```

**Render:** handled automatically via the `buildCommand` in `render.yaml`.

### yt-dlp

Required to resolve YouTube video stream URLs. Must be on your `PATH`.

**Windows (dev):**

```powershell
# Step 1 — installs ffmpeg as a dependency automatically
winget install yt-dlp.yt-dlp

# Step 2 — replace the broken WindowsApps stub with the real binary
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "C:\Windows\System32\yt-dlp.exe"
```

> **Why two steps?** `winget` installs a Windows App Execution Alias (a stub) into `WindowsApps` that fails with a PyInstaller error at runtime. Downloading the real binary into `System32` overwrites the stub and takes PATH priority. Step 1 is still useful because it installs `ffmpeg` as a side-effect.

Verify both are working:

```powershell
yt-dlp --version   # should print version number, no errors
ffmpeg -version
```

**Render:** handled automatically via the `buildCommand` in `render.yaml`.

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
| --- | --- |
| `YOUTUBE_API_KEY` | Google Cloud Console → YouTube Data API v3 |
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram |
| `TELEGRAM_CHAT_ID` | Send a message to your bot, then call `getUpdates` to find your chat ID |
| `OPENAI_API_KEY` | platform.openai.com → API keys |

### 3. Run locally

```bash
# Development (watch mode)
pnpm start:dev

# Production build
pnpm build && pnpm start
```

## Testing

```bash
# Run all unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:cov
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check — returns `{ status: "ok", timestamp }` for Render |
| `GET` | `/tracker/trigger` | Manually fire a scan and send results to Telegram |

Use `/tracker/trigger` to test your API keys and see results immediately without waiting for the 6AM cron.

## Schedule

The cron runs daily at **6:00 AM WAT** (`Africa/Lagos` timezone). Render runs in UTC — the timezone is handled internally by `@nestjs/schedule`, so no manual conversion needed.

## Graceful Degradation

Each video is enriched independently. Failures are isolated and logged — the daily report always sends.

| Failure | Behaviour |
| --- | --- |
| `yt-dlp` can't resolve stream URL | Frames = `[]`, analysis continues with transcript only |
| `ffmpeg` frame extraction fails | Frames = `[]`, analysis continues with transcript only |
| Transcript unavailable | `transcript = null`, GPT-4o analyses frames only |
| GPT-4o call fails | Analysis skipped, Telegram still receives the trend overview message |
| Entire video enrichment fails | Bare trend result (title, views, link) still included in report |

## YouTube API Quota

Each run costs approximately **~2,200 quota units** (22 keywords × 100 units per `search.list` call + negligible for `videos.list`). The free tier provides 10,000 units/day, so TrendPulse uses roughly 22% of the daily quota.

## OpenAI Cost Estimate

10 frames × 3 videos = 30 images per daily run. At `detail: "low"` (~500–1,500 tokens/image) plus transcript text and the system prompt: roughly 15,000–30,000 input tokens per run. At GPT-4o pricing (~$2.50/1M tokens) this works out to **$0.04–$0.08/day**.

## Deploying to Render

1. Push this repo to GitHub
2. Create a new **Background Worker** service on Render and connect the repo
3. Render will auto-detect `render.yaml` — `ffmpeg` and `yt-dlp` are installed automatically during the build
4. Set the four environment variables in the Render dashboard:
   - `YOUTUBE_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `OPENAI_API_KEY`
5. Deploy — the first Telegram report arrives at the next 6AM WAT

## Sample Telegram Output

Each video produces three messages:

### Message 1 — Trend overview

```text
🔥 Trending Now
━━━━━━━━━━━━━━━
📌 Passive Income: I Tried AI Dropshipping For a Week (RAW RESULTS)
👁 Views: 208,411
📺 Channel: Mark Tilbury
🕐 Posted: 1 day ago
🏷 Niche: AI tools 2026
🔗 https://youtube.com/watch?v=rhuYy9LP72M
━━━━━━━━━━━━━━━
```

### Message 2 — AI analysis

```text
🧠 Why It's Trending:
The video is trending due to its focus on a hot topic — leveraging AI for passive
income through dropshipping. The presenter shares personal experiences candidly,
building trust by showing raw results and discussing pitfalls honestly.

👁 Visual Strategy:
Text overlays highlight key points throughout. Upbeat background music with cuts
matching the rhythm. Presenter centred with a laptop showing on-screen text,
bright lighting, consistent framing.

🎣 Hook Analysis:
In the first 3 seconds, a man holds a laptop showing an order screen alongside
the bold claim of making thousands passively using AI — immediately capturing
viewers interested in quick profits and advanced tools.
```

### Message 3 — Script

```text
📝 Suggested Title:
AI Dropshipping: Myth or Money Machine?

🪝 Hook Overlay:
Is AI your ticket to passive income? Find out now!

📋 Script:
[0-3s] Can AI really automate your income streams? Let's uncover the truth!
[3-15s] In today's fast-paced world, AI dropshipping promises easy money. But is it hype or reality?
[15-30s] First, the AI tool supposedly revolutionising online stores — what does it really offer?
[30-45s] We set up a shop in minutes, analyse real-time results, and debunk the myths.
[45-60s] Subscribe to find out if AI fills your pockets — or just your inbox.
━━━━━━━━━━━━━━━
```
