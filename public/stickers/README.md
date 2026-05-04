# Stickers

Decorative overlays placed at random over the headshot grid on each slide.

For every win, the renderer:

1. Picks **2 stickers** from this directory (excluding `README.md`).
2. Picks **2 corners** from `{top-left, top-right, bottom-left, bottom-right}`.
3. Both choices are seeded by `winId`, so the same win always produces the same sticker layout (deterministic across refreshes).

Add or remove stickers by dropping/removing files. The renderer reads the directory listing at boot and treats whatever's there as the pool. Recommended pool size: 8–12.

Spec:

- Square or near-square crop is fine; the renderer scales them to a fixed display size and lets transparent areas pass through.
- PNG, WebP, JPEG, or SVG — Satori handles all four.
- ~256–512 px on the long edge.
- Transparent background works best, since stickers sit *over* the headshot composition.
