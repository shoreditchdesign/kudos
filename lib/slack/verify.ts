import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Slack request-signing verification.
// https://api.slack.com/authentication/verifying-requests-from-slack
//
// The caller MUST pass the raw request body string — Slack signs the bytes
// it sent, not a re-serialized version. Route handlers should `await
// request.text()` once and pass it to both verify() and the parser.

const FIVE_MINUTES = 5 * 60 * 1000;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "stale" | "bad_signature" | "no_secret" };

export function verifySlackRequest(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  signingSecret?: string;
  now?: number;
}): VerifyResult {
  const secret = input.signingSecret ?? process.env.SLACK_SIGNING_SECRET;
  if (!secret) return { ok: false, reason: "no_secret" };

  if (!input.signature || !input.timestamp) {
    return { ok: false, reason: "missing_headers" };
  }

  const tsMs = Number(input.timestamp) * 1000;
  if (!Number.isFinite(tsMs)) return { ok: false, reason: "missing_headers" };

  const now = input.now ?? Date.now();
  if (Math.abs(now - tsMs) > FIVE_MINUTES) {
    return { ok: false, reason: "stale" };
  }

  const base = `v0:${input.timestamp}:${input.rawBody}`;
  const expected = "v0=" + createHmac("sha256", secret).update(base, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}
