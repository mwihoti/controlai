import { NextResponse } from "next/server";
import { buildHeuristicReport, refineWithGemini } from "../../../lib/analysis";
import { isDatabaseConnectionError } from "../../../lib/db";
import type { SourceMetadata, WorkerSignal } from "../../../lib/types";
import { isDatabaseConfigured } from "../../../lib/env";
import { loadLatestWorkers, persistRiskReport, persistWorkerSignals } from "../../../lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      workers?: WorkerSignal[];
      organizationSlug?: string;
      organizationName?: string;
      persist?: boolean;
      provider?: string;
      sourceMetadata?: SourceMetadata;
    };

    const incomingWorkers = body.workers;
    const workers =
      incomingWorkers && Array.isArray(incomingWorkers) && incomingWorkers.length > 0
        ? incomingWorkers
        : body.organizationSlug && isDatabaseConfigured()
          ? await loadLatestWorkers(body.organizationSlug)
          : undefined;

    if (!workers || !Array.isArray(workers) || workers.length === 0) {
      return NextResponse.json({ error: "workers payload is required" }, { status: 400 });
    }

    const base = buildHeuristicReport(workers, body.prompt || "", {
      sourceMetadata: body.sourceMetadata
    });
    const enhanced = await refineWithGemini(base, body.prompt || "", workers, {
      sourceMetadata: body.sourceMetadata
    });

    let reportId: string | null = null;
    let persistenceWarning: string | null = null;
    if (body.persist && isDatabaseConfigured()) {
      try {
        await persistWorkerSignals({
          organizationSlug: body.organizationSlug,
          organizationName: body.organizationName,
          provider: body.provider || "manual",
          workers
        });
        reportId = await persistRiskReport(body.organizationSlug, enhanced, body.prompt || "");
      } catch (error) {
        if (isDatabaseConnectionError(error)) {
          persistenceWarning =
            "Report generated, but persistence was skipped because the database connection pool is exhausted or unreachable.";
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({
      ...enhanced,
      reportId,
      persistenceWarning
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 }
    );
  }
}
