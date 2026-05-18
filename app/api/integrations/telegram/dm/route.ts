import { NextResponse } from "next/server";
import { hasTelegramBotToken } from "../../../../../lib/env";
import { postTelegramMessage, resolveTelegramChatId } from "../../../../../lib/telegram";
import type { RiskAssessment } from "../../../../../lib/types";

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
    `Telegram message`,
    `${risk.draftSlackEscalation}`,
    ``,
    `Ops summary`,
    `${risk.draftSummary}`
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    if (!hasTelegramBotToken()) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 503 });
    }

    const body = (await request.json()) as {
      recipient?: string;
      risk?: RiskAssessment;
      content?: string;
    };

    if (!body.recipient) {
      return NextResponse.json({ error: "Telegram username or chat ID is required" }, { status: 400 });
    }

    if (!body.risk && !body.content) {
      return NextResponse.json({ error: "Risk payload or content is required" }, { status: 400 });
    }

    const chatId = await resolveTelegramChatId(body.recipient);
    const message = await postTelegramMessage(
      chatId,
      body.content?.trim() || (body.risk ? buildEscalationPack(body.risk) : "")
    );

    return NextResponse.json({
      ok: true,
      chatId,
      messageId: message.result.message_id
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected Telegram DM error" },
      { status: 500 }
    );
  }
}
