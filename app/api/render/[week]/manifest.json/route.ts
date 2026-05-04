import { NextResponse } from "next/server";
import { buildWeekPayload } from "@/lib/render/payload";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const { week } = await params;
  if (!ISO_DATE.test(week)) {
    return NextResponse.json({ error: "bad week" }, { status: 400 });
  }

  const payload = await buildWeekPayload(week);

  // Per-slide manifest so the copy page can render one card per win without
  // re-fetching every PNG to know how many there are.
  return NextResponse.json({
    weekStartDate: payload.weekStartDate,
    weekEndDate: payload.weekEndDate,
    slideCount: payload.slides.length,
    slides: payload.slides.map((s, i) => ({
      index: i,
      winId: s.winId,
      variant: s.variant,
      isEveryone: s.isEveryone,
      recipientCount: s.recipients.length + s.overflowCount,
      senderFullName: s.senderFullName,
    })),
  });
}
