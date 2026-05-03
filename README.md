# TrendPulse

Automated YouTube trend tracking agent for a faceless Shorts channel. Every day at **6AM WAT**, it scans YouTube for trending videos across AI, automation, tech, business, and real estate niches — then sends the top 3 directly to your Telegram.

## How It Works

1. Searches 22 keywords across all niches in parallel via YouTube Data API v3
2. Fetches view counts for all results in a single batched call
3. Filters to videos published in the last 48 hours with 100k+ views
4. Deduplicates, ranks by view count, picks the top 3
5. Sends a formatted Telegram report so you can recreate the content same day

## Niches Covered

- AI & Automation — `AI automation 2026`, `n8n automation`, `ChatGPT automation`, and more
- Tech & Engineering — `system design 2026`, `software architecture explained`, and more
- Business & Income — `passive income 2026`, `faceless YouTube automation`, and more
- Real Estate Tech — `proptech 2026`, `real estate investing AI`, and more

## Stack

- **NestJS** + TypeScript
- **@nestjs/schedule** — cron scheduling (no Redis needed)
- **Axios** — YouTube Data API v3 + Telegram Bot API
- **Render** — deployed as a background worker

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
| `TELEGRAM_CHAT_ID` | Send a message to your bot, then call getUpdates to find your chat ID |

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

The test suite covers:

- `TrackerService` — filter/rank logic, deduplication, 48h window calculation
- `NotifyService` — message formatter, time-ago helper

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check — returns `{ status: "ok", timestamp }` for Render |
| `GET` | `/tracker/trigger` | Manually fire a scan and send results to Telegram |

Use `/tracker/trigger` to test your API keys and see results immediately without waiting for the 6AM cron.

## Schedule

The cron runs daily at **6:00 AM WAT** (`Africa/Lagos` timezone). Render runs in UTC — the timezone is handled internally by `@nestjs/schedule`, so no manual conversion needed.

## YouTube API Quota

Each run costs approximately **~2,200 quota units** (22 keywords × 100 units per `search.list` call + negligible for `videos.list`). The free tier provides 10,000 units/day, so TrendPulse uses roughly 22% of the daily quota.

## Deploying to Render

1. Push this repo to GitHub
2. Create a new **Background Worker** service on Render and connect the repo
3. Render will auto-detect `render.yaml`
4. Set the three environment variables in the Render dashboard:
   - `YOUTUBE_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. Deploy — the first Telegram report arrives at the next 6AM WAT

## Sample Telegram Output

```text
🎯 TrendPulse Daily Report — 3 May 2026
Here are your top 3 trending topics to recreate today:

🔥 Trending Now
━━━━━━━━━━━━━━━
📌 How I Automated My Entire Business with AI
👁 Views: 1,240,000
📺 Channel: TechWithTim
🕐 Posted: 6 hours ago
🏷 Niche: AI automation 2026
🔗 https://youtube.com/watch?v=xxxxx
━━━━━━━━━━━━━━━
```
