import { NextResponse } from "next/server";
import { verifySlackRequest } from "@/lib/slack/verify";
import { slack } from "@/lib/slack/client";
import { winModalView } from "@/lib/slack/modal";

export const runtime = "nodejs";

// Slash command webhook. Slack POSTs application/x-www-form-urlencoded.
//
// We must respond within 3 seconds. Opening a modal requires a
// `trigger_id` from the slash payload and a `views.open` API call, which we
// fire-and-forget after the 200 has gone out.
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

  if (command !== "/win") {
    return NextResponse.json(
      { response_type: "ephemeral", text: `Unknown command: ${command}` },
    );
  }

  // Fire and forget — Slack's 3s deadline applies to this HTTP response, not
  // to the modal-open call.
  void slack()
    .views.open({ trigger_id: triggerId, view: winModalView() })
    .catch((err: unknown) => {
      console.error("[slack:commands] views.open failed", err);
    });

  return new NextResponse(null, { status: 200 });
}
