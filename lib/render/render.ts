import "server-only";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { renderSlideJsx, SLIDE_DIMENSIONS } from "./layouts";
import { loadFonts } from "./fonts";
import { pickStickersForWin } from "./stickers";
import type { WinSlide } from "./layout";

/**
 * Render a single slide PNG. On-demand: called from the
 * /api/render/[week]/[file] route handler, once per slide.
 *
 * Returns the PNG as a Uint8Array.
 */
export async function renderSlidePng(slide: WinSlide): Promise<Uint8Array> {
  const [fonts, stickers] = await Promise.all([
    loadFonts(),
    pickStickersForWin(slide.winId),
  ]);

  const svg = await satori(renderSlideJsx(slide, stickers), {
    width: SLIDE_DIMENSIONS.width,
    height: SLIDE_DIMENSIONS.height,
    fonts,
  });

  return new Resvg(svg).render().asPng();
}
