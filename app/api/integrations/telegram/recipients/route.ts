import { NextResponse } from "next/server";
import { hasTelegramBotToken } from "../../../../../lib/env";
import { listTelegramRecipients } from "../../../../../lib/telegram";

export async function GET() {
  try {
    if (!hasTelegramBotToken()) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 503 });
    }

    const recipients = await listTelegramRecipients();
    return NextResponse.json({ recipients });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected Telegram recipients error" },
      { status: 500 }
    );
  }
}
