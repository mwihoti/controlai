import type { WorkerSignal } from "./types.ts";

function defaultWorkerBase(id: string, name: string): WorkerSignal {
  return {
    id,
    name,
    team: "Unassigned Domain",
    role: "Operational Service Slice",
    location: "unknown-region",
    manager: "Unassigned Owner",
    timezone: "production",
    prsOpenedLast14Days: 0,
    reviewLatencyHours: 0,
    afterHoursWorkPct: 0,
    meetingLoadHours: 3,
    focusHoursPerDay: 4.5,
    onCallPagesLast14Days: 0,
    manager1to1GapDays: 0,
    vacationDaysNext30: 0,
    asyncSentimentScore: 3.5,
    note: ""
  };
}

function afterHoursScore(dateString?: string) {
  if (!dateString) return 0;
  const hour = new Date(dateString).getUTCHours();
  return hour < 6 || hour > 18 ? 40 : 10;
}

function reviewLatencyHours(createdAt?: string, submittedAt?: string) {
  if (!createdAt || !submittedAt) return 0;
  return Math.max(0, Math.round((new Date(submittedAt).getTime() - new Date(createdAt).getTime()) / 36e5));
}

function sentimentScore(text: string) {
  const lower = text.toLowerCase();
  let score = 3.5;

  for (const token of ["blocked", "stuck", "burned", "overloaded", "frustrated", "exhausted"]) {
    if (lower.includes(token)) score -= 0.4;
  }

  for (const token of ["great", "thanks", "shipped", "resolved", "good", "clear"]) {
    if (lower.includes(token)) score += 0.2;
  }

  return Math.max(1, Math.min(5, Number(score.toFixed(1))));
}

export function normalizeGitHubPayload(event: string, payload: Record<string, unknown>): WorkerSignal[] {
  const sender = payload.sender as { login?: string } | undefined;
  const repository = payload.repository as { name?: string } | undefined;
  const pullRequest = payload.pull_request as {
    id?: number;
    user?: { login?: string };
    created_at?: string;
    updated_at?: string;
    title?: string;
  } | undefined;
  const review = payload.review as { submitted_at?: string; user?: { login?: string } } | undefined;
  const commits = Array.isArray(payload.commits) ? payload.commits : [];

  if (event === "pull_request" && pullRequest?.user?.login) {
    return [
      {
        ...defaultWorkerBase(`gh-${pullRequest.user.login}`, pullRequest.user.login),
        team: repository?.name || "GitHub",
        role: "Release Lane",
        prsOpenedLast14Days: 1,
        afterHoursWorkPct: afterHoursScore(pullRequest.updated_at),
        reviewLatencyHours: 0,
        note: `GitHub pull request captured from ${repository?.name || "repository"}: ${pullRequest.title || "Untitled PR"}. Use repeated PR events to track blocked work and release pressure.`
      }
    ];
  }

  if (event === "pull_request_review" && review?.user?.login) {
    return [
      {
        ...defaultWorkerBase(`gh-${review.user.login}`, review.user.login),
        team: repository?.name || "GitHub",
        role: "Code Review Queue",
        reviewLatencyHours: reviewLatencyHours(pullRequest?.created_at, review.submitted_at),
        focusHoursPerDay: 4,
        note: `GitHub review activity recorded for ${repository?.name || "repository"}. This event contributes to blocked-work and release-readiness scoring.`
      }
    ];
  }

  if (event === "push" && sender?.login) {
    return [
      {
        ...defaultWorkerBase(`gh-${sender.login}`, sender.login),
        team: repository?.name || "GitHub",
        role: "Deployment Change Stream",
        afterHoursWorkPct: afterHoursScore(String(payload.head_commit && typeof payload.head_commit === "object" ? (payload.head_commit as { timestamp?: string }).timestamp : undefined)),
        prsOpenedLast14Days: Math.max(1, commits.length),
        note: `GitHub push activity captured with ${commits.length} commit${commits.length === 1 ? "" : "s"}. Use commit bursts and after-hours pushes to model release risk.`
      }
    ];
  }

  return [];
}

export function normalizeSlackPayload(payload: Record<string, unknown>): WorkerSignal[] {
  const event = payload.event as { type?: string; user?: string; text?: string; channel?: string; ts?: string } | undefined;
  if (!event?.user) {
    return [];
  }

  const text = event.text || "";
  const score = sentimentScore(text);

  return [
    {
      ...defaultWorkerBase(`slack-${event.user}`, `Slack User ${event.user}`),
      team: String(event.channel || "Slack"),
      role: "Slack Escalation Feed",
      asyncSentimentScore: score,
      focusHoursPerDay: score < 3 ? 3.2 : 4.8,
      meetingLoadHours: text.toLowerCase().includes("sev") || text.toLowerCase().includes("incident") ? 14 : 8,
      onCallPagesLast14Days: text.toLowerCase().includes("incident") ? 2 : 0,
      note: `Slack signal captured from ${event.type || "event"}: ${text.slice(0, 180)}`
    }
  ];
}
