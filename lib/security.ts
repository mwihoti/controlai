import { createHmac, timingSafeEqual } from "node:crypto";

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyGitHubSignature(payload: string, signature: string | null, secret: string | undefined) {
  if (!secret) return true;
  if (!signature) return false;

  const digest = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  return safeCompare(digest, signature);
}

export function verifySlackSignature({
  body,
  signature,
  timestamp,
  secret
}: {
  body: string;
  signature: string | null;
  timestamp: string | null;
  secret: string | undefined;
}) {
  if (!secret) return true;
  if (!signature || !timestamp) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > 60 * 5) {
    return false;
  }

  const base = `v0:${timestamp}:${body}`;
  const digest = `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
  return safeCompare(digest, signature);
}
