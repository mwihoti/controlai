export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function isClerkConfigured() {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

export function hasGitHubToken() {
  return Boolean(process.env.GITHUB_TOKEN || process.env.GITHUB_PAT);
}

export function hasSlackBotToken() {
  return Boolean(process.env.SLACK_BOT_TOKEN);
}

export function hasTelegramBotToken() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function defaultOrganizationSlug() {
  return process.env.DEFAULT_ORGANIZATION_SLUG || "primary-org";
}

export function defaultOrganizationName() {
  return process.env.DEFAULT_ORGANIZATION_NAME || "ControlTower AI Primary Org";
}
