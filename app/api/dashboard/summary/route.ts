import { NextResponse } from "next/server";
import { isDatabaseConnectionError } from "../../../../lib/db";
import { defaultOrganizationSlug, isDatabaseConfigured } from "../../../../lib/env";
import { loadDashboardSummary } from "../../../../lib/repository";

export async function GET(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const organizationSlug = searchParams.get("organizationSlug") || defaultOrganizationSlug();
    const summary = await loadDashboardSummary(organizationSlug);

    return NextResponse.json({
      organizationSlug,
      summary
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database is currently unreachable" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected dashboard summary error" },
      { status: 500 }
    );
  }
}
