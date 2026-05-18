import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { isDatabaseConfigured } from "../../../../lib/env";

export async function POST() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
    }

    const connections = await db.sourceConnection.findMany({
      orderBy: {
        provider: "asc"
      }
    });

    return NextResponse.json({
      ok: true,
      scheduledConnections: connections.map((connection) => ({
        provider: connection.provider,
        status: connection.status,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null
      })),
      note: "Wire this route to a scheduler or cron job and replace placeholder execution with provider-specific backfill logic."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected job error" },
      { status: 500 }
    );
  }
}
