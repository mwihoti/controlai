import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "../../../../lib/env";
import { normalizeGitHubPayload } from "../../../../lib/integrations";
import { persistWorkerSignals } from "../../../../lib/repository";
import { verifyGitHubSignature } from "../../../../lib/security";

export async function POST(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    if (!verifyGitHubSignature(rawBody, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: "Invalid GitHub signature" }, { status: 401 });
    }

    const event = request.headers.get("x-github-event") || "unknown";
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const workers = normalizeGitHubPayload(event, payload);

    if (workers.length === 0) {
      return NextResponse.json({ ok: true, ignored: true, event });
    }

    const result = await persistWorkerSignals({
      organizationSlug: String((payload.organization as { login?: string } | undefined)?.login || "primary-org"),
      organizationName: String((payload.repository as { owner?: { login?: string } } | undefined)?.owner?.login || "GitHub Org"),
      provider: "github",
      workers,
      detailsJson: {
        event
      }
    });

    return NextResponse.json({
      ok: true,
      event,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected GitHub ingest error" },
      { status: 500 }
    );
  }
}
