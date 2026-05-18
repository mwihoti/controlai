async function slackApi<T>(method: string, body: Record<string, unknown>) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Slack API ${method} failed`);
  }

  return payload;
}

export async function lookupSlackUserByEmail(email: string) {
  return slackApi<{
    user: {
      id: string;
      real_name?: string;
      profile?: {
        email?: string;
      };
    };
  }>("users.lookupByEmail", { email });
}

export async function openSlackDm(userId: string) {
  return slackApi<{
    channel: {
      id: string;
    };
  }>("conversations.open", { users: userId });
}

export async function postSlackMessage(channel: string, text: string) {
  return slackApi<{
    ts: string;
    channel: string;
  }>("chat.postMessage", { channel, text });
}
