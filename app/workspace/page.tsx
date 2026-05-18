import Link from "next/link";
import { NavAuth } from "../../components/nav-auth";
import { OperationsClient } from "../../components/operations-client";
import { isClerkConfigured } from "../../lib/env";
import { teams, workerSignals } from "../../lib/mock-data";

export default function WorkspacePage() {
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
            <Link href="/dashboard">Dashboard</Link>
            <span>Workspace</span>
          </div>
          <NavAuth clerkConfigured={isClerkConfigured()} />
        </nav>

        <section className="hero" style={{ paddingBottom: 24 }}>
          <article className="hero-card">
            <span className="eyebrow">Operations Workspace</span>
            <h1>Ingest engineering signals, score operational risk, and generate today&apos;s action brief.</h1>
            <p>
              This workspace is the functional command surface for ControlTower AI. Use it to load release and incident datasets,
              persist them to Neon, run explainable scoring, and produce judge-friendly escalations and postmortem drafts.
            </p>
          </article>
          <aside className="hero-side">
            <div className="panel">
              <h3>Workflow</h3>
              <p className="muted">
                1. Ingest GitHub, Slack, or CSV operational slices. 2. Persist source records. 3. Generate the ops brief.
                4. Review risky releases, blocked work, incident hotspots, and action recommendations.
              </p>
            </div>
          </aside>
        </section>

        <OperationsClient workers={workerSignals} teams={teams} />
      </div>
    </main>
  );
}
