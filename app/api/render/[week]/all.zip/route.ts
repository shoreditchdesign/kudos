import { NextResponse } from "next/server";
import { zip } from "fflate";
import { buildWeekPayload } from "@/lib/render/payload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  req: Request,
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

  // Fetch each slide PNG from the per-slide route rather than re-rendering
  // here. Two wins:
  //   1. Reuses the per-slide route's edge cache — if the user (or the
  //      page's prefetch) has hit them in the last 5min, the bytes are at
  //      the edge already.
  //   2. Splits the workload across N function instances instead of running
  //      15 Satori renders in a single invocation, which is what was timing
  //      out before.
  const baseUrl = inferBaseUrl(req);

  let pngs: Uint8Array[];
  try {
    pngs = await Promise.all(
      payload.slides.map(async (_, i) => {
        const res = await fetch(`${baseUrl}/api/render/${week}/${i}.png`, {
          // Edge cache; same semantics as a browser hitting the page.
          cache: "force-cache",
        });
        if (!res.ok) {
          throw new Error(`slide ${i} render returned ${res.status}`);
        }
        return new Uint8Array(await res.arrayBuffer());
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "render fetch failed";
    console.error("[zip-render]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const files: Record<string, Uint8Array> = {};
  pngs.forEach((png, i) => {
    files[`slide-${String(i + 1).padStart(2, "0")}.png`] = png;
  });

  // PNGs are already compressed; storing rather than deflating saves CPU
  // and barely changes the resulting size.
  const archive = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 0 }, (err, data) => {
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
      // 5-minute edge cache: re-clicking download is instant and doesn't
      // re-bundle. Matches the per-slide cache window.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

/**
 * Construct the base URL for self-fetches. Prefers APP_BASE_URL (set on
 * Vercel) but falls back to the request's host if absent.
 */
function inferBaseUrl(req: Request): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
