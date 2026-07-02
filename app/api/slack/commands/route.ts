import { NextResponse } from "next/server";
import { verifySlackRequest } from "@/lib/slack/verify";
import { slack } from "@/lib/slack/client";
import { winModalView } from "@/lib/slack/modal";

export const runtime = "nodejs";

// Slash command webhook. Slack POSTs application/x-www-form-urlencoded.
//
// We must respond within 3 seconds. Opening a modal requires a
// `trigger_id` from the slash payload and a `views.open` API call, which we
// await before the 200 goes out (see comment at the call site).
export async function POST(req: Request) {
  const rawBody = await req.text();

  const verify = verifySlackRequest({
    rawBody,
    signature: req.headers.get("x-slack-signature"),
    timestamp: req.headers.get("x-slack-request-timestamp"),
  });
  if (!verify.ok) {
    return new NextResponse(`bad signature: ${verify.reason}`, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const command = params.get("command") ?? "";
  const triggerId = params.get("trigger_id") ?? "";

  // Slack only sends commands registered on this app, so any incoming
  // command from a verified request is one we registered. We accept it
  // regardless of the literal name so renaming the slash command in
  // Slack admin doesn't require a code change.
  if (!command.startsWith("/") || !triggerId) {
    return NextResponse.json(
      { response_type: "ephemeral", text: `Unknown command: ${command}` },
    );
  }

  // Must be awaited: on serverless the instance freezes once the response is
  // returned, so a fire-and-forget call often never reaches Slack. views.open
  // is fast enough to fit inside Slack's 3s ack window.
  try {
    await slack().views.open({ trigger_id: triggerId, view: winModalView() });
  } catch (err: unknown) {
    console.error("[slack:commands] views.open failed", err);
  }

  return new NextResponse(null, { status: 200 });
}
