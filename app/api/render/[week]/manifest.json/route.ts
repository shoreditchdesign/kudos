import { NextResponse } from "next/server";
import { buildWeekPayload } from "@/lib/render/payload";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PREVIEW_LENGTH = 140;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const { week } = await params;
  if (!ISO_DATE.test(week)) {
    return NextResponse.json({ error: "bad week" }, { status: 400 });
  }

  const payload = await buildWeekPayload(week);

  return NextResponse.json({
    weekStartDate: payload.weekStartDate,
    weekEndDate: payload.weekEndDate,
    slideCount: payload.slides.length,
    slides: payload.slides.map((s, i) => ({
      index: i,
      winId: s.winId,
      createdAt: s.createdAt,
      variant: s.variant,
      isEveryone: s.isEveryone,
      sender: s.sender,
      recipients: s.recipients,
      overflowCount: s.overflowCount,
      messagePreview: truncate(s.message, PREVIEW_LENGTH),
    })),
  });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max - 10 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + "…";
}
