// Slide layout types.
//
// One slide per win. The variant is a function of the recipient count:
//
//   1            -> "solo"
//   2            -> "two"
//   3            -> "three"
//   4            -> "four"
//   5            -> "five"
//   6+           -> "six"   (with an overflowCount badge if recipientCount > 6)
//   "@everyone"  -> "everyone"
//
// All variants render at 1920x1080. Per-variant headshot geometry lives in
// lib/render/geometry.ts so layouts.tsx can stay declarative.

export type LayoutVariant =
  | "solo"
  | "two"
  | "three"
  | "four"
  | "five"
  | "six"
  | "everyone";

export type WinRecipient = {
  slackUserId: string;
  fullName: string;
  headshotPath: string; // path under /public, e.g. "/headshots/alice.png"
};

export type WinSlide = {
  winId: string;
  createdAt: string;
  variant: LayoutVariant;
  isEveryone: boolean;
  /**
   * Up to 6 recipients (or empty if isEveryone). Order is preserved from the
   * Slack modal submission, deduplicated, sender-removed.
   */
  recipients: WinRecipient[];
  /**
   * If recipientCount > 6, this is recipientCount - 6 — drives the +N badge
   * on the bottom-right capsule of the variant-six layout. 0 otherwise.
   */
  overflowCount: number;
  message: string;
  sender: WinRecipient;
};

export type WeekPayload = {
  weekStartDate: string;
  weekEndDate: string;
  slides: WinSlide[];
};

const SENTINEL = "@everyone";

export function pickVariant(input: {
  recipientCount: number;
  isEveryone: boolean;
}): LayoutVariant {
  if (input.isEveryone) return "everyone";
  switch (input.recipientCount) {
    case 1:
      return "solo";
    case 2:
      return "two";
    case 3:
      return "three";
    case 4:
      return "four";
    case 5:
      return "five";
    default:
      return "six"; // 6+
  }
}

export function isEveryoneRecipientList(slackIds: readonly string[]): boolean {
  return slackIds.length === 1 && slackIds[0] === SENTINEL;
}

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;
