import { NextResponse } from "next/server";
import { buildWeekPayload } from "@/lib/render/payload";
import { renderSlidePng } from "@/lib/render/render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FILE = /^(\d+)(?:\.png)?$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ week: string; file: string }> },
) {
  const { week, file } = await params;
  if (!ISO_DATE.test(week)) {
    return NextResponse.json({ error: "bad week" }, { status: 400 });
  }

  const m = file.match(FILE);
  if (!m) {
    return NextResponse.json({ error: "bad file" }, { status: 400 });
  }
  const slideIndex = Number(m[1]);

  const payload = await buildWeekPayload(week);
  const slide = payload.slides[slideIndex];
  if (!slide) {
    return NextResponse.json({ error: "slide out of range" }, { status: 404 });
  }

  try {
    const png = await renderSlidePng(slide);
    const ab = new ArrayBuffer(png.byteLength);
    new Uint8Array(ab).set(png);
    return new NextResponse(ab, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "render failed";
    console.error("[render]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
