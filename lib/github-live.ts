import type { WorkerSignal } from "./types.ts";

interface GitHubRepoRef {
  owner: string;
  repo: string;
}

interface GitHubLabel {
  name?: string;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  draft?: boolean;
  merged_at?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  html_url?: string;
  comments?: number;
  user?: {
    login?: string;
  };
  requested_reviewers?: Array<{ login?: string }>;
}

interface GitHubIssue {
  number: number;
  title: string;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  html_url?: string;
  comments?: number;
  user?: {
    login?: string;
  };
  labels?: GitHubLabel[];
  pull_request?: unknown;
}

interface GitHubCommit {
  commit?: {
    author?: {
      date?: string;
    };
    message?: string;
  };
}

interface GitHubRepo {
  full_name: string;
  default_branch: string;
  open_issues_count: number;
  stargazers_count: number;
  pushed_at: string;
}

interface GitHubContributor {
  login?: string;
  contributions?: number;
}

interface GitHubSearchResponse {
  total_count: number;
}

interface LiveSourceDetails {
  owner: string;
  repo: string;
  openPullRequests: number;
  openIssues: number;
  mergedPullRequests: number;
  closedIssues: number;
  analyzedOpenPullRequests: number;
  analyzedOpenIssues: number;
  analyzedClosedPullRequests: number;
  analyzedClosedIssues: number;
  repoFullName: string;
  defaultBranch: string;
  lastPushAt: string;
  contributorCount: number;
  topContributors: string[];
  maintainerEffortScore: number;
  maintainerEffortRating: string;
  contributorEffortScore: number;
  contributorEffortRating: string;
  mergedPullRequests7d: number;
  mergedPullRequests30d: number;
  closedIssues7d: number;
  closedIssues30d: number;
  averageMergeLeadHours: number;
  openPrGrowthPressure: number;
  topMergedPullRequests: import("./types.ts").RankedRepoItem[];
  oldestOpenPullRequests: import("./types.ts").RankedRepoItem[];
  recentlyClosedIssues: import("./types.ts").RankedRepoItem[];
  oldestOpenIssues: import("./types.ts").RankedRepoItem[];
}

function buildHeaders() {
  return buildHeadersWithToken(process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || undefined);
}

function buildHeadersWithToken(token?: string) {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "ControlTower-AI",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function fetchGitHubJson<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: token ? buildHeadersWithToken(token) : buildHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    const rateRemaining = response.headers.get("x-ratelimit-remaining");
    const rateReset = response.headers.get("x-ratelimit-reset");
    const text = await response.text();

    if (response.status === 403 && rateRemaining === "0") {
      const resetAt = rateReset ? new Date(Number(rateReset) * 1000).toLocaleString() : "later";
      throw new Error(`GitHub rate limit reached. Retry after ${resetAt} or use a token with more capacity.`);
    }

    if (response.status === 404) {
      throw new Error("Repository not found or not accessible with the current GitHub token.");
    }

    if (response.status === 401) {
      throw new Error("GitHub token is invalid or missing the required repository access.");
    }

    throw new Error(`GitHub API request failed (${response.status}): ${text.slice(0, 220)}`);
  }

  return (await response.json()) as T;
}

async function fetchGitHubCount(query: string, token?: string) {
  const payload = await fetchGitHubJson<GitHubSearchResponse>(
    `/search/issues?q=${encodeURIComponent(query)}&per_page=1`,
    token
  );
  return payload.total_count;
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hoursBetween(left: string, right: string) {
  return Math.max(0, (new Date(right).getTime() - new Date(left).getTime()) / 36e5);
}

function daysBetween(left: string, right: string) {
  return Math.max(0, (new Date(right).getTime() - new Date(left).getTime()) / 864e5);
}

function normalizeTitle(input: string) {
  return input
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hasAnyLabel(issue: GitHubIssue, tokens: string[]) {
  const labels = issue.labels?.map((label) => (label.name || "").toLowerCase()) || [];
  return labels.some((label) => tokens.some((token) => label.includes(token)));
}

function noteFromTopItems(prefix: string, items: string[]) {
  return `${prefix} ${items.slice(0, 3).join(" | ")}`.trim();
}

export function parseGitHubRepoUrl(input: string): GitHubRepoRef {
  try {
    const url = new URL(input.trim());
    if (url.hostname !== "github.com") {
      throw new Error("Only github.com repository URLs are supported.");
    }

    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) {
      throw new Error("Enter a full GitHub repository URL like https://github.com/org/repo.");
    }

    return {
      owner,
      repo: repo.replace(/\.git$/, "")
    };
  } catch {
    throw new Error("Enter a valid GitHub repository URL like https://github.com/org/repo.");
  }
}

export async function buildLiveRepoSignals(repoUrl: string): Promise<{
  workers: WorkerSignal[];
  repository: GitHubRepo;
  sourceDetails: LiveSourceDetails;
}> {
  return buildLiveRepoSignalsWithToken(repoUrl);
}

export async function buildLiveRepoSignalsWithToken(repoUrl: string, token?: string): Promise<{
  workers: WorkerSignal[];
  repository: GitHubRepo;
  sourceDetails: LiveSourceDetails;
}> {
  const { owner, repo } = parseGitHubRepoUrl(repoUrl);
  const now = new Date().toISOString();
  const today = new Date();
  const date7d = new Date(today);
  date7d.setDate(today.getDate() - 7);
  const date30d = new Date(today);
  date30d.setDate(today.getDate() - 30);
  const date7dIso = date7d.toISOString().slice(0, 10);
  const date30dIso = date30d.toISOString().slice(0, 10);
  const repository = await fetchGitHubJson<GitHubRepo>(`/repos/${owner}/${repo}`, token);
  const [
    openPullRequestCount,
    openIssueCount,
    mergedPullRequestCount,
    closedIssueCount,
    mergedPullRequestCount7d,
    mergedPullRequestCount30d,
    closedIssueCount7d,
    closedIssueCount30d,
    pulls,
    issues,
    closedPulls,
    closedIssues,
    commits,
    contributors
  ] = await Promise.all([
    fetchGitHubCount(`repo:${owner}/${repo} is:pr state:open`, token).catch(() => 0),
    fetchGitHubCount(`repo:${owner}/${repo} is:issue state:open`, token).catch(() => 0),
    fetchGitHubCount(`repo:${owner}/${repo} is:pr is:merged`, token).catch(() => 0),
    fetchGitHubCount(`repo:${owner}/${repo} is:issue state:closed`, token).catch(() => 0),
    fetchGitHubCount(`repo:${owner}/${repo} is:pr is:merged merged:>=${date7dIso}`, token).catch(() => 0),
    fetchGitHubCount(`repo:${owner}/${repo} is:pr is:merged merged:>=${date30dIso}`, token).catch(() => 0),
    fetchGitHubCount(`repo:${owner}/${repo} is:issue state:closed closed:>=${date7dIso}`, token).catch(() => 0),
    fetchGitHubCount(`repo:${owner}/${repo} is:issue state:closed closed:>=${date30dIso}`, token).catch(() => 0),
    fetchGitHubJson<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=100&sort=updated&direction=desc`, token),
    fetchGitHubJson<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?state=open&per_page=100&sort=updated&direction=desc`, token),
    fetchGitHubJson<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`, token).catch(() => []),
    fetchGitHubJson<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?state=closed&per_page=100&sort=updated&direction=desc`, token).catch(() => []),
    fetchGitHubJson<GitHubCommit[]>(
      `/repos/${owner}/${repo}/commits?per_page=25&sha=${encodeURIComponent(repository.default_branch)}`
    , token).catch(() => []),
    fetchGitHubJson<GitHubContributor[]>(`/repos/${owner}/${repo}/contributors?per_page=8`, token).catch(() => [])
  ]);

  const nonPrIssues = issues.filter((issue) => !issue.pull_request);
  const nonPrClosedIssues = closedIssues.filter((issue) => !issue.pull_request);
  const issueCount = openIssueCount || nonPrIssues.length;
  const mergedPullRequests = mergedPullRequestCount || closedPulls.filter((pr) => Boolean(pr.merged_at)).length;
  const closedIssuesTotal = closedIssueCount || nonPrClosedIssues.length;
  const repoLabel = normalizeTitle(repo);
  const domain = repository.full_name;

  const prAges = pulls.map((pr) => hoursBetween(pr.created_at, now));
  const stalePrs = pulls.filter((pr) => hoursBetween(pr.created_at, now) >= 48).length;
  const blockedPrs = pulls.filter((pr) => pr.draft || (pr.requested_reviewers?.length || 0) > 0).length;
  const reviewDelayHours = pulls.length > 0 ? Math.round(clamp(avg(prAges), 4, 72)) : 6;
  const averageMergeLeadHours = closedPulls.length > 0
    ? Math.round(avg(closedPulls.filter((pr) => Boolean(pr.merged_at)).map((pr) => hoursBetween(pr.created_at, pr.merged_at || now))))
    : 0;
  const openPrGrowthPressure = mergedPullRequestCount7d > 0 ? Number((openPullRequestCount / mergedPullRequestCount7d).toFixed(1)) : openPullRequestCount;

  const priorityIssues = nonPrIssues.filter((issue) =>
    hasAnyLabel(issue, ["p0", "p1", "priority", "critical", "urgent", "blocker", "sev"])
  );
  const incidentIssues = nonPrIssues.filter((issue) => {
    const title = issue.title.toLowerCase();
    return (
      hasAnyLabel(issue, ["incident", "outage", "bug", "sev", "hotfix", "failure"]) ||
      ["incident", "outage", "hotfix", "failure", "panic", "crash"].some((token) => title.includes(token))
    );
  });
  const oldestPriorityAgeDays = priorityIssues.length > 0
    ? Math.round(clamp(Math.max(...priorityIssues.map((issue) => daysBetween(issue.created_at, now))), 1, 30))
    : 0;

  const afterHoursCommitCount = commits.filter((commit) => {
    const date = commit.commit?.author?.date;
    if (!date) return false;
    const hour = new Date(date).getUTCHours();
    return hour < 6 || hour > 18;
  }).length;
  const releaseFailureRisk = Math.round(clamp(18 + stalePrs * 8 + blockedPrs * 7 + incidentIssues.length * 6 + afterHoursCommitCount * 2, 8, 96));
  const runbookScore = Number(clamp(5.1 - (incidentIssues.length * 0.22 + stalePrs * 0.12 + blockedPrs * 0.18), 2.4, 5.2).toFixed(1));
  const escalationScore = Number(clamp(4.2 - (incidentIssues.length * 0.18 + priorityIssues.length * 0.12 + blockedPrs * 0.08), 1.8, 4.6).toFixed(1));
  const contributorCount = contributors.length;
  const topContributors = contributors
    .slice(0, 3)
    .map((contributor) => contributor.login)
    .filter((value): value is string => Boolean(value));
  const maintainerEffortScore = Math.min(100, blockedPrs * 12 + Math.round(reviewDelayHours / 4) + priorityIssues.length * 8);
  const contributorEffortScore = Math.min(100, Math.round(avg(contributors.map((contributor) => contributor.contributions || 0)) * 2) + stalePrs * 6 + afterHoursCommitCount * 4);
  const maintainerEffortRating = maintainerEffortScore >= 70 ? "high" : maintainerEffortScore >= 40 ? "medium" : "low";
  const contributorEffortRating = contributorEffortScore >= 70 ? "high" : contributorEffortScore >= 40 ? "medium" : "low";

  const releaseNote = noteFromTopItems(
    `Live GitHub release signal for ${domain}.`,
    pulls.map((pr) => `PR #${pr.number}: ${pr.title}`)
  );
  const issueFeedRole = incidentIssues.length > 0 ? "Live GitHub Issue Feed" : "Live GitHub Backlog Feed";
  const issueQueueLabel = incidentIssues.length > 0 ? `${repoLabel} Incident Queue` : `${repoLabel} Backlog Queue`;
  const issueNote = noteFromTopItems(
    incidentIssues.length > 0 ? `Live GitHub issue signal for ${domain}.` : `Live GitHub backlog signal for ${domain}.`,
    nonPrIssues.map((issue) => `Issue #${issue.number}: ${issue.title}`)
  );
  const topMergedPullRequests = closedPulls
    .filter((pr) => Boolean(pr.merged_at))
    .sort((left, right) => new Date(right.merged_at || 0).getTime() - new Date(left.merged_at || 0).getTime())
    .slice(0, 10)
    .map((pr) => ({
      id: `pr-${pr.number}`,
      title: pr.title,
      number: pr.number,
      url: pr.html_url,
      mergedAt: pr.merged_at || undefined,
      comments: pr.comments || 0,
      author: pr.user?.login
    }));
  const oldestOpenPullRequests = pulls
    .slice()
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
    .slice(0, 10)
    .map((pr) => ({
      id: `open-pr-${pr.number}`,
      title: pr.title,
      number: pr.number,
      url: pr.html_url,
      ageDays: Math.round(daysBetween(pr.created_at, now)),
      comments: pr.comments || 0,
      author: pr.user?.login
    }));
  const recentlyClosedIssues = nonPrClosedIssues
    .slice()
    .sort((left, right) => new Date(right.closed_at || right.updated_at).getTime() - new Date(left.closed_at || left.updated_at).getTime())
    .slice(0, 10)
    .map((issue) => ({
      id: `closed-issue-${issue.number}`,
      title: issue.title,
      number: issue.number,
      url: issue.html_url,
      closedAt: issue.closed_at || undefined,
      comments: issue.comments || 0,
      author: issue.user?.login
    }));
  const oldestOpenIssues = nonPrIssues
    .slice()
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
    .slice(0, 10)
    .map((issue) => ({
      id: `open-issue-${issue.number}`,
      title: issue.title,
      number: issue.number,
      url: issue.html_url,
      ageDays: Math.round(daysBetween(issue.created_at, now)),
      comments: issue.comments || 0,
      author: issue.user?.login
    }));

  const workers: WorkerSignal[] = [
    {
      id: `${owner}-${repo}-release`,
      name: `${repoLabel} Release Lane`,
      team: domain,
      role: "Live GitHub Release Stream",
      location: "github-api",
      manager: `${owner} maintainers`,
      timezone: repository.default_branch,
      prsOpenedLast14Days: stalePrs,
      reviewLatencyHours: reviewDelayHours,
      afterHoursWorkPct: releaseFailureRisk,
      meetingLoadHours: clamp(6 + incidentIssues.length * 2 + priorityIssues.length * 1.5, 4, 18),
      focusHoursPerDay: runbookScore,
      onCallPagesLast14Days: clamp(incidentIssues.length, 0, 6),
      manager1to1GapDays: oldestPriorityAgeDays,
      vacationDaysNext30: clamp(blockedPrs, 0, 5),
      asyncSentimentScore: escalationScore,
      note: releaseNote
    },
    {
      id: `${owner}-${repo}-incidents`,
      name: issueQueueLabel,
      team: domain,
      role: issueFeedRole,
      location: "github-api",
      manager: `${owner} issue triage`,
      timezone: repository.default_branch,
      prsOpenedLast14Days: Math.max(1, Math.round(stalePrs / 2)),
      reviewLatencyHours: nonPrIssues.length > 0 ? Math.round(clamp(avg(nonPrIssues.map((issue) => hoursBetween(issue.updated_at, now))), 3, 48)) : 6,
      afterHoursWorkPct: Math.round(clamp(10 + incidentIssues.length * 9 + priorityIssues.length * 3, 10, 72)),
      meetingLoadHours: clamp(4 + incidentIssues.length * 2 + priorityIssues.length * 0.75, 4, 14),
      focusHoursPerDay: Number(clamp(5 - incidentIssues.length * 0.22 - priorityIssues.length * 0.06, 2.8, 5).toFixed(1)),
      onCallPagesLast14Days: clamp(incidentIssues.length, 0, 4),
      manager1to1GapDays: oldestPriorityAgeDays,
      vacationDaysNext30: clamp(Math.round(incidentIssues.length / 2), 0, 3),
      asyncSentimentScore: Number(clamp(4 - incidentIssues.length * 0.14 - priorityIssues.length * 0.04, 2.4, 4.5).toFixed(1)),
      note: issueNote
    },
    {
      id: `${owner}-${repo}-blocked`,
      name: `${repoLabel} Blocker Queue`,
      team: domain,
      role: "Live GitHub PR Queue",
      location: "github-api",
      manager: `${owner} reviewers`,
      timezone: repository.default_branch,
      prsOpenedLast14Days: clamp(blockedPrs || stalePrs, 1, 12),
      reviewLatencyHours: Math.max(reviewDelayHours, 1),
      afterHoursWorkPct: Math.round(clamp(16 + blockedPrs * 9 + stalePrs * 4, 12, 92)),
      meetingLoadHours: clamp(4 + priorityIssues.length + blockedPrs * 1.5, 4, 16),
      focusHoursPerDay: Number(clamp(4.7 - blockedPrs * 0.28 - stalePrs * 0.12, 2.3, 4.9).toFixed(1)),
      onCallPagesLast14Days: clamp(Math.round(incidentIssues.length / 2), 0, 4),
      manager1to1GapDays: clamp(Math.max(oldestPriorityAgeDays, blockedPrs * 4), 2, 30),
      vacationDaysNext30: clamp(blockedPrs, 0, 5),
      asyncSentimentScore: Number(clamp(3.5 - blockedPrs * 0.12 - stalePrs * 0.06, 2, 4.2).toFixed(1)),
      note: releaseNote
    }
  ];

  return {
    workers,
    repository,
    sourceDetails: {
      owner,
      repo,
      openPullRequests: openPullRequestCount || pulls.length,
      openIssues: issueCount,
      mergedPullRequests,
      closedIssues: closedIssuesTotal,
      analyzedOpenPullRequests: pulls.length,
      analyzedOpenIssues: nonPrIssues.length,
      analyzedClosedPullRequests: closedPulls.length,
      analyzedClosedIssues: nonPrClosedIssues.length,
      repoFullName: repository.full_name,
      defaultBranch: repository.default_branch,
      lastPushAt: repository.pushed_at,
      contributorCount,
      topContributors,
      maintainerEffortScore,
      maintainerEffortRating,
      contributorEffortScore,
      contributorEffortRating,
      mergedPullRequests7d: mergedPullRequestCount7d,
      mergedPullRequests30d: mergedPullRequestCount30d,
      closedIssues7d: closedIssueCount7d,
      closedIssues30d: closedIssueCount30d,
      averageMergeLeadHours,
      openPrGrowthPressure,
      topMergedPullRequests,
      oldestOpenPullRequests,
      recentlyClosedIssues,
      oldestOpenIssues
    }
  };
}
