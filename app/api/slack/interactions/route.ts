import { NextResponse } from "next/server";
import { verifySlackRequest } from "@/lib/slack/verify";
import {
  MODAL_CALLBACK_ID,
  MESSAGE_BLOCK_ID,
  RECIPIENTS_BLOCK_ID,
  parseSubmission,
} from "@/lib/slack/modal";
import { insertWin } from "@/lib/wins";
import { slack } from "@/lib/slack/client";
import { MEMBERS_BY_SLACK_ID } from "@/config/members";

export const runtime = "nodejs";

// Slack interactivity webhook. The body is application/x-www-form-urlencoded
// with a `payload=<json>` field. The supported interaction is `view_submission`
// for the /win modal.
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
  const payloadRaw = params.get("payload");
  if (!payloadRaw) return new NextResponse("missing payload", { status: 400 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadRaw) as Record<string, unknown>;
  } catch {
    return new NextResponse("bad payload", { status: 400 });
  }

  if (payload.type !== "view_submission") {
    // We don't subscribe to other interaction types; ack with 200 to be safe.
    return new NextResponse(null, { status: 200 });
  }

  const view = payload.view as { callback_id?: string } | undefined;
  if (view?.callback_id !== MODAL_CALLBACK_ID) {
    return new NextResponse(null, { status: 200 });
  }

  const submission = parseSubmission(payload as Parameters<typeof parseSubmission>[0]);

  // Inline validation. When `isEveryone` is set the user picker is ignored,
  // so we only require *one* of the two recipient sources.
  const errors: Record<string, string> = {};
  if (!submission.isEveryone && submission.recipientSlackIds.length === 0) {
    errors[RECIPIENTS_BLOCK_ID] = "Pick at least one person, or tick 'Add whole team'.";
  }
  if (!submission.message.trim()) {
    errors[MESSAGE_BLOCK_ID] = "Add a short message.";
  }
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ response_action: "errors", errors });
  }

  try {
    await insertWin(submission);
  } catch (err) {
    console.error("[slack:interactions] insertWin failed", err);
    return NextResponse.json({
      response_action: "errors",
      errors: {
        [MESSAGE_BLOCK_ID]: "Couldn't save — try again or ping #help.",
      },
    });
  }

  // Side-effects: ephemeral confirmation + missing-roster warnings.
  void sendConfirmation(submission).catch((err: unknown) => {
    console.error("[slack:interactions] confirmation send failed", err);
  });

  // Close the modal.
  return NextResponse.json({ response_action: "clear" });
}

async function sendConfirmation(submission: {
  senderSlackId: string;
  recipientSlackIds: string[];
  isEveryone: boolean;
}) {
  if (submission.isEveryone) {
    await slack().chat.postEphemeral({
      channel: submission.senderSlackId,
      user: submission.senderSlackId,
      text: "Logged your win, addressed to the whole team.",
    });
    return;
  }

  const unknown = submission.recipientSlackIds.filter(
    (id) => !MEMBERS_BY_SLACK_ID[id],
  );

  let text =
    `Logged your win. Sent to ${submission.recipientSlackIds.length} ` +
    `${submission.recipientSlackIds.length === 1 ? "person" : "people"}.`;

  if (unknown.length > 0) {
    text +=
      `\n\n:warning: ${unknown.length} of them aren't in the team roster yet:` +
      ` ${unknown.map((id) => `<@${id}>`).join(", ")}.` +
      ` It'll still appear on the slides as their Slack handle —` +
      ` ping the operator to add them to \`config/members.ts\`.`;
  }

  await slack().chat.postEphemeral({
    channel: submission.senderSlackId,
    user: submission.senderSlackId,
    text,
  });
}
