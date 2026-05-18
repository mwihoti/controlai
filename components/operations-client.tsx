"use client";

import { useEffect, useMemo, useState } from "react";
import { parseWorkerCsv, sampleCsvTemplate, serializeWorkerCsv } from "../lib/csv";
import type { AnalysisResponse, RankedRepoItem, RiskAssessment, ShareableInsight, SourceMetadata, TeamMetric, WorkerSignal } from "../lib/types";

interface OutboundShareOption {
  id: string;
  title: string;
  description: string;
  content: string;
}

interface TelegramRecipientOption {
  chatId: string;
  username?: string;
  displayName: string;
}

function averageRisk(risks: AnalysisResponse["risks"]) {
  if (risks.length === 0) return 0;
  return Math.round((risks.reduce((sum, risk) => sum + risk.riskScore, 0) / risks.length) * 10) / 10;
}

function readinessTone(score: number) {
  if (score >= 80) return "low";
  if (score >= 60) return "medium";
  return "high";
}

function riskTone(score: number) {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function panelRisks(analysis: AnalysisResponse | null, category: RiskAssessment["category"]) {
  if (!analysis) return [];
  return analysis.risks.filter((risk) => risk.category === category).slice(0, 3);
}

function analyzedSampleNote(metadata: SourceMetadata | null) {
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

function formatRankedTimestamp(value?: string) {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

function rankedItemMeta(item: RankedRepoItem) {
  const bits = [
    item.author ? `by ${item.author}` : null,
    item.ageDays !== undefined ? `${item.ageDays}d old` : null,
    item.comments !== undefined ? `${item.comments} comments` : null,
    item.mergedAt ? `merged ${formatRankedTimestamp(item.mergedAt)}` : null,
    item.closedAt ? `closed ${formatRankedTimestamp(item.closedAt)}` : null
  ].filter(Boolean);
  return bits.join(" • ");
}

function buildRiskDetailContent(risk: RiskAssessment) {
  return [
    `ControlTower AI risk detail`,
    ``,
    `Service: ${risk.workerName}`,
    `Domain: ${risk.team}`,
    `Category: ${risk.category}`,
    `Risk: ${risk.riskLevel.toUpperCase()} (${risk.riskScore})`,
    `Owner: ${risk.recommendedOwner}`,
    ``,
    `Why flagged`,
    risk.explanation,
    ``,
    `Recommended action`,
    risk.recommendation,
    ``,
    `Escalation message`,
    risk.draftSlackEscalation,
    ``,
    `Ops summary`,
    risk.draftSummary
  ].join("\n");
}

function releaseDecision(report: AnalysisResponse | null) {
  if (!report || report.risks.length === 0) {
    return { label: "Awaiting data", tone: "low", summary: "Sync a repo or ingest a dataset to produce a release decision." };
  }

  const highRiskCount = report.risks.filter((risk) => risk.riskLevel === "high").length;
  const mediumRiskCount = report.risks.filter((risk) => risk.riskLevel === "medium").length;

  if (highRiskCount > 0) {
    return {
      label: "NO-GO",
      tone: "high",
      summary: `${highRiskCount} high-risk slices require intervention before the next release window.`
    };
  }

  if (mediumRiskCount > 0) {
    return {
      label: "CAUTION",
      tone: "medium",
      summary: `${mediumRiskCount} medium-risk slices need blocker review before shipping.`
    };
  }

  return {
    label: "GO",
    tone: "low",
    summary: "No material release blockers are currently detected."
  };
}

function renderTeamMetric(metric: TeamMetric) {
  return (
    <tr key={metric.team}>
      <td>
        <strong>{metric.team}</strong>
      </td>
      <td>{metric.workerCount}</td>
      <td>{metric.averageReviewLatencyHours}h</td>
      <td>{metric.averageAfterHoursWorkPct}%</td>
      <td>{metric.averageOnCallPages}</td>
      <td>
        <span className={`pill pill-${riskTone(metric.averageRiskScore)}`}>
          {metric.averageRiskScore}
        </span>
      </td>
    </tr>
  );
}

function AnalysisVisuals({ analysis }: { analysis: AnalysisResponse }) {
  const average = averageRisk(analysis.risks);
  const total = Math.max(analysis.risks.length, 1);
  const releaseCount = analysis.risks.filter((risk) => risk.category === "release").length;
  const incidentCount = analysis.risks.filter((risk) => risk.category === "incident").length;
  const blockedCount = analysis.risks.filter((risk) => risk.category === "blocked").length;

  return (
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
          <p className="muted">Average command risk across the current domain slice.</p>
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
        <h3>Domain comparison</h3>
        <div className="stack">
          {analysis.teamMetrics.slice(0, 5).map((metric) => (
            <div key={metric.team} className="viz-row">
              <div className="viz-row-label">
                <strong>{metric.team}</strong>
                <span className="muted">{metric.averageRiskScore} risk</span>
              </div>
              <div className="viz-bar-track">
                <div
                  className={`viz-bar-fill viz-bar-fill-${riskTone(metric.averageRiskScore)}`}
                  style={{ width: `${metric.averageRiskScore}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RiskList({
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
          <p className="muted">No items detected in this panel for the current slice.</p>
        ) : (
          items.map((risk) => (
            <button
              key={risk.workerId}
              type="button"
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

export function OperationsClient({ workers, teams }: { workers: WorkerSignal[]; teams: string[] }) {
  const [team, setTeam] = useState("All Domains");
  const [prompt, setPrompt] = useState(
    "Detect blocked PRs, stale tickets, repeated incidents, and risky releases. Generate today's action brief and draft escalation language."
  );
  const [githubUrl, setGithubUrl] = useState("https://github.com/vercel/next.js");
  const [csvInput, setCsvInput] = useState(sampleCsvTemplate);
  const [dataset, setDataset] = useState<WorkerSignal[]>(workers);
  const [sourceLabel, setSourceLabel] = useState("Bundled demo dataset");
  const [repoStats, setRepoStats] = useState<SourceMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slackEmail, setSlackEmail] = useState("");
  const [slackSending, setSlackSending] = useState(false);
  const [slackStatus, setSlackStatus] = useState<string | null>(null);
  const [telegramRecipient, setTelegramRecipient] = useState("");
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [telegramRecipients, setTelegramRecipients] = useState<TelegramRecipientOption[]>([]);
  const [telegramRecipientsLoading, setTelegramRecipientsLoading] = useState(false);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{
    hasClerk: boolean;
    hasDatabase: boolean;
    databaseReachable: boolean | null;
    hasGeminiKey?: boolean;
    hasGitHubToken?: boolean;
    hasSlackBotToken?: boolean;
    hasTelegramBotToken?: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReadiness() {
      try {
        const response = await fetch("/api/readiness", { cache: "no-store" });
        const payload = (await response.json()) as {
          hasClerk: boolean;
          hasDatabase: boolean;
          databaseReachable: boolean | null;
          hasGeminiKey?: boolean;
          hasGitHubToken?: boolean;
          hasSlackBotToken?: boolean;
          hasTelegramBotToken?: boolean;
        };
        if (!cancelled) {
          setReadiness(payload);
        }
      } catch {
        if (!cancelled) {
          setReadiness(null);
        }
      }
    }

    void loadReadiness();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableTeams = useMemo(() => {
    const dynamicTeams = [...new Set(dataset.map((worker) => worker.team))];
    return ["All Domains", ...dynamicTeams];
  }, [dataset]);

  const filteredWorkers = useMemo(() => {
    return team === "All Domains" ? dataset : dataset.filter((worker) => worker.team === team);
  }, [dataset, team]);

  async function requestAnalysis(workersToAnalyze: WorkerSignal[]) {
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          workers: workersToAnalyze,
          organizationSlug: "primary-org",
          organizationName: "ControlTower AI Primary Org",
          provider: "workspace",
          persist: true,
          sourceMetadata: repoStats || undefined
        })
      });

      const payload = (await response.json()) as AnalysisResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Analysis failed");
      }

      const nextAnalysis = payload as AnalysisResponse;
      setAnalysis(nextAnalysis);
      setSelectedRisk(nextAnalysis.risks[0] || null);
      setSelectedInsightId("local-repo-intelligence");
      setSlackStatus(null);
      setTelegramStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      await requestAnalysis(filteredWorkers);
    } finally {
      setLoading(false);
    }
  }

  async function ingestCsvDataset() {
    setLoading(true);
    setError(null);
    try {
      const ingestResponse = await fetch("/api/ingest/csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          csv: csvInput,
          organizationSlug: "primary-org",
          organizationName: "ControlTower AI Primary Org"
        })
      });

      const ingestPayload = (await ingestResponse.json()) as { error?: string };
      if (!ingestResponse.ok) {
        throw new Error(ingestPayload.error || "CSV ingestion failed");
      }

      const parsed = parseWorkerCsv(csvInput);
      setDataset(parsed);
      setTeam("All Domains");
      setSourceLabel(repoStats?.repoFullName ? `GitHub-derived ops CSV • ${repoStats.repoFullName}` : "CSV operational dataset");
      setSlackStatus(null);
      setTelegramStatus(null);
      await requestAnalysis(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ingest CSV");
    } finally {
      setLoading(false);
    }
  }

  function loadSampleDataset() {
    setDataset(workers);
    setTeam("All Domains");
    setAnalysis(null);
    setSelectedRisk(null);
    setError(null);
    setSourceLabel("Bundled demo dataset");
    setRepoStats(null);
    setSlackStatus(null);
    setTelegramStatus(null);
  }

  async function loadGitHubDataset() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/github/live", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          repoUrl: githubUrl,
          organizationSlug: "primary-org",
          organizationName: "ControlTower AI Primary Org",
          persist: true,
          prompt
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        repo?: { full_name?: string; pushed_at?: string; default_branch?: string };
        sourceDetails?: SourceMetadata;
        authSource?: string;
        workers?: WorkerSignal[];
        report?: AnalysisResponse;
      };

      if (!response.ok || !payload.workers || !payload.report) {
        throw new Error(payload.error || "GitHub live sync failed");
      }

      setDataset(payload.workers);
      setCsvInput(serializeWorkerCsv(payload.workers));
      setTeam("All Domains");
      setAnalysis(payload.report);
      setSelectedRisk(payload.report.risks[0] || null);
      setSelectedInsightId("local-repo-intelligence");
      setSourceLabel(
        payload.repo?.full_name
          ? `Live GitHub sync • ${payload.repo.full_name} • ${payload.authSource === "public-github-api" ? "Public API" : "Server token"}`
          : "Live GitHub sync"
      );
      setRepoStats(payload.sourceDetails || null);
      setSlackStatus(null);
      setTelegramStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse GitHub repository URL");
    } finally {
      setLoading(false);
    }
  }

  async function sendEscalationPackToSlack() {
    if (!selectedRisk && !selectedShareContent) return;
    setSlackSending(true);
    setSlackStatus(null);
    try {
      const response = await fetch("/api/integrations/slack/dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: slackEmail,
          risk: selectedShareContent ? undefined : selectedRisk,
          content: selectedShareContent || undefined
        })
      });

      const payload = (await response.json()) as { error?: string; channelId?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Slack DM failed");
      }

      setSlackStatus(`Escalation pack sent to Slack DM${payload.channelId ? ` • ${payload.channelId}` : ""}`);
    } catch (err) {
      setSlackStatus(err instanceof Error ? err.message : "Slack DM failed");
    } finally {
      setSlackSending(false);
    }
  }

  async function sendEscalationPackToTelegram() {
    if (!selectedRisk && !selectedShareContent) return;
    setTelegramSending(true);
    setTelegramStatus(null);
    try {
      const response = await fetch("/api/integrations/telegram/dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          recipient: telegramRecipient,
          risk: selectedShareContent ? undefined : selectedRisk,
          content: selectedShareContent || undefined
        })
      });

      const payload = (await response.json()) as { error?: string; chatId?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Telegram send failed");
      }

      setTelegramStatus(`Escalation pack sent to Telegram${payload.chatId ? ` • ${payload.chatId}` : ""}`);
    } catch (err) {
      setTelegramStatus(err instanceof Error ? err.message : "Telegram send failed");
    } finally {
      setTelegramSending(false);
    }
  }

  async function loadTelegramRecipients() {
    setTelegramRecipientsLoading(true);
    setTelegramStatus(null);
    try {
      const response = await fetch("/api/integrations/telegram/recipients", {
        cache: "no-store"
      });

      const payload = (await response.json()) as {
        error?: string;
        recipients?: TelegramRecipientOption[];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not load Telegram recipients");
      }

      setTelegramRecipients(payload.recipients || []);
      if (!payload.recipients || payload.recipients.length === 0) {
        setTelegramStatus("No Telegram recipients found yet. Open the bot and send a fresh message first.");
      }
    } catch (err) {
      setTelegramStatus(err instanceof Error ? err.message : "Could not load Telegram recipients");
    } finally {
      setTelegramRecipientsLoading(false);
    }
  }

  async function copySelectedInsight() {
    if (!selectedShareContent) return;
    try {
      await navigator.clipboard.writeText(selectedShareContent);
      setCopyStatus("Insight copied to clipboard");
    } catch {
      setCopyStatus("Clipboard copy failed");
    }
  }

  const metrics = analysis
    ? [
        { label: "Service slices analyzed", value: filteredWorkers.length.toString(), tone: "low" },
        { label: "Average operational risk", value: averageRisk(analysis.risks).toString(), tone: riskTone(averageRisk(analysis.risks)) },
        { label: "Data readiness", value: `${analysis.readiness.dataQualityScore}%`, tone: readinessTone(analysis.readiness.dataQualityScore) }
      ]
    : [
        { label: "Domains loaded", value: String(new Set(dataset.map((worker) => worker.team)).size), tone: "low" },
        { label: "Current dataset size", value: String(dataset.length), tone: "low" },
        { label: "Source templates", value: String(availableTeams.length - 1), tone: "low" }
      ];
  const decision = releaseDecision(analysis);
  const topBlockedRisk = analysis?.risks.find((risk) => risk.category === "blocked") || null;
  const topIncidentRisk = analysis?.risks.find((risk) => risk.category === "incident") || null;
  const sparseRepo = (repoStats?.openPullRequests ?? 0) + (repoStats?.openIssues ?? 0) < 6;
  const repoSampleNote = analyzedSampleNote(repoStats);
  const repoInsightDetails = repoIntelligenceDetails(analysis?.repoIntelligence?.details);
  const shareableInsights = analysis?.shareableInsights || [];
  const topMergedPullRequests = repoStats?.topMergedPullRequests || [];
  const oldestOpenPullRequests = repoStats?.oldestOpenPullRequests || [];
  const recentlyClosedIssues = repoStats?.recentlyClosedIssues || [];
  const oldestOpenIssues = repoStats?.oldestOpenIssues || [];
  const outboundShareOptions = useMemo<OutboundShareOption[]>(() => {
    const options: OutboundShareOption[] = [];

    if (analysis?.repoIntelligence) {
      options.push({
        id: "local-repo-intelligence",
        title: "Repo intelligence",
        description: "Repository-level throughput, backlog, and release context.",
        content: [
          `ControlTower AI repo intelligence`,
          ``,
          analysis.repoIntelligence.headline,
          ...repoIntelligenceDetails(analysis.repoIntelligence.details)
        ].join("\n")
      });
    }

    if (analysis?.interventions?.length) {
      options.push({
        id: "local-action-brief",
        title: "Action brief",
        description: "Current recommended actions from the command center.",
        content: [
          `ControlTower AI action brief`,
          ``,
          ...analysis.interventions.map((item, index) => `${index + 1}. ${item}`)
        ].join("\n")
      });
    }

    if (selectedRisk) {
      options.push({
        id: "local-risk-detail",
        title: "Risk detail",
        description: `Detailed shareable summary for ${selectedRisk.workerName}.`,
        content: buildRiskDetailContent(selectedRisk)
      });
    }

    options.push(
      ...shareableInsights.map((insight) => ({
        id: insight.id,
        title: insight.title,
        description: insight.description,
        content: insight.content
      }))
    );

    return options;
  }, [analysis, selectedRisk, shareableInsights]);
  const selectedInsight = outboundShareOptions.find((item) => item.id === selectedInsightId) || outboundShareOptions[0] || null;
  const selectedShareContent = selectedInsight?.content || null;

  return (
    <div className="stack">
      <section className="decision-card">
        <div>
          <span className={`pill pill-${decision.tone}`}>Release decision</span>
          <h2>{decision.label}</h2>
          <p className="muted">{decision.summary}</p>
        </div>
        {repoStats?.repoFullName ? (
          <div className="decision-stats">
            <div className="callout">
              <strong>{repoStats.repoFullName}</strong>
              <p className="muted">
                PRs {repoStats.openPullRequests ?? 0} • Issues {repoStats.openIssues ?? 0} • Last push{" "}
                {repoStats.lastPushAt ? new Date(repoStats.lastPushAt).toLocaleString() : "unknown"}
              </p>
            </div>
            <div className="mini-actions">
              <span className={`pill pill-${repoStats.maintainerEffortRating || "low"}`}>
                Maintainers {repoStats.maintainerEffortScore ?? 0}
              </span>
              <span className={`pill pill-${repoStats.contributorEffortRating || "low"}`}>
                Contributors {repoStats.contributorEffortScore ?? 0}
              </span>
              {repoStats.topContributors?.map((contributor) => (
                <span key={contributor} className="pill pill-low">{contributor}</span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {repoStats?.repoFullName ? (
        <div className="repo-summary-row">
          <span className="muted">
            Analyzing <strong>{repoStats.repoFullName}</strong> on branch <strong>{repoStats.defaultBranch || "unknown"}</strong>
          </span>
        </div>
      ) : null}

      {repoStats?.repoFullName ? (
        <section className="history-grid">
          <div className="table-card">
            <h3>GitHub history snapshot</h3>
            <div className="metric-grid compact-metric-grid">
              <div className="metric">
                <strong>{repoStats.openPullRequests ?? 0}</strong>
                <span className="muted">Open PRs</span>
              </div>
              <div className="metric">
                <strong>{repoStats.mergedPullRequests ?? 0}</strong>
                <span className="muted">Merged PRs</span>
              </div>
              <div className="metric">
                <strong>{repoStats.openIssues ?? 0}</strong>
                <span className="muted">Open issues</span>
              </div>
              <div className="metric">
                <strong>{repoStats.closedIssues ?? 0}</strong>
                <span className="muted">Previously closed issues</span>
              </div>
            </div>
            {repoSampleNote ? <p className="muted" style={{ marginTop: 12 }}>{repoSampleNote}</p> : null}
          </div>
        </section>
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

      <section className="status-strip">
        <span className={`pill pill-${readiness?.hasClerk ? "low" : "medium"}`}>
          Clerk {readiness?.hasClerk ? "active" : "not configured"}
        </span>
        <span className={`pill pill-${sourceLabel.includes("Server token") ? "low" : "medium"}`}>
          GitHub source: {sourceLabel.includes("Server token") ? "Server token" : sourceLabel.includes("Public API") ? "Public API" : "Bundled data"}
        </span>
        <span className={`pill pill-${analysis?.summaryStatus.engine === "gemini" ? "low" : readiness?.hasGeminiKey ? "medium" : "medium"}`}>
          Summary engine: {analysis ? (analysis.summaryStatus.engine === "gemini" ? "Gemini" : "Heuristic fallback") : readiness?.hasGeminiKey ? "Gemini ready" : "Gemini missing"}
        </span>
        <span className={`pill pill-${readiness?.databaseReachable ? "low" : readiness?.hasDatabase ? "medium" : "medium"}`}>
          Database: {readiness?.databaseReachable ? "connected" : readiness?.hasDatabase ? "configured" : "missing"}
        </span>
        <span className={`pill pill-${readiness?.hasSlackBotToken ? "low" : "medium"}`}>
          Slack DM: {readiness?.hasSlackBotToken ? "ready" : "token missing"}
        </span>
        <span className={`pill pill-${readiness?.hasTelegramBotToken ? "low" : "medium"}`}>
          Telegram: {readiness?.hasTelegramBotToken ? "ready" : "token missing"}
        </span>
      </section>

      <section className="metric-grid">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <strong>{metric.value}</strong>
            <span className={`pill pill-${metric.tone}`}>{metric.label}</span>
          </div>
        ))}
      </section>

      <div className="demo-grid">
        <aside className="panel controls">
          <div>
            <h3>Command center controls</h3>
            <p className="muted">
              Load operational signals, persist them to Neon, and generate a release-and-incident briefing with agent-ready actions.
            </p>
            <div className="mini-actions">
              <span className="pill pill-low">{sourceLabel}</span>
              {repoStats?.repoFullName ? <span className="pill pill-low">{repoStats.repoFullName}</span> : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="team">Domain slice</label>
            <select id="team" value={team} onChange={(event) => setTeam(event.target.value)}>
              {availableTeams.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="prompt">Agent instructions</label>
            <textarea
              id="prompt"
              rows={6}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>

          <div className="actions">
            <button className="button button-primary" onClick={runAnalysis} disabled={loading}>
              {loading ? "Processing..." : "Generate Ops Brief"}
            </button>
            <button className="button button-secondary" onClick={loadSampleDataset} disabled={loading}>
              Restore Demo Dataset
            </button>
          </div>

          <div className="field">
            <label htmlFor="github-url">GitHub repository</label>
            <input
              id="github-url"
              type="url"
              value={githubUrl}
              onChange={(event) => setGithubUrl(event.target.value)}
              placeholder="https://github.com/org/repo"
            />
            <button className="button button-secondary" onClick={loadGitHubDataset} disabled={loading}>
              {loading ? "Syncing..." : "Sync GitHub Live"}
            </button>
            <p className="muted">
              Live mode fetches real GitHub metadata, pull requests, and issues, then generates an ops CSV you can inspect or persist.
            </p>
          </div>

          <div className="field">
            <label htmlFor="csv">CSV ingestion</label>
            <textarea
              id="csv"
              rows={12}
              value={csvInput}
              onChange={(event) => setCsvInput(event.target.value)}
            />
            <button className="button button-secondary" onClick={ingestCsvDataset} disabled={loading}>
              Persist Ops Dataset
            </button>
            <p className="muted">
              The editor accepts the persisted ops CSV format directly. A GitHub live sync overwrites it with a generated dataset for the selected repository.
            </p>
          </div>
        </aside>

        <section className="stack">
          <div className="table-card">
            <h3>Current operational signals</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Service slice</th>
                  <th>Domain</th>
                  <th>Review delay</th>
                  <th>Release risk</th>
                  <th>Runbook score</th>
                  <th>Incidents</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id}>
                    <td>
                      <strong>{worker.name}</strong>
                      <div className="muted">{worker.role}</div>
                    </td>
                    <td>{worker.team}</td>
                    <td>{worker.reviewLatencyHours}h</td>
                    <td>{worker.afterHoursWorkPct}%</td>
                    <td>{worker.focusHoursPerDay}</td>
                    <td>{worker.onCallPagesLast14Days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error ? (
            <div className="callout">
              <strong>Operational error</strong>
              <p className="muted">{error}</p>
            </div>
          ) : null}

          {analysis ? (
            <>
              <div className="table-card">
                <h3>Daily ops brief</h3>
                <p className="muted">{analysis.orgSummary}</p>
                <p className="muted">{analysis.teamSummary}</p>
                {analysis.persistenceWarning ? (
                  <div className="callout" style={{ marginTop: 14 }}>
                    <strong>Persistence warning</strong>
                    <p className="muted">{analysis.persistenceWarning}</p>
                  </div>
                ) : null}
                <div className="callout" style={{ marginTop: 14 }}>
                  <strong>Summary engine status</strong>
                  <p className="muted">{analysis.summaryStatus.detail}</p>
                  {analysis.summaryStatus.error ? <p className="muted">Gemini error: {analysis.summaryStatus.error}</p> : null}
                </div>
                {sparseRepo || analysis.readiness.dataQualityScore < 60 ? (
                  <div className="callout" style={{ marginTop: 14 }}>
                    <strong>Low operational activity detected</strong>
                    <p className="muted">Using available GitHub signals to estimate release readiness. Sparse repositories may produce conservative blocker and incident signals.</p>
                  </div>
                ) : null}
                <div className="mini-actions">
                  <span className="pill pill-low">{analysis.mode.toUpperCase()}</span>
                  <span className="pill pill-low">{new Date(analysis.generatedAt).toLocaleString()}</span>
                  <span className="pill pill-low">{sourceLabel}</span>
                  {repoStats?.repoFullName ? <span className="pill pill-low">PRs {repoStats.openPullRequests ?? 0} • Issues {repoStats.openIssues ?? 0}</span> : null}
                  {analysis.reportId ? <span className="pill pill-low">Persisted</span> : null}
                </div>
              </div>

              {analysis.repoIntelligence ? (
                <div className="table-card">
                  <h3>Repo intelligence</h3>
                  <p className="muted">{analysis.repoIntelligence.headline}</p>
                  {repoInsightDetails.length > 0 ? (
                    <div className="stack">
                      {repoInsightDetails.map((item) => (
                        <div key={item} className="callout">{item}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {repoStats?.repoFullName ? (
                <>
                  <section className="metric-grid">
                    <div className="metric">
                      <strong>{repoStats.mergedPullRequests7d ?? 0}</strong>
                      <span className="muted">Merged PRs last 7d</span>
                    </div>
                    <div className="metric">
                      <strong>{repoStats.openPullRequests ?? 0}</strong>
                      <span className="muted">Open PR backlog</span>
                    </div>
                    <div className="metric">
                      <strong>{repoStats.closedIssues30d ?? 0}</strong>
                      <span className="muted">Closed issues last 30d</span>
                    </div>
                    <div className="metric">
                      <strong>{repoStats.averageMergeLeadHours ?? 0}h</strong>
                      <span className="muted">Average review-to-merge time</span>
                    </div>
                  </section>

                  <div className="two-column-grid">
                    <div className="table-card">
                      <h3>Merge throughput</h3>
                      <div className="stack">
                        <div className="callout">Merged PRs last 7d: {repoStats.mergedPullRequests7d ?? 0}</div>
                        <div className="callout">Merged PRs last 30d: {repoStats.mergedPullRequests30d ?? 0}</div>
                        <div className="callout">Open PR growth pressure: {repoStats.openPrGrowthPressure ?? 0}</div>
                      </div>
                    </div>
                    <div className="table-card">
                      <h3>Issue backlog</h3>
                      <div className="stack">
                        <div className="callout">Open issues: {repoStats.openIssues ?? 0}</div>
                        <div className="callout">Closed issues last 7d: {repoStats.closedIssues7d ?? 0}</div>
                        <div className="callout">Closed issues last 30d: {repoStats.closedIssues30d ?? 0}</div>
                      </div>
                    </div>
                  </div>

                  <div className="two-column-grid">
                    <div className="table-card">
                      <h3>Top 10 recently merged PRs</h3>
                      <div className="stack">
                        {topMergedPullRequests.map((item) => (
                          <div key={item.id} className="callout">
                            <strong>#{item.number} {item.title}</strong>
                            <p className="muted">{rankedItemMeta(item)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="table-card">
                      <h3>Top 10 oldest open PRs</h3>
                      <div className="stack">
                        {oldestOpenPullRequests.map((item) => (
                          <div key={item.id} className="callout">
                            <strong>#{item.number} {item.title}</strong>
                            <p className="muted">{rankedItemMeta(item)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="two-column-grid">
                    <div className="table-card">
                      <h3>Top 10 recently closed issues</h3>
                      <div className="stack">
                        {recentlyClosedIssues.map((item) => (
                          <div key={item.id} className="callout">
                            <strong>#{item.number} {item.title}</strong>
                            <p className="muted">{rankedItemMeta(item)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="table-card">
                      <h3>Top 10 oldest open issues</h3>
                      <div className="stack">
                        {oldestOpenIssues.map((item) => (
                          <div key={item.id} className="callout">
                            <strong>#{item.number} {item.title}</strong>
                            <p className="muted">{rankedItemMeta(item)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <AnalysisVisuals analysis={analysis} />

              <div className="four-panel-grid">
                <RiskList
                  title="Release risk"
                  items={panelRisks(analysis, "release")}
                  selectedId={selectedRisk?.workerId || null}
                  onSelect={setSelectedRisk}
                />
                <RiskList
                  title="Incident hotspots"
                  items={panelRisks(analysis, "incident")}
                  selectedId={selectedRisk?.workerId || null}
                  onSelect={setSelectedRisk}
                />
                <RiskList
                  title="Blocked work"
                  items={panelRisks(analysis, "blocked")}
                  selectedId={selectedRisk?.workerId || null}
                  onSelect={setSelectedRisk}
                />
                <div className="table-card">
                  <h3>Agent-generated action brief</h3>
                  <div className="stack">
                    {analysis.interventions.map((item) => (
                      <div key={item} className="callout">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedRisk ? (
                <div className="table-card">
                  <h3>Selected risk detail</h3>
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
                      </div>
                      <div className="callout">
                        <strong>Ops summary / postmortem</strong>
                        <p className="muted">{selectedRisk.draftSummary}</p>
                      </div>
                      <div className="callout">
                        <strong>Send Selected Content to Slack</strong>
                        <div className="field" style={{ marginTop: 10 }}>
                          <label htmlFor="slack-email">Slack user email</label>
                          <input
                            id="slack-email"
                            type="email"
                            value={slackEmail}
                            onChange={(event) => setSlackEmail(event.target.value)}
                            placeholder="name@company.com"
                          />
                        </div>
                        <div className="actions">
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={sendEscalationPackToSlack}
                            disabled={slackSending || !slackEmail || !readiness?.hasSlackBotToken}
                          >
                            {slackSending ? "Sending..." : "Send Selected Content to Slack"}
                          </button>
                        </div>
                        {slackStatus ? <p className="muted">{slackStatus}</p> : null}
                      </div>
                      <div className="callout">
                        <strong>Send Selected Content to Telegram</strong>
                        <div className="field" style={{ marginTop: 10 }}>
                          <label htmlFor="telegram-recipient">Telegram username or chat ID</label>
                          <input
                            id="telegram-recipient"
                            type="text"
                            value={telegramRecipient}
                            onChange={(event) => setTelegramRecipient(event.target.value)}
                            placeholder="@username or 123456789"
                          />
                        </div>
                        <p className="muted">If using a username, the recipient must open `t.me/ControlTowerAIBot` and press Start first.</p>
                        <div className="actions">
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={loadTelegramRecipients}
                            disabled={telegramRecipientsLoading || !readiness?.hasTelegramBotToken}
                          >
                            {telegramRecipientsLoading ? "Loading recipients..." : "Load Telegram Recipients"}
                          </button>
                        </div>
                        {telegramRecipients.length > 0 ? (
                          <div className="stack" style={{ marginTop: 12 }}>
                            {telegramRecipients.map((recipient) => (
                              <button
                                key={recipient.chatId}
                                type="button"
                                className="risk-button"
                                onClick={() => setTelegramRecipient(recipient.chatId)}
                              >
                                <span>
                                  <strong>{recipient.displayName}</strong>
                                  <span className="muted">
                                    {recipient.username ? `@${recipient.username}` : "No username"} • {recipient.chatId}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className="actions">
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={sendEscalationPackToTelegram}
                            disabled={telegramSending || !telegramRecipient || !readiness?.hasTelegramBotToken}
                          >
                            {telegramSending ? "Sending..." : "Send Selected Content to Telegram"}
                          </button>
                        </div>
                        {telegramStatus ? <p className="muted">{telegramStatus}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {outboundShareOptions.length > 0 ? (
                <div className="table-card">
                  <h3>Shareable content</h3>
                  <div className="two-column-grid">
                    <div className="stack">
                      {outboundShareOptions.map((insight) => (
                        <button
                          key={insight.id}
                          type="button"
                          className={`risk-button${selectedInsight?.id === insight.id ? " risk-button-active" : ""}`}
                          onClick={() => setSelectedInsightId(insight.id)}
                        >
                          <span>
                            <strong>{insight.title}</strong>
                            <span className="muted">{insight.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    {selectedInsight ? (
                      <div className="stack">
                        <div className="callout">
                          <strong>{selectedInsight.title}</strong>
                          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{selectedInsight.content}</p>
                        </div>
                        <div className="actions">
                          <button type="button" className="button button-secondary" onClick={copySelectedInsight}>
                            Copy insight
                          </button>
                        </div>
                        {copyStatus ? <p className="muted">{copyStatus}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="two-column-grid">
                <div className="table-card">
                  <h3>Domain metrics</h3>
                  <div className="table-scroll">
                  <table className="table domain-table">
                    <thead>
                      <tr>
                        <th>Domain</th>
                        <th>Slices</th>
                        <th>Review delay</th>
                        <th>Release risk</th>
                        <th>Incidents</th>
                        <th>Risk</th>
                      </tr>
                    </thead>
                    <tbody>{analysis.teamMetrics.map(renderTeamMetric)}</tbody>
                  </table>
                  </div>
                </div>

                <div className="table-card">
                  <h3>Deployment forecast</h3>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Window</th>
                        <th>Projected runbook score</th>
                        <th>Projected risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.forecast.map((point) => (
                        <tr key={point.week}>
                          <td><strong>{point.week}</strong></td>
                          <td>{point.projectedFocusHoursPerDay}</td>
                          <td>{point.projectedAverageRisk}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="two-column-grid">
                <div className="table-card">
                  <h3>Owner action queue</h3>
                  <div className="stack">
                    {analysis.managerBriefs.map((brief) => (
                      <div key={brief.manager} className="callout">
                        <strong>{brief.manager}</strong>
                        <p className="muted">{brief.summary}</p>
                        <div className="mini-actions">
                          {brief.priorityWorkers.map((worker) => (
                            <span key={worker} className="pill pill-low">{worker}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="table-card">
                  <h3>Anomalies and audit trail</h3>
                  <div className="stack">
                    {analysis.anomalies.map((item) => (
                      <div key={item} className="callout">{item}</div>
                    ))}
                    {analysis.auditTrail.map((event) => (
                      <div key={`${event.stage}-${event.message}`} className="audit-row">
                        <strong>{event.stage}</strong>
                        <span className="muted">{event.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="table-card">
              <h3>No ops brief generated yet</h3>
              <p className="muted">
                Persist a dataset or generate a report to populate the command center with release risk, incident hotspots, blocked work, and today's action brief.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
