/**
 * Shape of the open pop-up book that a 3D scene can stand on (BookBackdrop). Pure numbers, no three.js,
 * so it can be unit tested. The spine runs along z at x = 0; pages lie at y = 0 where objects stand.
 */
export const BOOK = {
  /** Depth of the page valley at the spine. */
  valley: 0.16,
  /** How far from the spine the valley reaches before the page is flat. */
  gutter: 0.95,
  /** How much the outer edge of a page curls down, and over what width. */
  droop: 0.05,
  droopWidth: 0.6,
  /** Thickness of each stack of pages (below y = 0). */
  stack: 0.36,
  /** Thickness of the cover boards and how far they stick out past the pages. */
  cover: 0.07,
  overhang: 0.2,
} as const;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Height of a page's surface at distance `d` from the spine (0..width). 0 across the middle. */
export function pageHeight(d: number, width: number): number {
  const s = smoothstep(0, BOOK.gutter, d);
  const valley = -BOOK.valley * (1 - s) * (1 - s);
  const droop = -BOOK.droop * smoothstep(width - BOOK.droopWidth, width, d);
  return valley + droop;
}

export interface Spread {
  /** Width of one page (along x). Both pages are the same, either side of the spine. */
  pageWidth: number;
  /** Depth of the pages (along z). */
  pageDepth: number;
  /** The middle of the spine: x of the spine, y = 0, z half way between the back and front edges. */
  center: [number, number, number];
}

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

/** The smallest open spread, spine at x = 0, that holds a box of scene content with a margin round it. */
export function spreadFor(box: Box, margin = { side: 1.1, front: 0.9, back: 0.9 }): Spread {
  const pageWidth = Math.max(Math.abs(box.minX), Math.abs(box.maxX)) + margin.side;
  const back = box.minZ - margin.back;
  const front = box.maxZ + margin.front;
  return { pageWidth, pageDepth: front - back, center: [0, 0, (back + front) / 2] };
}

/**
 * A spread whose RIGHT page holds the box (the figure), so the left page is free for printed text.
 * The spine sits `margin.side` left of the box.
 */
export function spreadBeside(box: Box, margin = { side: 1.1, front: 0.9, back: 0.9 }): Spread {
  const spine = box.minX - margin.side;
  const back = box.minZ - margin.back;
  const front = box.maxZ + margin.front;
  return {
    pageWidth: box.maxX + margin.side - spine,
    pageDepth: front - back,
    center: [spine, 0, (back + front) / 2],
  };
}

/** Where text is printed on a spread's left page: a flat rectangle clear of the gutter, in world units. */
export interface TextBlock {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The text block of the left page: `width` wide, from just outside the gutter, between the head and foot. */
export function textBlock(s: Spread, width = 6.2): TextBlock {
  const [spine, , cz] = s.center;
  const x1 = spine - BOOK.gutter - 0.45;
  const room = s.pageWidth - BOOK.gutter - 0.45 - BOOK.droopWidth - 0.4;
  return {
    x0: x1 - Math.min(width, room),
    x1,
    z0: cz - s.pageDepth / 2 + 0.95,
    z1: cz + s.pageDepth / 2 - 0.85,
  };
}

/**
 * The cross-section of a page turning over the spine, as `n + 1` points (x, y) from the spine (0, 0)
 * to the page's free edge. `theta` runs from 0 (lying on the right page) to π (on the left page).
 * The free edge leads, so the page curls as it lifts. Length is kept: each step is W / n long.
 */
export function curlProfile(theta: number, W: number, n: number): [number, number][] {
  const bend = 0.9 * Math.sin(theta);
  const ds = W / n;
  const sag = Math.cos(theta) ** 2;
  const pts: [number, number][] = [[0, pageHeight(0, W) * sag + 0.015]];
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const mid = (i + 0.5) / n;
    const phi = theta + bend * mid * mid;
    x += Math.cos(phi) * ds;
    y += Math.sin(phi) * ds;
    // Near rest it follows the page's own curve, so it lands in the gutter.
    pts.push([x, y + pageHeight(Math.abs(x), W) * sag + 0.015]);
  }
  return pts;
}
