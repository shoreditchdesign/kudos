// Block-kit payload for the /win modal.
//
// Three inputs:
//   - everyone (optional checkbox): "Add whole team — overrides selected people"
//   - recipients: multi_users_select (Slack-native @-mention picker, optional
//     when the "everyone" box is ticked)
//   - message: multi-line plain_text_input (capped at MESSAGE_MAX chars)
//
// Slack does not allow a single picker to mix users + user-groups; user-group
// support is intentionally deferred (see docs/master-architecture.md §15).

import { MESSAGE_MAX } from "@/lib/wins";

export const MODAL_CALLBACK_ID = "submit_win";
export const RECIPIENTS_BLOCK_ID = "recipients_block";
export const RECIPIENTS_ACTION_ID = "recipients";
export const MESSAGE_BLOCK_ID = "message_block";
export const MESSAGE_ACTION_ID = "message";
export const EVERYONE_BLOCK_ID = "everyone_block";
export const EVERYONE_ACTION_ID = "everyone";
export const EVERYONE_OPTION_VALUE = "everyone";

export function winModalView() {
  return {
    type: "modal" as const,
    callback_id: MODAL_CALLBACK_ID,
    title: { type: "plain_text" as const, text: "Send a win" },
    submit: { type: "plain_text" as const, text: "Send" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input" as const,
        block_id: EVERYONE_BLOCK_ID,
        optional: true,
        label: { type: "plain_text" as const, text: " " },
        element: {
          type: "checkboxes" as const,
          action_id: EVERYONE_ACTION_ID,
          options: [
            {
              text: {
                type: "plain_text" as const,
                text: "Add whole team",
              },
              description: {
                type: "plain_text" as const,
                text: "Sends to everyone — overrides the selection below.",
              },
              value: EVERYONE_OPTION_VALUE,
            },
          ],
        },
      },
      {
        type: "input" as const,
        block_id: RECIPIENTS_BLOCK_ID,
        optional: true,
        label: { type: "plain_text" as const, text: "Who's it for?" },
        element: {
          type: "multi_users_select" as const,
          action_id: RECIPIENTS_ACTION_ID,
          placeholder: { type: "plain_text" as const, text: "Pick people" },
          max_selected_items: 30,
        },
      },
      {
        type: "input" as const,
        block_id: MESSAGE_BLOCK_ID,
        label: { type: "plain_text" as const, text: "What did they do?" },
        element: {
          type: "plain_text_input" as const,
          action_id: MESSAGE_ACTION_ID,
          multiline: true,
          max_length: MESSAGE_MAX,
          placeholder: {
            type: "plain_text" as const,
            text: "Be specific. Past tense. No need to overthink it.",
          },
        },
      },
    ],
  };
}

export type ParsedSubmission = {
  senderSlackId: string;
  recipientSlackIds: string[];
  message: string;
  isEveryone: boolean;
};

type ViewState = {
  values?: Record<string, Record<string, {
    selected_users?: string[];
    selected_options?: Array<{ value?: string }>;
    value?: string;
  }>>;
};

/**
 * Pull the inputs out of a `view_submission` payload. Throws if the shape is
 * unexpected — Slack would only ship something this far if it matched the
 * modal we sent, so a throw here means a real bug.
 */
export function parseSubmission(payload: {
  user?: { id?: string };
  view?: { state?: ViewState };
}): ParsedSubmission {
  const senderSlackId = payload.user?.id;
  if (!senderSlackId) throw new Error("submission missing user.id");

  const values = payload.view?.state?.values ?? {};

  const everyoneSelections =
    values[EVERYONE_BLOCK_ID]?.[EVERYONE_ACTION_ID]?.selected_options ?? [];
  const isEveryone = everyoneSelections.some(
    (o) => o?.value === EVERYONE_OPTION_VALUE,
  );

  const recipients =
    values[RECIPIENTS_BLOCK_ID]?.[RECIPIENTS_ACTION_ID]?.selected_users ?? [];
  const message =
    values[MESSAGE_BLOCK_ID]?.[MESSAGE_ACTION_ID]?.value ?? "";

  return {
    senderSlackId,
    recipientSlackIds: recipients,
    message,
    isEveryone,
  };
}
