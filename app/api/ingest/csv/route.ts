import { NextResponse } from "next/server";
import { parseWorkerCsv } from "../../../../lib/csv";
import { isDatabaseConnectionError } from "../../../../lib/db";
import { isDatabaseConfigured } from "../../../../lib/env";
import { persistWorkerSignals } from "../../../../lib/repository";

export async function POST(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
    }

    const body = (await request.json()) as {
      csv?: string;
      organizationSlug?: string;
      organizationName?: string;
    };

    if (!body.csv) {
      return NextResponse.json({ error: "csv payload is required" }, { status: 400 });
    }

    const workers = parseWorkerCsv(body.csv);
    const result = await persistWorkerSignals({
      organizationSlug: body.organizationSlug,
      organizationName: body.organizationName,
      provider: "csv",
      workers,
      detailsJson: {
        source: "csv-upload"
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database is configured but currently unreachable or saturated. Retry later or run without persistence." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected ingest error" },
      { status: 500 }
    );
  }
}
