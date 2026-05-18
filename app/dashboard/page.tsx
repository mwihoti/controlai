import Link from "next/link";
import { DashboardPanels } from "../../components/dashboard-panels";
import { NavAuth } from "../../components/nav-auth";
import { getAuthContext } from "../../lib/auth";
import { defaultOrganizationSlug, isClerkConfigured, isDatabaseConfigured } from "../../lib/env";
import { isDatabaseConnectionError } from "../../lib/db";
import { loadDashboardSummary, upsertAppUser } from "../../lib/repository";

function fallbackRole(searchParams: { role?: string }) {
  const role = searchParams.role || "manager";
  return role === "admin" || role === "contributor" ? role : "manager";
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ organizationSlug?: string; role?: string }>;
}) {
  const resolved = await searchParams;
  const organizationSlug = resolved.organizationSlug || defaultOrganizationSlug();
  const authContext = await getAuthContext();
  const role = fallbackRole({ role: resolved.role });
  let databaseUnavailable = false;

  if (authContext.enabled && authContext.email) {
    try {
      await upsertAppUser({
        organizationSlug,
        clerkUserId: authContext.userId,
        email: authContext.email,
        name: authContext.name,
        role
      });
    } catch (error) {
      if (isDatabaseConnectionError(error)) {
        databaseUnavailable = true;
      } else {
        throw error;
      }
    }
  }

  let summary = null;
  if (isDatabaseConfigured() && !databaseUnavailable) {
    try {
      summary = await loadDashboardSummary(organizationSlug);
    } catch (error) {
      if (isDatabaseConnectionError(error)) {
        databaseUnavailable = true;
      } else {
        throw error;
      }
    }
  }

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
            <span>Dashboard</span>
          </div>
          <NavAuth clerkConfigured={isClerkConfigured()} />
        </nav>

        <section className="hero" style={{ paddingBottom: 24 }}>
          <article className="hero-card">
            <span className="eyebrow">Engineering Ops Command Center</span>
            <h1>{role === "contributor" ? "Service-level operations view." : role === "admin" ? "Executive release operations view." : "Operator intervention view."}</h1>
            <p>
              The dashboard surfaces risky releases, blocked PRs, incident hotspots, and agent-generated actions from persisted GitHub,
              Slack, and operational snapshots. Clerk-enhanced identity is
              {isClerkConfigured() ? " enabled." : " currently not configured, so role fallback is query-param based."}
            </p>
            <div className="actions">
              <Link href={`/dashboard?organizationSlug=${organizationSlug}&role=contributor`} className="button button-secondary">Service</Link>
              <Link href={`/dashboard?organizationSlug=${organizationSlug}&role=manager`} className="button button-secondary">Operator</Link>
              <Link href={`/dashboard?organizationSlug=${organizationSlug}&role=admin`} className="button button-secondary">Executive</Link>
            </div>
          </article>
          <aside className="hero-side">
            <div className="panel">
              <h3>Organization</h3>
              <p className="muted">{summary?.organization.name || organizationSlug}</p>
            </div>
            <div className="panel">
              <h3>Readiness</h3>
              <p className="muted">
                Database: {databaseUnavailable ? "unreachable" : isDatabaseConfigured() ? "configured" : "missing"}<br />
                Clerk: {isClerkConfigured() ? "configured" : "pending keys"}
              </p>
            </div>
          </aside>
        </section>

        {!isDatabaseConfigured() ? (
          <div className="table-card">
            <h3>Database not configured</h3>
            <p className="muted">Set `DATABASE_URL` to enable persisted release risk, blocker queues, incident hotspots, and report history.</p>
          </div>
        ) : databaseUnavailable ? (
          <div className="table-card">
            <h3>Database temporarily unavailable</h3>
            <p className="muted">
              ControlTower AI could not reach Neon from the current runtime. The dashboard is still available, but persisted
              source status and command-center history cannot be loaded until the database connection is restored.
            </p>
          </div>
        ) : !summary ? (
          <div className="table-card">
            <h3>No data ingested yet</h3>
            <p className="muted">Use the workspace with persistence enabled, POST CSV to `/api/ingest/csv`, or send GitHub and Slack webhooks to start populating this dashboard.</p>
          </div>
        ) : (
          <DashboardPanels summary={summary} role={role} />
        )}
      </div>
    </main>
  );
}
