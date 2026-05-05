import { NextResponse } from "next/server";
import { MEMBERS } from "@/config/members";
import type { LayoutVariant, WinSlide } from "@/lib/render/layout";
import { renderSlidePng } from "@/lib/render/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo route — renders one variant against synthetic data, no DB hit
// required. Useful for verifying the Satori pipeline in any environment.
//
// Usage:
//   /api/render/demo/solo
//   /api/render/demo/two
//   /api/render/demo/three
//   /api/render/demo/four
//   /api/render/demo/five
//   /api/render/demo/six
//   /api/render/demo/six-overflow   (variant=six with +N badge)
//   /api/render/demo/everyone
//
// Use `?count=12` to override the recipient count for the variant six
// overflow case.

const VALID = new Set([
  "solo",
  "two",
  "three",
  "four",
  "five",
  "six",
  "six-overflow",
  "everyone",
]);

const SAMPLE_MESSAGE =
  "Having to work against the clock on Figma, Word, Canva, Powerpoint, etc. — turned around the deck three times in a day and still landed every revision before the standup.";

const SAMPLE_SENDER = "Austin Joseph";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ variant: string }> },
) {
  const { variant } = await params;
  if (!VALID.has(variant)) {
    return NextResponse.json({ error: `unknown variant ${variant}` }, { status: 400 });
  }

  const url = new URL(req.url);
  const overrideCount = Number(url.searchParams.get("count") ?? "0");

  const slide = buildSampleSlide(variant, overrideCount);

  try {
    const png = await renderSlidePng(slide);
    const ab = new ArrayBuffer(png.byteLength);
    new Uint8Array(ab).set(png);
    return new NextResponse(ab, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "render failed";
    console.error("[render:demo]", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildSampleSlide(variant: string, overrideCount: number): WinSlide {
  const isEveryone = variant === "everyone";
  const baseVariant: LayoutVariant = (
    variant === "six-overflow" ? "six" : variant
  ) as LayoutVariant;

  const recipientCount =
    variant === "everyone"
      ? 0
      : overrideCount > 0
        ? overrideCount
        : variant === "six-overflow"
          ? 12
          : countForVariant(baseVariant);

  const visibleCount = Math.min(recipientCount, 6);
  const overflowCount = Math.max(0, recipientCount - 6);

  const recipients = isEveryone
    ? []
    : MEMBERS.slice(0, visibleCount).map((m) => ({
        slackUserId: m.slackUserId,
        fullName: m.fullName,
        headshotPath: m.headshotPath,
      }));

  return {
    winId: `demo-${variant}`,
    createdAt: new Date().toISOString(),
    variant: baseVariant,
    isEveryone,
    recipients,
    overflowCount,
    message: SAMPLE_MESSAGE,
    sender: {
      slackUserId: "DEMO",
      fullName: SAMPLE_SENDER,
      headshotPath: MEMBERS[2]?.headshotPath ?? "/headshots/computer.png",
    },
  };
}

function countForVariant(v: LayoutVariant): number {
  switch (v) {
    case "solo":
      return 1;
    case "two":
      return 2;
    case "three":
      return 3;
    case "four":
      return 4;
    case "five":
      return 5;
    case "six":
      return 6;
    default:
      return 1;
  }
}
