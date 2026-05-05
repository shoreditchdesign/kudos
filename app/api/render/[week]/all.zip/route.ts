import { NextResponse } from "next/server";
import { zip } from "fflate";
import { buildWeekPayload } from "@/lib/render/payload";
import { renderSlidePng } from "@/lib/render/render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Slide rendering is heavier than the per-slide route since we render every
// slide in one request. Bump beyond the default 10s for safety on cold start.
export const maxDuration = 60;

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
  if (payload.slides.length === 0) {
    return NextResponse.json({ error: "no slides for this week" }, { status: 404 });
  }

  // Render every slide in parallel. Satori caches loaded fonts in-process,
  // so the first render warms up and the rest reuse that cache.
  let pngs: Uint8Array[];
  try {
    pngs = await Promise.all(payload.slides.map((s) => renderSlidePng(s)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "render failed";
    console.error("[zip-render]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const files: Record<string, Uint8Array> = {};
  pngs.forEach((png, i) => {
    const filename = `slide-${String(i + 1).padStart(2, "0")}.png`;
    files[filename] = png;
  });

  const archive = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 0 /* PNGs are already compressed; no point re-deflating */ }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const ab = new ArrayBuffer(archive.byteLength);
  new Uint8Array(ab).set(archive);

  return new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="kudos-${week}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
