import type {
  AnalysisMode,
  AnalysisResponse,
  AuditEvent,
  ForecastPoint,
  ManagerBrief,
  ReadinessReport,
  RepoIntelligence,
  RiskAssessment,
  RiskLevel,
  ShareableInsight,
  SourceMetadata,
  SummaryStatus,
  TeamMetric,
  WorkerSignal
} from "./types.ts";
import { connectedSources } from "./mock-data.ts";

interface GeminiRefinement {
  orgSummary?: string;
  teamSummary?: string;
  interventions?: string[];
  anomalies?: string[];
  managerBriefs?: ManagerBrief[];
  repoIntelligence?: RepoIntelligence;
}

interface ReportContext {
  sourceMetadata?: SourceMetadata | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeRepoIntelligence(value: unknown, fallback?: RepoIntelligence | null): RepoIntelligence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback || null;
  }

  const candidate = value as { headline?: unknown; details?: unknown };
  const headline =
    typeof candidate.headline === "string" && candidate.headline.trim().length > 0
      ? candidate.headline.trim()
      : fallback?.headline;

  const details = Array.isArray(candidate.details)
    ? candidate.details.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : typeof candidate.details === "string" && candidate.details.trim().length > 0
      ? [candidate.details.trim()]
      : fallback?.details || [];

  if (!headline) {
    return fallback || null;
  }

  return {
    headline,
    details
  };
}

function promptMentionsMergedPrs(prompt: string) {
  return /merged\s+pr|merged\s+pull\s+request|merge\s+velocity|merged\s+throughput/i.test(prompt);
}

function buildRepoIntelligence(sourceMetadata?: SourceMetadata | null, prompt?: string): RepoIntelligence | null {
  if (!sourceMetadata?.repoFullName) return null;

  const openPrs = sourceMetadata.openPullRequests ?? 0;
  const mergedPrs = sourceMetadata.mergedPullRequests ?? 0;
  const openIssues = sourceMetadata.openIssues ?? 0;
  const closedIssues = sourceMetadata.closedIssues ?? 0;
  const mergedPrompt = promptMentionsMergedPrs(prompt || "");

  const headline = mergedPrompt
    ? `${sourceMetadata.repoFullName} has ${mergedPrs} merged PRs, ${openPrs} open PRs, and ${openIssues} open issues in the current GitHub snapshot.`
    : `${sourceMetadata.repoFullName} is carrying ${openPrs} open PRs and ${openIssues} open issues while historical throughput shows ${mergedPrs} merged PRs and ${closedIssues} closed issues.`;

  return {
    headline,
    details: [
      `${mergedPrs} merged PRs indicate recent delivery throughput${openPrs > 0 ? `, but ${openPrs} open PRs still need review attention.` : "."}`,
      `${openIssues} open issues remain active while ${closedIssues} issues are already resolved in the repo history.`,
      sourceMetadata.lastPushAt
        ? `Last repository push was ${new Date(sourceMetadata.lastPushAt).toLocaleString()}.`
        : "Last repository push time is not available in the current sync."
    ]
  };
}

function buildShareableInsights(
  report: Pick<AnalysisResponse, "orgSummary" | "teamSummary" | "interventions" | "risks">,
  sourceMetadata?: SourceMetadata | null
): ShareableInsight[] {
  const insights: ShareableInsight[] = [];
  const repoName = sourceMetadata?.repoFullName || "current repository";
  const topRisk = report.risks[0];

  insights.push({
    id: "release-brief",
    title: "Release brief",
    description: "Executive release readiness summary for the current repo.",
    content: [
      `ControlTower AI release brief`,
      ``,
      `Repository: ${repoName}`,
      report.orgSummary,
      report.teamSummary
    ].join("\n")
  });

  if (sourceMetadata) {
    insights.push({
      id: "merge-throughput",
      title: "Merge throughput",
      description: "Merged PR totals and merge-rate snapshot for the last 7 and 30 days.",
      content: [
        `ControlTower AI merge throughput`,
        ``,
        `Repository: ${repoName}`,
        `Merged PRs: ${sourceMetadata.mergedPullRequests ?? 0}`,
        `Merged PRs last 7d: ${sourceMetadata.mergedPullRequests7d ?? 0}`,
        `Merged PRs last 30d: ${sourceMetadata.mergedPullRequests30d ?? 0}`,
        `Average review-to-merge time: ${sourceMetadata.averageMergeLeadHours ?? 0}h`,
        `Open PR backlog: ${sourceMetadata.openPullRequests ?? 0}`,
        `Open PR pressure ratio: ${sourceMetadata.openPrGrowthPressure ?? 0}`
      ].join("\n")
    });
    insights.push({
      id: "issue-backlog",
      title: "Issue backlog",
      description: "Open and recently closed issue load for the current repo.",
      content: [
        `ControlTower AI issue backlog`,
        ``,
        `Repository: ${repoName}`,
        `Open issues: ${sourceMetadata.openIssues ?? 0}`,
        `Closed issues: ${sourceMetadata.closedIssues ?? 0}`,
        `Closed issues last 7d: ${sourceMetadata.closedIssues7d ?? 0}`,
        `Closed issues last 30d: ${sourceMetadata.closedIssues30d ?? 0}`
      ].join("\n")
    });
  }

  if (topRisk) {
    insights.push({
      id: "top-risk-escalation",
      title: topRisk.category === "release" ? "Release escalation" : topRisk.category === "blocked" ? "Review bottleneck" : "Incident escalation",
      description: "Ready-to-send escalation for the highest-priority risk item.",
      content: [
        `ControlTower AI escalation`,
        ``,
        `Repository: ${repoName}`,
        `Priority item: ${topRisk.workerName}`,
        `Risk: ${topRisk.riskLevel.toUpperCase()} (${topRisk.riskScore})`,
        topRisk.draftSlackEscalation
      ].join("\n")
    });
  }

  if (report.interventions.length > 0) {
    insights.push({
      id: "action-brief",
      title: "Action brief",
      description: "Top recommended actions from the current analysis run.",
      content: [
        `ControlTower AI action brief`,
        ``,
        `Repository: ${repoName}`,
        ...report.interventions.slice(0, 4).map((item, index) => `${index + 1}. ${item}`)
      ].join("\n")
    });
  }

  return insights;
}

function buildSummaryStatus(mode: AnalysisMode, prompt: string, detail: string, error?: string | null): SummaryStatus {
  return {
    engine: mode,
    detail: prompt.trim().length > 0 ? `${detail} Prompt focus: ${prompt.trim()}` : detail,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    error: error || null
  };
}

function buildDraftSlackEscalation(worker: WorkerSignal, factors: string[]) {
  return `Heads up: ${worker.name} is showing ${factors.join(", ")} in ${worker.team}. Suggested owner: ${worker.manager}. Recommend a release gate review and blocker triage in the next standup.`;
}

function buildDraftIncidentSummary(worker: WorkerSignal, riskScore: number, factors: string[]) {
  return `Service slice ${worker.name} is operating at risk ${riskScore}. Primary signals: ${factors.join(", ")}. Proposed response: assign ${worker.manager}, reduce release scope, clear blocked PRs, and verify runbook readiness before the next deployment window.`;
}

function promptMentionsReleaseFocus(prompt: string) {
  return /release|open\s+pr|open\s+pull\s+request|merged\s+pr|merged\s+pull\s+request/i.test(prompt);
}

function isReleaseLane(worker: WorkerSignal) {
  return /release stream|release lane/i.test(worker.role) || /release lane/i.test(worker.name);
}

function isPrQueue(worker: WorkerSignal) {
  return /pr queue/i.test(worker.role) || /blocker queue/i.test(worker.name);
}

function inferCategory(worker: WorkerSignal, factors: string[]) {
  if (
    factors.includes("repeated incidents") ||
    factors.includes("alert storm pressure") ||
    worker.onCallPagesLast14Days >= 3
  ) {
    return "incident" as const;
  }

  if (
    factors.includes("stale pull request queue") ||
    factors.includes("slow review turnaround") ||
    factors.includes("critical ticket pressure")
  ) {
    return "blocked" as const;
  }

  return "release" as const;
}

function applyPromptAwareCategory(risk: RiskAssessment, worker: WorkerSignal, prompt: string): RiskAssessment {
  if (isPrQueue(worker)) {
    return risk;
  }

  if (isReleaseLane(worker) && (risk.factors.includes("elevated release failure risk") || promptMentionsReleaseFocus(prompt))) {
    return {
      ...risk,
      category: "release"
    };
  }

  return risk;
}

export function scoreWorker(worker: WorkerSignal): RiskAssessment {
  let score = 0;
  const factors: string[] = [];

  if (worker.prsOpenedLast14Days >= 6) {
    score += 16;
    factors.push("stale pull request queue");
  }
  if (worker.reviewLatencyHours >= 18) {
    score += 15;
    factors.push("slow review turnaround");
  }
  if (worker.afterHoursWorkPct >= 25) {
    score += 18;
    factors.push("elevated release failure risk");
  }
  if (worker.meetingLoadHours >= 12) {
    score += 14;
    factors.push("alert storm pressure");
  }
  if (worker.focusHoursPerDay < 3.4) {
    score += 12;
    factors.push("weak runbook coverage");
  }
  if (worker.onCallPagesLast14Days >= 3) {
    score += 18;
    factors.push("repeated incidents");
  }
  if (worker.manager1to1GapDays >= 24) {
    score += 12;
    factors.push("critical ticket pressure");
  }
  if (worker.vacationDaysNext30 >= 2) {
    score += 11;
    factors.push("failed deployments in the last week");
  }
  if (worker.asyncSentimentScore <= 2.8) {
    score += 10;
    factors.push("escalating Slack sentiment");
  }

  const riskScore = Math.min(100, score);
  const riskLevel: RiskLevel = riskScore >= 65 ? "high" : riskScore >= 35 ? "medium" : "low";
  const category = inferCategory(worker, factors);

  let recommendation = "Keep the release lane open and continue monitoring service health.";
  if (riskLevel === "high") {
    recommendation = "Pause non-essential release scope, assign a single owner, and trigger an escalation review now.";
  } else if (riskLevel === "medium") {
    recommendation = "Trim release scope, clear blockers, and verify incident readiness before the next deploy.";
  }

  const explanation =
    `${worker.name} is flagged because it combines ${factors.join(", ")}.` +
    ` Current score: ${riskScore}. This slice maps to owner ${worker.manager} in ${worker.team}.`;

  return {
    workerId: worker.id,
    workerName: worker.name,
    team: worker.team,
    manager: worker.manager,
    riskLevel,
    riskScore,
    category,
    factors,
    explanation,
    recommendedOwner: worker.manager,
    draftSlackEscalation: buildDraftSlackEscalation(worker, factors),
    draftSummary: buildDraftIncidentSummary(worker, riskScore, factors),
    recommendation
  };
}

export function buildTeamMetrics(workers: WorkerSignal[], risks: RiskAssessment[]): TeamMetric[] {
  const teams = [...new Set(workers.map((worker) => worker.team))];

  return teams
    .map((team) => {
      const teamWorkers = workers.filter((worker) => worker.team === team);
      const teamRisks = risks.filter((risk) => risk.team === team);

      return {
        team,
        workerCount: teamWorkers.length,
        averageReviewLatencyHours: round(
          teamWorkers.reduce((sum, worker) => sum + worker.reviewLatencyHours, 0) / teamWorkers.length
        ),
        averageAfterHoursWorkPct: round(
          teamWorkers.reduce((sum, worker) => sum + worker.afterHoursWorkPct, 0) / teamWorkers.length
        ),
        averageFocusHoursPerDay: round(
          teamWorkers.reduce((sum, worker) => sum + worker.focusHoursPerDay, 0) / teamWorkers.length
        ),
        averageOnCallPages: round(
          teamWorkers.reduce((sum, worker) => sum + worker.onCallPagesLast14Days, 0) / teamWorkers.length
        ),
        averageRiskScore: round(teamRisks.reduce((sum, risk) => sum + risk.riskScore, 0) / teamRisks.length),
        highRiskCount: teamRisks.filter((risk) => risk.riskLevel === "high").length
      };
    })
    .sort((left, right) => right.averageRiskScore - left.averageRiskScore);
}

export function buildForecast(teamMetrics: TeamMetric[]): ForecastPoint[] {
  const baselineFocus = teamMetrics.reduce((sum, metric) => sum + metric.averageFocusHoursPerDay, 0) / teamMetrics.length;
  const baselineRisk = teamMetrics.reduce((sum, metric) => sum + metric.averageRiskScore, 0) / teamMetrics.length;

  return [
    {
      week: "Next deploy",
      projectedFocusHoursPerDay: round(clamp(baselineFocus + 0.4, 0, 8)),
      projectedAverageRisk: round(clamp(baselineRisk - 4, 0, 100))
    },
    {
      week: "Week 2",
      projectedFocusHoursPerDay: round(clamp(baselineFocus + 0.8, 0, 8)),
      projectedAverageRisk: round(clamp(baselineRisk - 7, 0, 100))
    },
    {
      week: "Week 3",
      projectedFocusHoursPerDay: round(clamp(baselineFocus + 1.1, 0, 8)),
      projectedAverageRisk: round(clamp(baselineRisk - 10, 0, 100))
    }
  ];
}

export function buildManagerBriefs(risks: RiskAssessment[]): ManagerBrief[] {
  const managers = [...new Set(risks.map((risk) => risk.manager))];

  return managers.map((manager) => {
    const managerRisks = risks
      .filter((risk) => risk.manager === manager)
      .sort((left, right) => right.riskScore - left.riskScore);
    const highRisk = managerRisks.filter((risk) => risk.riskLevel === "high");
    const blockedCount = managerRisks.filter((risk) => risk.category === "blocked").length;
    const incidentCount = managerRisks.filter((risk) => risk.category === "incident").length;

    return {
      manager,
      summary:
        highRisk.length > 0
          ? `${manager} owns ${highRisk.length} high-risk slices, ${blockedCount} blocker-driven escalations, and ${incidentCount} incident-driven escalations. Freeze risky deploys first.`
          : `${manager} has no urgent release escalations in this run. Keep review latency and incident recurrence under watch.`,
      priorityWorkers: managerRisks.slice(0, 3).map((risk) => risk.workerName)
    };
  });
}

export function buildAnomalies(teamMetrics: TeamMetric[], risks: RiskAssessment[]): string[] {
  const anomalies: string[] = [];
  const highestRiskTeam = teamMetrics[0];
  const topReleaseRisk = risks.find((risk) => risk.category === "release");
  const topIncidentRisk = risks.find((risk) => risk.category === "incident");
  const topBlockedRisk = risks.find((risk) => risk.category === "blocked");

  if (highestRiskTeam) {
    anomalies.push(
      `${highestRiskTeam.team} has the highest release pressure with average risk ${highestRiskTeam.averageRiskScore} and ${highestRiskTeam.highRiskCount} high-risk service slices.`
    );
  }
  if (topReleaseRisk) {
    anomalies.push(
      `${topReleaseRisk.workerName} is the riskiest release candidate because it combines ${topReleaseRisk.factors.slice(0, 2).join(" and ")}.`
    );
  }
  if (topIncidentRisk) {
    anomalies.push(
      `${topIncidentRisk.workerName} is the hottest incident hotspot and should be reviewed against recent deploys and alert noise.`
    );
  }
  if (topBlockedRisk) {
    anomalies.push(
      `${topBlockedRisk.workerName} is accumulating blocked work that can delay releases across ${topBlockedRisk.team}.`
    );
  }

  return anomalies;
}

export function buildReadinessReport(workers: WorkerSignal[]): ReadinessReport {
  const completeNotes = workers.filter((worker) => worker.note.trim().length > 20).length;
  const ownersCovered = new Set(workers.map((worker) => worker.manager)).size;
  const teamsCovered = new Set(workers.map((worker) => worker.team)).size;
  const slicesWithEnvironment = workers.filter((worker) => worker.timezone.trim().length > 0).length;
  const dataQualityScore = Math.round(
    (completeNotes / workers.length) * 35 +
      (Math.min(teamsCovered, 5) / 5) * 25 +
      (Math.min(ownersCovered, 5) / 5) * 20 +
      (slicesWithEnvironment / workers.length) * 20
  );

  return {
    dataQualityScore,
    coverageSummary: `${workers.length} service slices across ${teamsCovered} domains and ${ownersCovered} owners were included in this run.`,
    connectedSources,
    recommendedOperationalFixes: [
      "Pull GitHub pull requests, Slack escalations, and incident feeds automatically instead of relying on demo CSV uploads.",
      "Store every release decision, generated brief, and postmortem draft for auditability.",
      "Attach repository, environment, and deployment metadata so the agent can produce go or no-go release guidance."
    ]
  };
}

export function buildAuditTrail(summaryStatus: SummaryStatus, workers: WorkerSignal[], prompt: string): AuditEvent[] {
  return [
    {
      stage: "ingestion",
      message: `Loaded ${workers.length} operational service slices into the command center pipeline.`
    },
    {
      stage: "normalization",
      message: "Validated review, release, incident, and escalation signals into a shared enterprise operations shape."
    },
    {
      stage: "risk-scoring",
      message: "Calculated release risk, blocked work, and incident hotspot scores from stale PRs, review latency, alert load, deploy failures, and escalation sentiment."
    },
    {
      stage: "summarization",
      message: summaryStatus.detail
    }
  ];
}

export function buildHeuristicReport(workers: WorkerSignal[], prompt: string, context?: ReportContext): AnalysisResponse {
  const workerMap = new Map(workers.map((worker) => [worker.id, worker]));
  const risks = workers
    .map(scoreWorker)
    .map((risk) => applyPromptAwareCategory(risk, workerMap.get(risk.workerId) || workers[0], prompt))
    .sort((left, right) => right.riskScore - left.riskScore);
  const teamMetrics = buildTeamMetrics(workers, risks);
  const forecast = buildForecast(teamMetrics);
  const managerBriefs = buildManagerBriefs(risks);
  const anomalies = buildAnomalies(teamMetrics, risks);
  const readiness = buildReadinessReport(workers);
  const repoIntelligence = buildRepoIntelligence(context?.sourceMetadata, prompt);

  const highRiskCount = risks.filter((risk) => risk.riskLevel === "high").length;
  const mediumRiskCount = risks.filter((risk) => risk.riskLevel === "medium").length;
  const blockedCount = risks.filter((risk) => risk.category === "blocked").length;
  const incidentCount = risks.filter((risk) => risk.category === "incident").length;
  const mergedPrompt = promptMentionsMergedPrs(prompt);

  const orgSummary =
    highRiskCount > 0
      ? `${repoIntelligence ? `${repoIntelligence.headline} ` : ""}The command center detected ${highRiskCount} high-risk and ${mediumRiskCount} medium-risk service slices. The main drivers are blocked pull requests, recurring incidents, release failure risk, and alert escalation.`
      : "No critical release lane is blocked right now. Keep watching review turnaround and incident recurrence.";

  const highestRiskTeam = teamMetrics[0];
  const teamSummary = highestRiskTeam
    ? `${highestRiskTeam.team} is the highest-priority domain with average risk ${highestRiskTeam.averageRiskScore}, ${highestRiskTeam.highRiskCount} high-risk slices, and the heaviest blocker pressure.${mergedPrompt && context?.sourceMetadata?.mergedPullRequests !== undefined ? ` Merged PR throughput currently stands at ${context.sourceMetadata.mergedPullRequests}.` : ""}`
    : "Not enough team data was available to generate a domain-level summary.";

  const summaryStatus = buildSummaryStatus(
    "heuristic",
    prompt,
    process.env.GEMINI_API_KEY
      ? "Gemini refinement was available but the current report is still using heuristic summaries."
      : "Heuristic summary mode used because GEMINI_API_KEY is not configured."
  );
  const auditTrail = buildAuditTrail(summaryStatus, workers, prompt);
  const interventions = [
    mergedPrompt && context?.sourceMetadata?.mergedPullRequests !== undefined
      ? `Review merged throughput versus release risk: ${context.sourceMetadata.mergedPullRequests} merged PRs have landed, but the highest-risk lanes still need blocker cleanup before the next deploy.`
      : "Stop shipping non-essential changes into the highest-risk release lane until the blocker queue falls.",
    "Assign a single incident commander to each hotspot with repeated incidents or alert-storm signals.",
    "Draft and send escalation messages for service slices with stalled reviews, deploy failures, and no clear owner response.",
    `Today's action brief: clear ${blockedCount} blocked release paths and review ${incidentCount} incident hotspots before the next deploy window.`
  ];

  return {
    generatedAt: new Date().toISOString(),
    mode: "heuristic",
    summaryStatus,
    orgSummary,
    teamSummary,
    repoIntelligence,
    shareableInsights: buildShareableInsights({ orgSummary, teamSummary, interventions, risks }, context?.sourceMetadata),
    risks,
    interventions,
    teamMetrics,
    forecast,
    managerBriefs,
    anomalies,
    auditTrail,
    readiness
  };
}

export async function refineWithGemini(
  base: AnalysisResponse,
  prompt: string,
  workers: WorkerSignal[],
  context?: ReportContext
): Promise<AnalysisResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ...base,
      summaryStatus: buildSummaryStatus("heuristic", prompt, "Heuristic summary mode used because GEMINI_API_KEY is not configured.")
    };
  }

  const model = "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: [
                "You are an enterprise engineering operations analyst.",
                "Refine a structured release and incident command-center report into concise executive language.",
                "Return valid JSON only with keys: orgSummary, teamSummary, interventions, anomalies, managerBriefs, repoIntelligence.",
                "interventions and anomalies must be arrays of strings.",
                "managerBriefs must be an array of objects with keys: manager, summary, priorityWorkers.",
                "repoIntelligence must be an object with keys: headline, details.",
                "If the user prompt mentions merged PRs, merged throughput, or open issues, explicitly reference those totals when they are available.",
                `User prompt: ${prompt}`,
                `Base report: ${JSON.stringify(base)}`,
                `Operational signals: ${JSON.stringify(workers)}`,
                `Repository metadata: ${JSON.stringify(context?.sourceMetadata || null)}`
              ].join("\n")
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ...base,
      summaryStatus: buildSummaryStatus(
        "heuristic",
        prompt,
        `Gemini refinement failed and heuristic summaries were used instead. Gemini API returned ${response.status}.`,
        errorText.slice(0, 240)
      ),
      auditTrail: buildAuditTrail(
        buildSummaryStatus(
          "heuristic",
          prompt,
          `Gemini refinement failed and heuristic summaries were used instead. Gemini API returned ${response.status}.`,
          errorText.slice(0, 240)
        ),
        workers,
        prompt
      )
    };
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!rawText) {
    return {
      ...base,
      summaryStatus: buildSummaryStatus(
        "heuristic",
        prompt,
        "Gemini returned an empty response, so heuristic summaries were used instead."
      ),
      auditTrail: buildAuditTrail(
        buildSummaryStatus(
          "heuristic",
          prompt,
          "Gemini returned an empty response, so heuristic summaries were used instead."
        ),
        workers,
        prompt
      )
    };
  }

  const cleaned = rawText.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as GeminiRefinement;
    const summaryStatus = buildSummaryStatus("gemini", prompt, `Gemini refinement applied using operator prompt: "${prompt}".`);
    const refined = {
      ...base,
      mode: "gemini" as const,
      summaryStatus,
      orgSummary: parsed.orgSummary || base.orgSummary,
      teamSummary: parsed.teamSummary || base.teamSummary,
      repoIntelligence: normalizeRepoIntelligence(parsed.repoIntelligence, base.repoIntelligence),
      interventions: parsed.interventions?.length ? parsed.interventions : base.interventions,
      anomalies: parsed.anomalies?.length ? parsed.anomalies : base.anomalies,
      managerBriefs: parsed.managerBriefs?.length ? parsed.managerBriefs : base.managerBriefs,
      auditTrail: buildAuditTrail(summaryStatus, workers, prompt)
    };
    return {
      ...refined,
      shareableInsights: buildShareableInsights(refined, context?.sourceMetadata)
    };
  } catch {
    const summaryStatus = buildSummaryStatus(
      "heuristic",
      prompt,
      "Gemini returned malformed JSON, so heuristic summaries were used instead.",
      cleaned.slice(0, 240)
    );
    return {
      ...base,
      summaryStatus,
      auditTrail: buildAuditTrail(summaryStatus, workers, prompt)
    };
  }
}
