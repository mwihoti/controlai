import type {
  AnalysisResponse,
  AuditEvent,
  DashboardSummary,
  ForecastPoint,
  ManagerBrief,
  SourceMetadata,
  TeamMetric,
  WorkerSignal
} from "./types.ts";
import { db } from "./db";
import { defaultOrganizationName } from "./env";

function toJson<T>(value: T) {
  return value as unknown as object;
}

function normalizeSlug(input?: string) {
  return (input || "primary-org").trim().toLowerCase();
}

export async function ensureOrganization(slug?: string, name?: string) {
  const normalizedSlug = normalizeSlug(slug);
  return db.organization.upsert({
    where: { slug: normalizedSlug },
    update: { name: name || defaultOrganizationName() },
    create: {
      slug: normalizedSlug,
      name: name || defaultOrganizationName()
    }
  });
}

export async function ensureSourceConnection(organizationId: string, provider: string, configJson?: unknown) {
  return db.sourceConnection.upsert({
    where: {
      organizationId_provider: {
        organizationId,
        provider
      }
    },
    update: {
      status: "connected",
      configJson: configJson ? toJson(configJson) : undefined,
      lastSyncedAt: new Date()
    },
    create: {
      organizationId,
      provider,
      status: "connected",
      configJson: configJson ? toJson(configJson) : undefined,
      lastSyncedAt: new Date()
    }
  });
}

export async function persistWorkerSignals({
  organizationSlug,
  organizationName,
  provider,
  workers,
  configJson,
  detailsJson
}: {
  organizationSlug?: string;
  organizationName?: string;
  provider: string;
  workers: WorkerSignal[];
  configJson?: unknown;
  detailsJson?: unknown;
}) {
  const organization = await ensureOrganization(organizationSlug, organizationName);
  const sourceConnection = await ensureSourceConnection(organization.id, provider, configJson);
  const syncRun = await db.syncRun.create({
    data: {
      organizationId: organization.id,
      sourceConnectionId: sourceConnection.id,
      provider,
      status: "pending",
      detailsJson: detailsJson ? toJson(detailsJson) : undefined
    }
  });

  try {
    for (const worker of workers) {
      const profile = await db.workerProfile.upsert({
        where: {
          organizationId_externalId: {
            organizationId: organization.id,
            externalId: worker.id
          }
        },
        update: {
          name: worker.name,
          team: worker.team,
          role: worker.role,
          location: worker.location,
          manager: worker.manager,
          timezone: worker.timezone,
          prsOpenedLast14Days: worker.prsOpenedLast14Days,
          reviewLatencyHours: worker.reviewLatencyHours,
          afterHoursWorkPct: worker.afterHoursWorkPct,
          meetingLoadHours: worker.meetingLoadHours,
          focusHoursPerDay: worker.focusHoursPerDay,
          onCallPagesLast14Days: worker.onCallPagesLast14Days,
          manager1to1GapDays: worker.manager1to1GapDays,
          vacationDaysNext30: worker.vacationDaysNext30,
          asyncSentimentScore: worker.asyncSentimentScore,
          note: worker.note
        },
        create: {
          organizationId: organization.id,
          externalId: worker.id,
          name: worker.name,
          team: worker.team,
          role: worker.role,
          location: worker.location,
          manager: worker.manager,
          timezone: worker.timezone,
          prsOpenedLast14Days: worker.prsOpenedLast14Days,
          reviewLatencyHours: worker.reviewLatencyHours,
          afterHoursWorkPct: worker.afterHoursWorkPct,
          meetingLoadHours: worker.meetingLoadHours,
          focusHoursPerDay: worker.focusHoursPerDay,
          onCallPagesLast14Days: worker.onCallPagesLast14Days,
          manager1to1GapDays: worker.manager1to1GapDays,
          vacationDaysNext30: worker.vacationDaysNext30,
          asyncSentimentScore: worker.asyncSentimentScore,
          note: worker.note
        }
      });

      await db.signalSnapshot.create({
        data: {
          organizationId: organization.id,
          workerProfileId: profile.id,
          provider,
          prsOpenedLast14Days: worker.prsOpenedLast14Days,
          reviewLatencyHours: worker.reviewLatencyHours,
          afterHoursWorkPct: worker.afterHoursWorkPct,
          meetingLoadHours: worker.meetingLoadHours,
          focusHoursPerDay: worker.focusHoursPerDay,
          onCallPagesLast14Days: worker.onCallPagesLast14Days,
          manager1to1GapDays: worker.manager1to1GapDays,
          vacationDaysNext30: worker.vacationDaysNext30,
          asyncSentimentScore: worker.asyncSentimentScore,
          note: worker.note,
          rawJson: toJson(worker)
        }
      });
    }

    await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "success",
        recordsIngested: workers.length,
        completedAt: new Date()
      }
    });

    return {
      organization,
      syncRunId: syncRun.id,
      ingested: workers.length
    };
  } catch (error) {
    await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "error",
        completedAt: new Date(),
        detailsJson: toJson({
          ...(detailsJson && typeof detailsJson === "object" ? detailsJson : {}),
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    });

    throw error;
  }
}

export async function loadLatestWorkers(organizationSlug?: string): Promise<WorkerSignal[]> {
  const organization = await db.organization.findUnique({
    where: { slug: normalizeSlug(organizationSlug) },
    include: {
      workerProfiles: {
        orderBy: {
          updatedAt: "desc"
        }
      }
    }
  });

  if (!organization) {
    return [];
  }

  return organization.workerProfiles.map((worker) => ({
    id: worker.externalId,
    name: worker.name,
    team: worker.team,
    role: worker.role,
    location: worker.location,
    manager: worker.manager,
    timezone: worker.timezone,
    prsOpenedLast14Days: worker.prsOpenedLast14Days,
    reviewLatencyHours: worker.reviewLatencyHours,
    afterHoursWorkPct: worker.afterHoursWorkPct,
    meetingLoadHours: worker.meetingLoadHours,
    focusHoursPerDay: worker.focusHoursPerDay,
    onCallPagesLast14Days: worker.onCallPagesLast14Days,
    manager1to1GapDays: worker.manager1to1GapDays,
    vacationDaysNext30: worker.vacationDaysNext30,
    asyncSentimentScore: worker.asyncSentimentScore,
    note: worker.note
  }));
}

export async function persistRiskReport(organizationSlug: string | undefined, report: AnalysisResponse, prompt: string) {
  const organization = await ensureOrganization(organizationSlug);
  const workers = await db.workerProfile.findMany({
    where: { organizationId: organization.id }
  });
  const workerMap = new Map(workers.map((worker) => [worker.externalId, worker]));

  const record = await db.riskReport.create({
    data: {
      organizationId: organization.id,
      mode: report.mode,
      prompt,
      orgSummary: report.orgSummary,
      teamSummary: report.teamSummary,
      readinessScore: report.readiness.dataQualityScore,
      readinessSummary: report.readiness.coverageSummary,
      connectedSources: toJson(report.readiness.connectedSources),
      anomaliesJson: toJson(report.anomalies),
      forecastJson: toJson(report.forecast),
      teamMetricsJson: toJson(report.teamMetrics),
      auditTrailJson: toJson(report.auditTrail),
      itemCount: report.risks.length,
      reportItems: {
        create: report.risks.map((risk) => ({
          workerProfileId: workerMap.get(risk.workerId)?.id,
          workerName: risk.workerName,
          team: risk.team,
          manager: risk.manager,
          riskLevel: risk.riskLevel,
          riskScore: risk.riskScore,
          factorsJson: toJson(risk.factors),
          recommendation: risk.recommendation
        }))
      },
      managerBriefs: {
        create: report.managerBriefs.map((brief) => ({
          manager: brief.manager,
          summary: brief.summary,
          priorityWorkersJson: toJson(brief.priorityWorkers)
        }))
      },
      interventions: {
        create: report.interventions.map((summary) => ({
          summary
        }))
      },
      auditEvents: {
        create: report.auditTrail.map((event) => ({
          stage: event.stage,
          message: event.message
        }))
      }
    }
  });

  return record.id;
}

function parseJsonArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseJsonObject<T>(value: unknown): T | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : null;
}

function inferCategoryFromFactors(factors: string[]) {
  if (factors.includes("repeated incidents") || factors.includes("alert storm pressure")) {
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

function buildReportFromRecord(record: {
  id: string;
  generatedAt: Date;
  mode: string;
  orgSummary: string;
  teamSummary: string;
  readinessScore: number;
  readinessSummary: string;
  connectedSources: unknown;
  anomaliesJson: unknown;
  forecastJson: unknown;
  teamMetricsJson: unknown;
  reportItems: Array<{
    workerProfileId: string | null;
    workerName: string;
    team: string;
    manager: string;
    riskLevel: string;
    riskScore: number;
    factorsJson: unknown;
    recommendation: string;
  }>;
  managerBriefs: Array<{
    manager: string;
    summary: string;
    priorityWorkersJson: unknown;
  }>;
  interventions: Array<{ summary: string }>;
  auditEvents: Array<{
    stage: string;
    message: string;
  }>;
}): AnalysisResponse {
  return {
    reportId: record.id,
    generatedAt: record.generatedAt.toISOString(),
    mode: record.mode as AnalysisResponse["mode"],
    summaryStatus: {
      engine: record.mode as AnalysisResponse["mode"],
      geminiConfigured: false,
      detail:
        record.mode === "gemini"
          ? "Persisted report was previously refined with Gemini."
          : "Persisted report is using the saved heuristic summary."
    },
    orgSummary: record.orgSummary,
    teamSummary: record.teamSummary,
    risks: record.reportItems.map((item) => ({
      workerId: item.workerProfileId || item.workerName,
      workerName: item.workerName,
      team: item.team,
      manager: item.manager,
      riskLevel: item.riskLevel as "low" | "medium" | "high",
      riskScore: item.riskScore,
      category: inferCategoryFromFactors(parseJsonArray<string>(item.factorsJson)),
      factors: parseJsonArray<string>(item.factorsJson),
      explanation: `${item.workerName} is flagged because it combines ${parseJsonArray<string>(item.factorsJson).join(", ")}. Current score: ${item.riskScore}.`,
      recommendedOwner: item.manager,
      draftSlackEscalation: `Heads up: ${item.workerName} is showing ${parseJsonArray<string>(item.factorsJson).join(", ")} in ${item.team}. Suggested owner: ${item.manager}.`,
      draftSummary: `Service slice ${item.workerName} is operating at risk ${item.riskScore}. Primary signals: ${parseJsonArray<string>(item.factorsJson).join(", ")}.`,
      recommendation: item.recommendation
    })),
    interventions: record.interventions.map((item) => item.summary),
    teamMetrics: parseJsonArray<TeamMetric>(record.teamMetricsJson),
    forecast: parseJsonArray<ForecastPoint>(record.forecastJson),
    managerBriefs: record.managerBriefs.map((brief) => ({
      manager: brief.manager,
      summary: brief.summary,
      priorityWorkers: parseJsonArray<string>(brief.priorityWorkersJson)
    })),
    anomalies: parseJsonArray<string>(record.anomaliesJson),
    auditTrail: record.auditEvents.map((event) => ({
      stage: event.stage,
      message: event.message
    })) as AuditEvent[],
    readiness: {
      dataQualityScore: record.readinessScore,
      coverageSummary: record.readinessSummary,
      connectedSources: parseJsonArray<string>(record.connectedSources),
      recommendedOperationalFixes: []
    }
  };
}

export async function loadDashboardSummary(organizationSlug?: string): Promise<DashboardSummary | null> {
  const organization = await db.organization.findUnique({
    where: { slug: normalizeSlug(organizationSlug) },
    include: {
      workerProfiles: {
        orderBy: {
          updatedAt: "desc"
        }
      },
      sourceConnections: {
        orderBy: {
          provider: "asc"
        }
      },
      riskReports: {
        orderBy: {
          generatedAt: "desc"
        },
        take: 1,
        include: {
          reportItems: true,
          managerBriefs: true,
          interventions: true,
          auditEvents: true
        }
      }
    }
  });

  if (!organization) {
    return null;
  }

  return {
    organization: {
      id: organization.id,
      slug: organization.slug,
      name: organization.name
    },
    latestReport: organization.riskReports[0] ? buildReportFromRecord(organization.riskReports[0]) : null,
    latestWorkers: organization.workerProfiles.map((worker) => ({
      id: worker.externalId,
      name: worker.name,
      team: worker.team,
      role: worker.role,
      location: worker.location,
      manager: worker.manager,
      timezone: worker.timezone,
      prsOpenedLast14Days: worker.prsOpenedLast14Days,
      reviewLatencyHours: worker.reviewLatencyHours,
      afterHoursWorkPct: worker.afterHoursWorkPct,
      meetingLoadHours: worker.meetingLoadHours,
      focusHoursPerDay: worker.focusHoursPerDay,
      onCallPagesLast14Days: worker.onCallPagesLast14Days,
      manager1to1GapDays: worker.manager1to1GapDays,
      vacationDaysNext30: worker.vacationDaysNext30,
      asyncSentimentScore: worker.asyncSentimentScore,
      note: worker.note
    })),
    workerCount: organization.workerProfiles.length,
    sourceStatuses: organization.sourceConnections.map((connection) => ({
      provider: connection.provider,
      status: connection.status,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      metadata: parseJsonObject<SourceMetadata>(connection.configJson)
    }))
  };
}

export async function upsertAppUser({
  organizationSlug,
  clerkUserId,
  email,
  name,
  role
}: {
  organizationSlug?: string;
  clerkUserId?: string | null;
  email: string;
  name?: string | null;
  role?: "contributor" | "manager" | "admin";
}) {
  const organization = await ensureOrganization(organizationSlug);

  return db.appUser.upsert({
    where: clerkUserId ? { clerkUserId } : { email },
    update: {
      email,
      name: name || undefined,
      role: role || undefined,
      organizationId: organization.id
    },
    create: {
      organizationId: organization.id,
      clerkUserId: clerkUserId || undefined,
      email,
      name: name || undefined,
      role: role || undefined
    }
  });
}
