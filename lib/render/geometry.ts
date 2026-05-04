// Exact headshot + sticker coordinates for each layout variant, taken from
// the Figma source (file cmuEjKJYLnaDRaKCKOdMqw, references node 7318:964).
//
// All coordinates are in slide pixel space (1920x1080). The grid origin in
// each variant is (80, 110.5) — the top-left of the `grid` frame inside the
// `left` panel — and headshot rectangles in this file are pre-summed so
// layouts.tsx can drop them in as `position: absolute; left: Xpx; top: Ypx`.

import type { LayoutVariant } from "./layout";

export type HeadshotSlot = {
  /** absolute left in slide coords */
  left: number;
  /** absolute top in slide coords */
  top: number;
  width: number;
  height: number;
};

const GRID_ORIGIN = { x: 80, y: 110.5 };

function slot(
  rowOffsetX: number,
  rowOffsetY: number,
  innerX: number,
  innerY: number,
  w: number,
  h: number,
): HeadshotSlot {
  return {
    left: GRID_ORIGIN.x + rowOffsetX + innerX,
    top: GRID_ORIGIN.y + rowOffsetY + innerY,
    width: w,
    height: h,
  };
}

// Per-variant slot tables. Numbers are taken directly from the Figma metadata
// (`row` offset within `grid`, `headshot-image` offset within `row`).
//
// In Figma the headshots overlap by ~46-50px so the pills tile together
// — that's preserved here by allowing slot rectangles to overlap.

export const HEADSHOT_SLOTS: Record<Exclude<LayoutVariant, "everyone">, HeadshotSlot[]> = {
  solo: [
    // row at (0, 0), 810x860; headshot 500x688 centered with +32 horizontal nudge
    // row inner: left = (810-500)/2 + 32 = 187; top = (860-688)/2 = 86
    slot(0, 0, 187, 86, 500, 688),
  ],
  two: [
    // row at (57.65, 175.20), 694.7x509.6
    slot(57.65, 175.2, 0, 0, 370.35, 509.6),
    slot(57.65, 175.2, 324.35, 0, 370.35, 509.6),
  ],
  three: [
    // row1 at (95.19, 38.92), 619.6x454.5
    slot(95.19, 38.92, 0, 0, 330.33, 454.53),
    slot(95.19, 38.92, 289.3, 0, 330.33, 454.53),
    // row2 at (239.84, 366.56), single 330x454.5
    slot(239.84, 366.56, 0, 0, 330.33, 454.53),
  ],
  four: [
    // row1 at (51.27, 63.22), 581.1x426.3
    slot(51.27, 63.22, 0, 0, 309.8, 426.28),
    slot(51.27, 63.22, 271.32, 0, 309.8, 426.28),
    // row2 at (177.62, 370.50), 581.1x426.3
    slot(177.62, 370.5, 0, 0, 309.8, 426.28),
    slot(177.62, 370.5, 271.32, 0, 309.8, 426.28),
  ],
  five: [
    // row1 at (21.39, 99.88), 767.2x383.7 — 3 headshots
    slot(21.39, 99.88, 0, 0, 278.83, 383.67),
    slot(21.39, 99.88, 244.2, 0, 278.83, 383.67),
    slot(21.39, 99.88, 488.4, 0, 278.83, 383.67),
    // row2 at (143.49, 376.45), 523.0x383.7 — 2 headshots
    slot(143.49, 376.45, 0, 0, 278.83, 383.67),
    slot(143.49, 376.45, 244.2, 0, 278.83, 383.67),
  ],
  six: [
    // row1 at (21.39, 99.88), 767.2x383.7 — 3 headshots
    slot(21.39, 99.88, 0, 0, 278.83, 383.67),
    slot(21.39, 99.88, 244.2, 0, 278.83, 383.67),
    slot(21.39, 99.88, 488.4, 0, 278.83, 383.67),
    // row2 at (21.39, 376.45), 767.2x383.7 — 3 headshots
    slot(21.39, 376.45, 0, 0, 278.83, 383.67),
    slot(21.39, 376.45, 244.2, 0, 278.83, 383.67),
    slot(21.39, 376.45, 488.4, 0, 278.83, 383.67),
  ],
};

// Everyone variant: a single 810x810 square at (80, 135.5) in slide coords.
// (The grid origin is (80, 110.5); the everyone frame sits at y=135.5 in the
// slide, i.e. 25px below the grid top.)
export const EVERYONE_SLOT: HeadshotSlot = {
  left: 80,
  top: 135.5,
  width: 810,
  height: 810,
};

// Sticker corner positions (180x180 each), inside the left panel.
// Figma exports two: top-right (679, 150.5) and bottom-left (135, 674.5).
// The other two corners are mirror positions so the renderer can pick any 2.
export const STICKER_CORNERS = {
  topLeft: { left: 135, top: 150.5, width: 180, height: 180 },
  topRight: { left: 679, top: 150.5, width: 180, height: 180 },
  bottomLeft: { left: 135, top: 674.5, width: 180, height: 180 },
  bottomRight: { left: 679, top: 674.5, width: 180, height: 180 },
} as const;

export type StickerCorner = keyof typeof STICKER_CORNERS;
