export type RiskLevel = "low" | "medium" | "high";
export type AnalysisMode = "heuristic" | "gemini";
export type OpsCategory = "release" | "incident" | "blocked";

export interface WorkerSignal {
  id: string;
  name: string;
  team: string;
  role: string;
  location: string;
  manager: string;
  timezone: string;
  prsOpenedLast14Days: number;
  reviewLatencyHours: number;
  afterHoursWorkPct: number;
  meetingLoadHours: number;
  focusHoursPerDay: number;
  onCallPagesLast14Days: number;
  manager1to1GapDays: number;
  vacationDaysNext30: number;
  asyncSentimentScore: number;
  note: string;
}

export interface RiskAssessment {
  workerId: string;
  workerName: string;
  team: string;
  manager: string;
  riskLevel: RiskLevel;
  riskScore: number;
  category: OpsCategory;
  factors: string[];
  explanation: string;
  recommendedOwner: string;
  draftSlackEscalation: string;
  draftSummary: string;
  recommendation: string;
}

export interface TeamMetric {
  team: string;
  workerCount: number;
  averageReviewLatencyHours: number;
  averageAfterHoursWorkPct: number;
  averageFocusHoursPerDay: number;
  averageOnCallPages: number;
  averageRiskScore: number;
  highRiskCount: number;
}

export interface ForecastPoint {
  week: string;
  projectedFocusHoursPerDay: number;
  projectedAverageRisk: number;
}

export interface AuditEvent {
  stage: string;
  message: string;
}

export interface ManagerBrief {
  manager: string;
  summary: string;
  priorityWorkers: string[];
}

export interface ReadinessReport {
  dataQualityScore: number;
  coverageSummary: string;
  connectedSources: string[];
  recommendedOperationalFixes: string[];
}

export interface SourceMetadata {
  repoUrl?: string;
  repoFullName?: string;
  defaultBranch?: string;
  openPullRequests?: number;
  openIssues?: number;
  mergedPullRequests?: number;
  closedIssues?: number;
  analyzedOpenPullRequests?: number;
  analyzedOpenIssues?: number;
  analyzedClosedPullRequests?: number;
  analyzedClosedIssues?: number;
  lastPushAt?: string;
  contributorCount?: number;
  topContributors?: string[];
  maintainerEffortScore?: number;
  maintainerEffortRating?: string;
  contributorEffortScore?: number;
  contributorEffortRating?: string;
  mergedPullRequests7d?: number;
  mergedPullRequests30d?: number;
  closedIssues7d?: number;
  closedIssues30d?: number;
  averageMergeLeadHours?: number;
  openPrGrowthPressure?: number;
  topMergedPullRequests?: RankedRepoItem[];
  oldestOpenPullRequests?: RankedRepoItem[];
  recentlyClosedIssues?: RankedRepoItem[];
  oldestOpenIssues?: RankedRepoItem[];
}

export interface RankedRepoItem {
  id: string;
  title: string;
  number: number;
  url?: string;
  ageDays?: number;
  comments?: number;
  mergedAt?: string;
  closedAt?: string;
  author?: string;
}

export interface RepoIntelligence {
  headline: string;
  details: string[];
}

export interface ShareableInsight {
  id: string;
  title: string;
  description: string;
  content: string;
}

export interface SummaryStatus {
  engine: "heuristic" | "gemini";
  detail: string;
  geminiConfigured: boolean;
  error?: string | null;
}

export interface AnalysisResponse {
  reportId?: string | null;
  persistenceWarning?: string | null;
  generatedAt: string;
  mode: AnalysisMode;
  summaryStatus: SummaryStatus;
  orgSummary: string;
  teamSummary: string;
  repoIntelligence?: RepoIntelligence | null;
  shareableInsights?: ShareableInsight[];
  risks: RiskAssessment[];
  interventions: string[];
  teamMetrics: TeamMetric[];
  forecast: ForecastPoint[];
  managerBriefs: ManagerBrief[];
  anomalies: string[];
  auditTrail: AuditEvent[];
  readiness: ReadinessReport;
}

export interface DashboardSummary {
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  latestReport: AnalysisResponse | null;
  latestWorkers: WorkerSignal[];
  workerCount: number;
  sourceStatuses: Array<{
    provider: string;
    status: string;
    lastSyncedAt: string | null;
    metadata?: SourceMetadata | null;
  }>;
}
