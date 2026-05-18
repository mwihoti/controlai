import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "../../../../lib/env";
import { normalizeSlackPayload } from "../../../../lib/integrations";
import { persistWorkerSignals } from "../../../../lib/repository";
import { verifySlackSignature } from "../../../../lib/security";

export async function POST(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");

    if (!verifySlackSignature({ body: rawBody, signature, timestamp, secret: process.env.SLACK_SIGNING_SECRET })) {
      return NextResponse.json({ error: "Invalid Slack signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    if (payload.type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    const workers = normalizeSlackPayload(payload);
    if (workers.length === 0) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await persistWorkerSignals({
      organizationSlug: String(payload.team_id || "primary-org"),
      organizationName: String(payload.team_id || "Slack Workspace"),
      provider: "slack",
      workers,
      detailsJson: {
        type: payload.type || "event_callback"
      }
    });

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected Slack ingest error" },
      { status: 500 }
    );
  }
}
