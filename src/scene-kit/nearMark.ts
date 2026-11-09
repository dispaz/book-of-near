/**
 * The NEAR mark (the "N" of the NEAR logo) as one SVG path, drawn on every coin: on the faces of the 3D
 * Coin (as a canvas texture) and on the 2D SvgCoin and coin icon. Pure data, shared by both kits.
 */
export const NEAR_MARK = {
  /** The mark's outline, in a 24 x 24 box. */
  path:
    "M15.2 4.6L12.3 8.9c-.2.3.2.7.5.4l2.9-2.5c.1-.1.2 0 .2.1v7.7c0 .1-.2.2-.3.1L6.9 4.4" +
    "c-.3-.4-.8-.6-1.2-.6h-.3C4.6 3.8 4 4.4 4 5.2v10.8c0 .8.6 1.4 1.4 1.4.5 0 .9-.3 1.2-.7" +
    "l2.9-4.3c.2-.3-.2-.7-.5-.4l-2.9 2.5c-.1.1-.2 0-.2-.1V6.7c0-.1.2-.2.3-.1l8.8 10.5" +
    "c.3.4.8.6 1.2.6h.3c.8 0 1.4-.6 1.4-1.4V5.2c0-.8-.6-1.4-1.4-1.4-.5 0-.9.2-1.2.6z",
  /** The mark's bounding box in that box: x, y, width, height. */
  box: [4, 3.8, 14.4, 13.8] as [number, number, number, number],
} as const;

/**
 * The SVG transform that centres the mark on (cx, cy) at `size` units across, squashed to `squash` of
 * its height (a coin seen from slightly above is an ellipse, so its mark is squashed the same way).
 */
export function markTransform(cx: number, cy: number, size: number, squash = 1): string {
  const [x, y, w, h] = NEAR_MARK.box;
  const s = size / Math.max(w, h);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `translate(${r(cx)} ${r(cy)}) scale(${r(s)} ${r(s * squash)}) translate(${r(-(x + w / 2))} ${r(-(y + h / 2))})`;
}
