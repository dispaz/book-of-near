/**
 * Projective maps for "printing" HTML onto a surface in the 3D scene: the box (0,0)–(w,h) of an element
 * is mapped onto the four screen points where a rectangle of the page lands. Pure maths, unit tested.
 */

/** Four screen points: top left, top right, bottom right, bottom left. */
export type Quad = [[number, number], [number, number], [number, number], [number, number]];

/**
 * The 3 x 3 projective matrix (row-major, last entry 1) that maps the box 0..w x 0..h onto `quad`:
 * x' = (a x + b y + c) / (g x + h y + 1), y' = (d x + e y + f) / (g x + h y + 1).
 */
export function homography(w: number, h: number, quad: Quad): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  // Unit square → quad (Heckbert's square-to-quad).
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let a: number, b: number, d: number, e: number, g: number, k: number;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = x1 - x0;
    b = x3 - x0;
    d = y1 - y0;
    e = y3 - y0;
    g = 0;
    k = 0;
  } else {
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    k = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + k * x3;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + k * y3;
  }
  // Box → unit square is a plain scale.
  return [a / w, b / h, x0, d / w, e / h, y0, g / w, k / h, 1];
}

export function applyHomography(m: number[], x: number, y: number): [number, number] {
  const w = m[6]! * x + m[7]! * y + m[8]!;
  return [(m[0]! * x + m[1]! * y + m[2]!) / w, (m[3]! * x + m[4]! * y + m[5]!) / w];
}

/** The matrix as a CSS `matrix3d(...)` (use with `transform-origin: 0 0`). */
export function matrix3d(m: number[]): string {
  const [a, b, c, d, e, f, g, h, i] = m as [number, ...number[]];
  const n = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, i];
  return `matrix3d(${n.map((v) => +v!.toPrecision(10)).join(",")})`;
}
