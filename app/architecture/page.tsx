import Link from "next/link";
import { NavAuth } from "../../components/nav-auth";
import { isClerkConfigured } from "../../lib/env";

const stack = [
  {
    layer: "Frontend",
    choice: "Next.js App Router",
    detail: "A command-center interface for release risk, incident hotspots, blocked work, and AI-generated action briefs."
  },
  {
    layer: "Authentication",
    choice: "Clerk",
    detail: "Role-aware access for operators, service owners, and executives."
  },
  {
    layer: "Database",
    choice: "Postgres + Prisma",
    detail: "Persistent storage for service slices, source connections, sync runs, reports, generated drafts, and audit logs."
  },
  {
    layer: "Integrations",
    choice: "GitHub, Slack, Jira, PagerDuty, deploy logs",
    detail: "Enterprise operational signals normalized into a shared scoring model."
  },
  {
    layer: "Jobs",
    choice: "Scheduled ingestion and report generation",
    detail: "Daily brief generation, release checks, hotspot detection, and automated escalations."
  },
  {
    layer: "AI",
    choice: "Heuristics first, Gemini second",
    detail: "Deterministic operational scoring with LLM-generated action briefs, escalation drafts, and incident summaries."
  }
];

const roadmap = [
  {
    phase: "Phase 1",
    title: "Hackathon command center",
    items: [
      "Reframe the product around release operations instead of people analytics.",
      "Ship the four-panel dashboard with interactive issue drill-down.",
      "Generate owner, Slack escalation, and incident summary outputs from one report run."
    ]
  },
  {
    phase: "Phase 2",
    title: "Live source integrations",
    items: [
      "Add GitHub OAuth or app installation instead of webhook-only ingestion.",
      "Pull Slack, Jira, PagerDuty, and deployment signals on a schedule.",
      "Attach repo, environment, and severity metadata to every slice."
    ]
  },
  {
    phase: "Phase 3",
    title: "Enterprise automation",
    items: [
      "Trigger real Slack escalations and release gate recommendations.",
      "Generate postmortem skeletons and ownership trails automatically.",
      "Add trend history, blast radius hints, and audit dashboards."
    ]
  }
];

export default function ArchitecturePage() {
  return (
    <main className="shell">
      <div className="container">
        <nav className="nav">
          <Link href="/" className="brand">
            <span className="brand-badge">C</span>
            <span>ControlTower AI</span>
          </Link>
          <div className="nav-links">
            <Link href="/">Overview</Link>
            <Link href="/workspace">Workspace</Link>
            <Link href="/dashboard">Dashboard</Link>
            <span>Architecture</span>
          </div>
          <NavAuth clerkConfigured={isClerkConfigured()} />
        </nav>

        <section className="hero" style={{ paddingBottom: 24 }}>
          <article className="hero-card">
            <span className="eyebrow">Architecture And Demo Schema</span>
            <h1>From noisy engineering signals to an intelligent enterprise operations layer.</h1>
            <p>
              ControlTower AI is structured as a practical enterprise deployment story: deterministic scoring for trust,
              persistent audit trails for governance, and Gemini-generated operational drafts for speed.
            </p>
            <div className="actions">
              <Link href="/workspace" className="button button-primary">Open Workspace</Link>
              <Link href="/" className="button button-secondary">Back to Overview</Link>
            </div>
          </article>
          <aside className="hero-side">
            <div className="panel">
              <h3>Core principle</h3>
              <p className="muted">
                Use AI to reduce operational latency, not to replace trusted release and incident workflows.
              </p>
            </div>
            <div className="panel">
              <h3>Data strategy</h3>
              <p className="muted">
                Normalize live GitHub and other operational feeds into one persisted ops dataset that the workspace can inspect, export, and score.
              </p>
            </div>
          </aside>
        </section>

        <section className="table-card" style={{ marginBottom: 24 }}>
          <h3>Recommended stack</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Choice</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {stack.map((item) => (
                <tr key={item.layer}>
                  <td><strong>{item.layer}</strong></td>
                  <td>{item.choice}</td>
                  <td className="muted">{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="feature-grid" style={{ marginBottom: 32 }}>
          {roadmap.map((phase) => (
            <article key={phase.phase} className="feature-card">
              <h3>{phase.phase}: {phase.title}</h3>
              <div className="stack muted">
                {phase.items.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="two-column-grid">
          <div className="table-card">
            <h3>Current operational panels</h3>
            <div className="stack muted">
              <div>Release risk</div>
              <div>Incident hotspots</div>
              <div>Blocked work</div>
              <div>Agent-generated action brief</div>
            </div>
          </div>
          <div className="table-card">
            <h3>Generated outputs</h3>
            <div className="stack muted">
              <div>Owner recommendations</div>
              <div>Escalation messages for delivery channels</div>
              <div>Ops summaries and postmortems</div>
              <div>Audit trail of why a slice was flagged</div>
            </div>
          </div>
        </section>

        <div className="footer">
          The hackathon story is now an intelligent enterprise operations solution rather than a people-analytics product.
        </div>
      </div>
    </main>
  );
}
