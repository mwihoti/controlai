import { NextResponse } from "next/server";
import { db, isDatabaseConnectionError } from "../../../lib/db";
import { hasGitHubToken, hasSlackBotToken, hasTelegramBotToken, isClerkConfigured, isDatabaseConfigured } from "../../../lib/env";

export async function GET() {
  let databaseReachable: boolean | null = null;

  if (isDatabaseConfigured()) {
    try {
      await db.$queryRaw`SELECT 1`;
      databaseReachable = true;
    } catch (error) {
      databaseReachable = isDatabaseConnectionError(error) ? false : null;
    }
  }

  return NextResponse.json({
    ok: true,
    environment: process.env.NODE_ENV || "development",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasDatabase: isDatabaseConfigured(),
    databaseReachable,
    hasClerk: isClerkConfigured(),
    hasGitHubToken: hasGitHubToken(),
    hasSlackBotToken: hasSlackBotToken(),
    hasTelegramBotToken: hasTelegramBotToken(),
    hasGitHubWebhookSecret: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
    hasSlackSigningSecret: Boolean(process.env.SLACK_SIGNING_SECRET),
    timestamp: new Date().toISOString()
  });
}
