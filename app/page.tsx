import Link from "next/link";
import { NavAuth } from "../components/nav-auth";
import { isClerkConfigured } from "../lib/env";

const features = [
  {
    title: "Risky release detection",
    description: "Surface services that combine stale PR queues, failed deployments, alert spikes, and escalation sentiment before the next deploy."
  },
  {
    title: "Blocked work triage",
    description: "Turn noisy GitHub and ticket backlog signals into an owner-ranked blocker queue instead of a wall of dashboards."
  },
  {
    title: "Incident hotspot monitoring",
    description: "Group repeated incidents and alert storms into service-level hotspots with clear explanations and next actions."
  },
  {
    title: "Agent-generated action briefs",
    description: "Generate today's ops brief, recommended owners, Slack escalations, and postmortem drafts from the same source signals."
  },
  {
    title: "Persistent command history",
    description: "Save report runs, source syncs, explanations, and generated interventions for enterprise auditability."
  },
  {
    title: "Gemini-powered refinement",
    description: "Use deterministic scoring for trust, then let Gemini rewrite the output into executive-ready language."
  }
];

export default function HomePage() {
  return (
    <main className="shell">
      <div className="container">
        <nav className="nav">
          <Link href="/" className="brand">
            <span className="brand-badge">C</span>
            <span>ControlTower AI</span>
          </Link>
          <div className="nav-links">
            <Link href="/workspace">Workspace</Link>
            <Link href="/dashboard">Dashboard</Link>
            <a href="#capabilities">Capabilities</a>
          </div>
          <NavAuth clerkConfigured={isClerkConfigured()} />
        </nav>

        <section className="hero">
          <article className="hero-card">
            <span className="eyebrow">Enterprise AI Ops • Release And Incident Command</span>
            <h1>Turn engineering noise into release decisions and operational action.</h1>
            <p>
              ControlTower AI is an enterprise operations command center for engineering teams. It ingests GitHub,
              Slack, and operational signals, detects risky releases, blocked work, and incident hotspots, then
              generates owner-ready actions, Slack escalations, and incident summaries.
            </p>
            <div className="actions">
              <Link href="/workspace" className="button button-primary">Open Workspace</Link>
              <Link href="/dashboard" className="button button-secondary">Open Dashboard</Link>
            </div>
          </article>

          <aside className="hero-side">
            <div className="panel">
              <h3>Primary use case</h3>
              <p className="muted">
                Help enterprise engineering teams decide what to ship, what to stop, and what to escalate before incidents and blockers spread.
              </p>
            </div>
            <div className="panel">
              <h3>Core workflow</h3>
              <p className="muted">
                Ingest signals, score operational risk, surface the top four panels, and let the agent generate the action brief for the day.
              </p>
            </div>
          </aside>
        </section>

        <section className="metric-grid">
          <div className="metric">
            <strong>4</strong>
            <span className="muted">Dashboard panels designed for judges: release risk, incident hotspots, blocked work, and action brief.</span>
          </div>
          <div className="metric">
            <strong>3</strong>
            <span className="muted">Daily automation outcomes: escalation drafts, incident summaries, and owner-prioritized action queues.</span>
          </div>
          <div className="metric">
            <strong>2</strong>
            <span className="muted">Decision modes: deterministic command scoring and Gemini-enhanced operator summaries.</span>
          </div>
        </section>

        <section id="capabilities">
          <h2 className="section-title">Command center capabilities</h2>
          <div className="feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <h3>{feature.title}</h3>
                <p className="muted">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="demo-grid" style={{ marginTop: 28 }}>
          <div className="panel">
            <h3>Demo flow</h3>
            <div className="stack muted">
              <div>Load the sample service dataset or ingest your own operational CSV.</div>
              <div>Generate the ops brief to surface risky releases, blocked work, and incident hotspots.</div>
              <div>Click an item to reveal explanation, owner, escalation message, and ops summary.</div>
            </div>
          </div>
          <div className="table-card">
            <h3>Live routes</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>/workspace</td>
                  <td>Ingest operational datasets and generate persisted command-center reports.</td>
                </tr>
                <tr>
                  <td>/dashboard</td>
                  <td>Review stored release risk, incident hotspots, blocker queues, and the latest action brief.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="footer">
          ControlTower AI is positioned as a practical intelligent enterprise solution: a trusted risk engine with an LLM-powered action layer on top.
        </div>
      </div>
    </main>
  );
}
