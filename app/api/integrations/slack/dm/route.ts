import { NextResponse } from "next/server";
import { hasSlackBotToken } from "../../../../../lib/env";
import type { RiskAssessment } from "../../../../../lib/types";
import { lookupSlackUserByEmail, openSlackDm, postSlackMessage } from "../../../../../lib/slack";

function buildEscalationPack(risk: RiskAssessment) {
  return [
    `ControlTower AI escalation pack`,
    ``,
    `Service: ${risk.workerName}`,
    `Domain: ${risk.team}`,
    `Category: ${risk.category}`,
    `Risk: ${risk.riskLevel.toUpperCase()} (${risk.riskScore})`,
    `Owner: ${risk.recommendedOwner}`,
    ``,
    `Why flagged`,
    `${risk.explanation}`,
    ``,
    `Recommended action`,
    `${risk.recommendation}`,
    ``,
    `Slack message`,
    `${risk.draftSlackEscalation}`,
    ``,
    `Ops summary`,
    `${risk.draftSummary}`
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    if (!hasSlackBotToken()) {
      return NextResponse.json({ error: "SLACK_BOT_TOKEN is not configured" }, { status: 503 });
    }

    const body = (await request.json()) as {
      email?: string;
      risk?: RiskAssessment;
      content?: string;
    };

    if (!body.email) {
      return NextResponse.json({ error: "Slack email is required" }, { status: 400 });
    }

    if (!body.risk && !body.content) {
      return NextResponse.json({ error: "Risk payload or content is required" }, { status: 400 });
    }

    const user = await lookupSlackUserByEmail(body.email);
    const dm = await openSlackDm(user.user.id);
    const message = await postSlackMessage(
      dm.channel.id,
      body.content?.trim() || (body.risk ? buildEscalationPack(body.risk) : "")
    );

    return NextResponse.json({
      ok: true,
      userId: user.user.id,
      channelId: dm.channel.id,
      ts: message.ts
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected Slack DM error" },
      { status: 500 }
    );
  }
}
