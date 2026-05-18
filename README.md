# ControlTower AI

AI command center for engineering release operations.

## What this app is

ControlTower AI is a Next.js product shell for enterprise engineering operations. It ingests operational signals and detects:

- risky releases
- blocked pull requests and stale review queues
- repeated incident hotspots
- alert storm pressure
- weak runbook readiness
- deploy lanes that need owner escalation

The current app is positioned for hackathon demo value: a trusted scoring engine plus Gemini-enhanced action briefs, Slack escalations, and incident summaries.

## Current capabilities

- enterprise landing page with release-ops framing
- command-center workspace for CSV ingestion and report generation
- dashboard with four panels:
  - release risk
  - incident hotspots
  - blocked work
  - agent-generated action brief
- interactive issue drill-down with explanation, owner, Slack draft, and incident summary
- mock enterprise ops dataset
- Prisma schema for Neon Postgres persistence
- Clerk-ready auth scaffolding
- CSV ingestion, validation, and GitHub-derived CSV generation
- GitHub and Slack webhook ingestion routes
- explainable scoring engine with optional Gemini refinement
- readiness and dashboard summary APIs

## Local setup

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm test
npm run build
```

Optional environment setup:

```bash
cp .env.example .env.local
```

Set:

```bash
GEMINI_API_KEY=your_google_ai_studio_key
DATABASE_URL=your_neon_postgres_connection_string
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your_slack_signing_secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

Prisma commands:

```bash
npm run prisma:generate
npm run db:push
```

## API surface

- `POST /api/analyze` generates the ops brief and optional persistence
- `POST /api/ingest/csv` ingests operational CSV data
- `POST /api/integrations/github` ingests GitHub webhook signals
- `POST /api/integrations/slack` ingests Slack webhook signals
- `POST /api/integrations/slack/dm` sends the escalation pack to a Slack DM by email lookup
- `POST /api/integrations/telegram/dm` sends the escalation pack to a Telegram chat
- `GET /api/dashboard/summary` hydrates the dashboard
- `POST /api/jobs/daily-sync` is the daily sync placeholder
- `GET /api/readiness` checks environment readinessnt summary.
4. Optionally trigger GitHub or Slack webhook samples for extra realism.

## GitHub auth

User authentication is handled through Clerk. To enable GitHub login for real users:

1. Configure `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
2. Enable the GitHub social connection in the Clerk dashboard.
3. Keep `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`.

Repository analysis uses the public GitHub API by default. `GITHUB_TOKEN` remains an optional server-side fallback for higher rate limits or private repository access.

## Telegram note

Telegram delivery requires `TELEGRAM_BOT_TOKEN`. If the recipient uses a username instead of a numeric chat ID, they must first open the bot and press Start so the bot can resolve their chat from recent updates.
# controlai
