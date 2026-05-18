"use client";

import { useMemo, useState } from "react";
import type { DashboardSummary, RiskAssessment } from "../lib/types";

function riskTone(score: number) {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function averageRisk(risks: RiskAssessment[]) {
  if (risks.length === 0) return 0;
  return Math.round((risks.reduce((sum, risk) => sum + risk.riskScore, 0) / risks.length) * 10) / 10;
}

function releaseDecision(summary: DashboardSummary) {
  const report = summary.latestReport;
  if (!report || report.risks.length === 0) {
    return { label: "Awaiting data", tone: "low", summary: "Run a sync to generate a release decision." };
  }

  const highRiskCount = report.risks.filter((risk) => risk.riskLevel === "high").length;
  const mediumRiskCount = report.risks.filter((risk) => risk.riskLevel === "medium").length;

  if (highRiskCount > 0) {
    return { label: "NO-GO", tone: "high", summary: `${highRiskCount} high-risk slices block the next release.` };
  }

  if (mediumRiskCount > 0) {
    return { label: "CAUTION", tone: "medium", summary: `${mediumRiskCount} medium-risk slices need owner review.` };
  }

  return { label: "GO", tone: "low", summary: "No material release blockers are currently detected." };
}

function analyzedSampleNote(primarySource: DashboardSummary["sourceStatuses"][number] | undefined) {
  const metadata = primarySource?.metadata;
  if (!metadata) return null;

  const openPrs = metadata.analyzedOpenPullRequests ?? 0;
  const openIssues = metadata.analyzedOpenIssues ?? 0;
  const closedPrs = metadata.analyzedClosedPullRequests ?? 0;
  const closedIssues = metadata.analyzedClosedIssues ?? 0;

  return `Totals reflect full GitHub counts. Detailed scoring used the most recent ${openPrs} open PRs, ${openIssues} open issues, ${closedPrs} closed PRs, and ${closedIssues} closed issues.`;
}

function repoIntelligenceDetails(details: unknown) {
  if (Array.isArray(details)) {
    return details.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof details === "string" && details.trim().length > 0) {
    return [details.trim()];
  }

  return [];
}

function PersistedAnalysisVisuals({
  summary,
  primarySource
}: {
  summary: DashboardSummary;
  primarySource: DashboardSummary["sourceStatuses"][number] | undefined;
}) {
  const risks = summary.latestReport?.risks || [];
  const average = averageRisk(risks);
  const total = Math.max(risks.length, 1);
  const releaseCount = risks.filter((risk) => risk.category === "release").length;
  const incidentCount = risks.filter((risk) => risk.category === "incident").length;
  const blockedCount = risks.filter((risk) => risk.category === "blocked").length;
  const sampleNote = analyzedSampleNote(primarySource);
  const repoMetricMax = Math.max(
    primarySource?.metadata?.mergedPullRequests ?? 0,
    primarySource?.metadata?.openPullRequests ?? 0,
    primarySource?.metadata?.openIssues ?? 0,
    primarySource?.metadata?.closedIssues ?? 0,
    1
  );

  return (
    <div className="stack">
      <div className="table-card">
        <h3>GitHub history snapshot</h3>
        <div className="metric-grid compact-metric-grid">
          <div className="metric">
            <strong>{primarySource?.metadata?.openPullRequests ?? 0}</strong>
            <span className="muted">Open PRs</span>
          </div>
          <div className="metric">
            <strong>{primarySource?.metadata?.mergedPullRequests ?? 0}</strong>
            <span className="muted">Merged PRs</span>
          </div>
          <div className="metric">
            <strong>{primarySource?.metadata?.openIssues ?? 0}</strong>
            <span className="muted">Open issues</span>
          </div>
          <div className="metric">
            <strong>{primarySource?.metadata?.closedIssues ?? 0}</strong>
            <span className="muted">Previously closed issues</span>
          </div>
        </div>
        {sampleNote ? <p className="muted" style={{ marginTop: 12 }}>{sampleNote}</p> : null}
      </div>

      <section className="visual-grid">
        <div className="table-card">
          <h3>Operational risk gauge</h3>
          <div className="gauge-wrap">
            <div
              className={`gauge-ring gauge-ring-${riskTone(average)}`}
              style={{ ["--gauge-fill" as string]: `${average}%` }}
            >
              <div className="gauge-center">
                <strong>{average}</strong>
                <span className="muted">Avg risk</span>
              </div>
            </div>
            <p className="muted">Average command risk across the persisted dashboard slice.</p>
          </div>
        </div>

        <div className="table-card">
          <h3>Signal mix</h3>
          <div className="stack">
            {[
              { label: "Release", value: releaseCount, tone: "low" },
              { label: "Incident", value: incidentCount, tone: "high" },
              { label: "Blocked", value: blockedCount, tone: "medium" }
            ].map((item) => (
              <div key={item.label} className="viz-row">
                <div className="viz-row-label">
                  <strong>{item.label}</strong>
                  <span className="muted">{item.value} items</span>
                </div>
                <div className="viz-bar-track">
                  <div
                    className={`viz-bar-fill viz-bar-fill-${item.tone}`}
                    style={{ width: `${(item.value / total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="table-card">
          <h3>Repo work summary</h3>
          <div className="stack">
            <div className="viz-row">
              <div className="viz-row-label">
                <strong>PR throughput</strong>
                <span className="muted">{primarySource?.metadata?.mergedPullRequests ?? 0} merged</span>
              </div>
              <div className="viz-bar-track">
                <div
                  className="viz-bar-fill viz-bar-fill-low"
                  style={{
                    width: `${Math.min(
                      100,
                      ((((primarySource?.metadata?.mergedPullRequests ?? 0) + (primarySource?.metadata?.openPullRequests ?? 0)) / repoMetricMax) * 100)
                    )}%`
                  }}
                />
              </div>
            </div>
            <div className="viz-row">
              <div className="viz-row-label">
                <strong>Issue load</strong>
                <span className="muted">{primarySource?.metadata?.openIssues ?? 0} open</span>
              </div>
              <div className="viz-bar-track">
                <div
                  className="viz-bar-fill viz-bar-fill-medium"
                  style={{ width: `${Math.min(100, (((primarySource?.metadata?.openIssues ?? 0) / repoMetricMax) * 100))}%` }}
                />
              </div>
            </div>
            <div className="viz-row">
              <div className="viz-row-label">
                <strong>Closed issue history</strong>
                <span className="muted">{primarySource?.metadata?.closedIssues ?? 0} closed</span>
              </div>
              <div className="viz-bar-track">
                <div
                  className="viz-bar-fill viz-bar-fill-high"
                  style={{ width: `${Math.min(100, (((primarySource?.metadata?.closedIssues ?? 0) / repoMetricMax) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Panel({
  title,
  items,
  selectedId,
  onSelect
}: {
  title: string;
  items: RiskAssessment[];
  selectedId: string | null;
  onSelect: (risk: RiskAssessment) => void;
}) {
  return (
    <div className="table-card">
      <h3>{title}</h3>
      <div className="stack">
        {items.length === 0 ? (
          <p className="muted">No current items in this panel.</p>
        ) : (
          items.map((risk) => (
            <button
              type="button"
              key={risk.workerId}
              className={`risk-button${selectedId === risk.workerId ? " risk-button-active" : ""}`}
              onClick={() => onSelect(risk)}
            >
              <span>
                <strong>{risk.workerName}</strong>
                <span className="muted">{risk.team}</span>
              </span>
              <span className={`pill pill-${risk.riskLevel}`}>{risk.riskScore}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function DashboardPanels({
  summary,
  role
}: {
  summary: DashboardSummary;
  role: "contributor" | "manager" | "admin";
}) {
  const selectedSeed = summary.latestReport?.risks[0] || null;
  const [selectedRisk, setSelectedRisk] = useState<RiskAssessment | null>(selectedSeed);
  const [showVisuals, setShowVisuals] = useState(false);

  const categorized = useMemo(() => {
    const risks = summary.latestReport?.risks || [];
    return {
      release: risks.filter((risk) => risk.category === "release").slice(0, 3),
      incident: risks.filter((risk) => risk.category === "incident").slice(0, 3),
      blocked: risks.filter((risk) => risk.category === "blocked").slice(0, 3)
    };
  }, [summary.latestReport]);
  const primarySource = summary.sourceStatuses.find((source) => source.metadata?.repoFullName) || summary.sourceStatuses[0];
  const decision = releaseDecision(summary);
  const topBlockedRisk = summary.latestReport?.risks.find((risk) => risk.category === "blocked") || null;
  const topIncidentRisk = summary.latestReport?.risks.find((risk) => risk.category === "incident") || null;
  const repoInsightDetails = repoIntelligenceDetails(summary.latestReport?.repoIntelligence?.details);

  return (
    <div className="stack">
      <section className="decision-card">
        <div>
          <span className={`pill pill-${decision.tone}`}>Release decision</span>
          <h2>{decision.label}</h2>
          <p className="muted">{decision.summary}</p>
        </div>
        {primarySource?.metadata?.repoFullName ? (
          <div className="decision-stats">
            <div className="callout">
              <strong>{primarySource.metadata.repoFullName}</strong>
              <p className="muted">
                PRs {primarySource.metadata.openPullRequests ?? 0} • Issues {primarySource.metadata.openIssues ?? 0} • Last push{" "}
                {primarySource.metadata.lastPushAt ? new Date(primarySource.metadata.lastPushAt).toLocaleString() : "unknown"}
              </p>
            </div>
            <div className="mini-actions">
              <span className={`pill pill-${primarySource.metadata.maintainerEffortRating || "low"}`}>
                Maintainers {primarySource.metadata.maintainerEffortScore ?? 0}
              </span>
              <span className={`pill pill-${primarySource.metadata.contributorEffortRating || "low"}`}>
                Contributors {primarySource.metadata.contributorEffortScore ?? 0}
              </span>
              {(primarySource.metadata.topContributors || []).map((contributor) => (
                <span key={contributor} className="pill pill-low">{contributor}</span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {primarySource?.metadata?.repoFullName ? (
        <div className="repo-summary-row">
          <span className="muted">
            Analyzing <strong>{primarySource.metadata.repoFullName}</strong> on branch{" "}
            <strong>{primarySource.metadata.defaultBranch || "unknown"}</strong>
          </span>
        </div>
      ) : null}

      {(topBlockedRisk || topIncidentRisk) ? (
        <section className="two-column-grid">
          {topBlockedRisk ? (
            <div className="callout">
              <strong>Top blocker</strong>
              <p className="muted">{topBlockedRisk.workerName} • {topBlockedRisk.team}</p>
            </div>
          ) : null}
          {topIncidentRisk ? (
            <div className="callout">
              <strong>Top incident</strong>
              <p className="muted">{topIncidentRisk.workerName} • {topIncidentRisk.team}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="table-card">
        <div className="viz-row-label">
          <div>
            <h3>Analysis feedback</h3>
            <p className="muted">Review persisted visuals for merged work, open issues, PR load, and risk distribution.</p>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setShowVisuals((value) => !value)}
          >
            {showVisuals ? "Hide Analysis" : "View Analysis"}
          </button>
        </div>
      </div>

      {showVisuals ? <PersistedAnalysisVisuals summary={summary} primarySource={primarySource} /> : null}

      <section className="metric-grid">
        <div className="metric">
          <strong>{summary.workerCount}</strong>
          <span className="muted">Service slices tracked</span>
        </div>
        <div className="metric">
          <strong>{summary.sourceStatuses.length}</strong>
          <span className="muted">Connected sources</span>
        </div>
        <div className="metric">
          <strong>{summary.latestReport?.risks.filter((risk) => risk.riskLevel === "high").length || 0}</strong>
          <span className="muted">High-risk items in latest run</span>
        </div>
      </section>

      <div className="four-panel-grid">
        <Panel
          title="Release risk"
          items={categorized.release}
          selectedId={selectedRisk?.workerId || null}
          onSelect={setSelectedRisk}
        />
        <Panel
          title="Incident hotspots"
          items={categorized.incident}
          selectedId={selectedRisk?.workerId || null}
          onSelect={setSelectedRisk}
        />
        <Panel
          title="Blocked work"
          items={categorized.blocked}
          selectedId={selectedRisk?.workerId || null}
          onSelect={setSelectedRisk}
        />
        <div className="table-card">
          <h3>Agent-generated action brief</h3>
          <div className="stack">
            {(summary.latestReport?.interventions || []).map((item) => (
              <div key={item} className="callout">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedRisk ? (
        <div className="table-card">
          <h3>{role === "contributor" ? "Selected service detail" : "Selected risk detail"}</h3>
          <div className="two-column-grid">
            <div className="stack">
              <div className="callout">
                <strong>{selectedRisk.workerName}</strong>
                <p className="muted">{selectedRisk.explanation}</p>
                <div className="mini-actions">
                  <span className={`pill pill-${selectedRisk.riskLevel}`}>{selectedRisk.category} • {selectedRisk.riskScore}</span>
                  <span className="pill pill-low">Owner {selectedRisk.recommendedOwner}</span>
                </div>
              </div>
              <div className="callout">
                <strong>Recommended action</strong>
                <p className="muted">{selectedRisk.recommendation}</p>
              </div>
            </div>
            <div className="stack">
              <div className="callout">
                <strong>Escalation message</strong>
                <p className="muted">{selectedRisk.draftSlackEscalation}</p>
                <div className="mini-actions" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      fetch("/api/integrations/slack/dm", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: selectedRisk.recommendedOwner, risk: selectedRisk })
                      });
                    }}
                  >
                    Escalate to Slack
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      fetch("/api/integrations/telegram/dm", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ recipient: selectedRisk.recommendedOwner, risk: selectedRisk })
                      });
                    }}
                  >
                    Escalate to Telegram
                  </button>
                </div>
              </div>
              <div className="callout">
                <strong>Ops summary / postmortem</strong>
                <p className="muted">{selectedRisk.draftSummary}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="two-column-grid">
        <div className="table-card">
          <h3>Latest ops brief</h3>
          {summary.latestReport ? (
            <div className="stack">
              <p className="muted">{summary.latestReport.orgSummary}</p>
              <p className="muted">{summary.latestReport.teamSummary}</p>
              {summary.latestReport.repoIntelligence ? (
                <div className="callout">
                  <strong>Repo intelligence</strong>
                  <p className="muted">{summary.latestReport.repoIntelligence.headline}</p>
                  {repoInsightDetails.length > 0 ? (
                    <div className="stack" style={{ marginTop: 10 }}>
                      {repoInsightDetails.map((item) => (
                        <div key={item} className="muted">{item}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="callout">
                <strong>Summary engine status</strong>
                <p className="muted">{summary.latestReport.summaryStatus.detail}</p>
                {summary.latestReport.summaryStatus.error ? (
                  <p className="muted">Gemini error: {summary.latestReport.summaryStatus.error}</p>
                ) : null}
              </div>
              <div className="mini-actions">
                <span className={`pill pill-${riskTone(summary.latestReport.risks[0]?.riskScore || 0)}`}>
                  {summary.latestReport.mode.toUpperCase()}
                </span>
                <span className="pill pill-low">{new Date(summary.latestReport.generatedAt).toLocaleString()}</span>
                {primarySource?.metadata?.repoFullName ? <span className="pill pill-low">{primarySource.metadata.repoFullName}</span> : null}
              </div>
            </div>
          ) : (
            <p className="muted">No persisted report yet.</p>
          )}
        </div>

        <div className="table-card">
          <h3>Source connections</h3>
          <div className="stack">
            {summary.sourceStatuses.map((source) => (
              <div key={source.provider} className="audit-row">
                <strong>{source.provider}</strong>
                <span className="muted">{source.status} • {source.lastSyncedAt ? new Date(source.lastSyncedAt).toLocaleString() : "never synced"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="table-card">
        <h3>Operational source snapshots</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Service slice</th>
              <th>Domain</th>
              <th>Review delay</th>
              <th>Release risk</th>
              <th>Runbook score</th>
              <th>Escalation score</th>
            </tr>
          </thead>
          <tbody>
            {summary.latestWorkers.map((worker) => (
              <tr key={worker.id}>
                <td>
                  <strong>{worker.name}</strong>
                  <div className="muted">{worker.role}</div>
                </td>
                <td>{worker.team}</td>
                <td>{worker.reviewLatencyHours}h</td>
                <td>{worker.afterHoursWorkPct}%</td>
                <td>{worker.focusHoursPerDay}</td>
                <td>{worker.asyncSentimentScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
