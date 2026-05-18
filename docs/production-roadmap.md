# ControlTower AI Roadmap

## Product direction

ControlTower AI is an enterprise engineering operations command center. The production version should help:

- release managers decide what is safe to ship
- platform teams detect repeated incidents and alert hotspots
- engineering leaders clear blocked work before it spreads across teams
- operators generate trusted escalations, summaries, and postmortem drafts faster

## Recommended architecture

- `Frontend`: Next.js App Router
- `Auth`: Clerk with role-aware access
- `Database`: Postgres with Prisma
- `Jobs`: scheduled ingestion, normalization, and briefing workers
- `Integrations`: GitHub, Slack, Jira, PagerDuty, deploy logs
- `AI`: deterministic scoring for the canonical risk engine, Gemini refinement for action briefs and summaries

## Target data model

- `organizations`
- `service_slices`
- `source_connections`
- `sync_runs`
- `signal_snapshots`
- `risk_reports`
- `report_items`
- `manager_briefs`
- `interventions`
- `audit_events`

## Phased delivery

### Phase 1

- ship the four-panel hackathon dashboard
- support CSV and webhook ingestion
- persist reports and generated action drafts
- show explanation, owner, Slack draft, and incident summary per flagged item

### Phase 2

- add GitHub OAuth or app installation flows
- add Jira, PagerDuty, and deployment log ingestion
- attach service, environment, and repo metadata to every operational slice

### Phase 3

- trigger live Slack escalations and release gate checks
- add trend history and anomaly tracking
- generate postmortem templates with issue timelines and owner attribution

## Guardrails

- prefer explainable risk signals over opaque scoring
- preserve an audit trail for every sync, report, and generated recommendation
- keep AI in the action layer while deterministic logic remains the trust layer
