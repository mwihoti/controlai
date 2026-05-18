function telegramBaseUrl() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  return `https://api.telegram.org/bot${token}`;
}

async function telegramApi<T>(method: string, body?: Record<string, unknown>) {
  const response = await fetch(`${telegramBaseUrl()}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body
      ? {
          "Content-Type": "application/json; charset=utf-8"
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  const payload = (await response.json()) as T & { ok?: boolean; description?: string };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.description || `Telegram API ${method} failed`);
  }

  return payload;
}

function isNumericChatId(value: string) {
  return /^-?\d+$/.test(value.trim());
}

export interface TelegramRecipient {
  chatId: string;
  username?: string;
  displayName: string;
}

export async function listTelegramRecipients(): Promise<TelegramRecipient[]> {
  const updates = await telegramApi<{
    result: Array<{
      message?: {
        chat?: {
          id?: number | string;
          username?: string;
          first_name?: string;
          last_name?: string;
          type?: string;
        };
        from?: {
          username?: string;
          first_name?: string;
          last_name?: string;
        };
      };
    }>;
  }>("getUpdates");

  const recipients = new Map<string, TelegramRecipient>();

  for (const item of updates.result) {
    const chat = item.message?.chat;
    if (!chat?.id) continue;

    const from = item.message?.from;
    const username = from?.username || chat.username;
    const first = from?.first_name || chat.first_name || "";
    const last = from?.last_name || chat.last_name || "";
    const displayName = `${first} ${last}`.trim() || username || `${chat.type || "chat"} ${chat.id}`;

    recipients.set(String(chat.id), {
      chatId: String(chat.id),
      username,
      displayName
    });
  }

  return [...recipients.values()];
}

export async function resolveTelegramChatId(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error("Telegram username or chat ID is required.");
  }

  if (isNumericChatId(trimmed)) {
    return trimmed;
  }

  const username = trimmed.replace(/^@/, "").toLowerCase();
  const updates = await telegramApi<{
    result: Array<{
      message?: {
        chat?: { id?: number | string; username?: string };
        from?: { username?: string };
      };
    }>;
  }>("getUpdates");

  const match = updates.result.find((item) => {
    const fromUsername = item.message?.from?.username?.toLowerCase();
    const chatUsername = item.message?.chat?.username?.toLowerCase();
    return fromUsername === username || chatUsername === username;
  });

  const chatId = match?.message?.chat?.id;
  if (!chatId) {
    throw new Error("Telegram user not found. Ask them to open the bot and press Start first, then retry.");
  }

  return String(chatId);
}

export async function postTelegramMessage(chatId: string, text: string) {
  return telegramApi<{
    result: {
      message_id: number;
      chat: { id: number | string };
    };
  }>("sendMessage", {
    chat_id: chatId,
    text
  });
}
