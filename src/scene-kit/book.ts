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
  /** Width of one page (along x). Both pages are the same, either side of the spine at x = 0. */
  pageWidth: number;
  /** Depth of the pages (along z). */
  pageDepth: number;
  center: [number, number, number];
}

/** The smallest open spread, spine at x = 0, that holds a box of scene content with a margin round it. */
export function spreadFor(
  box: { minX: number; maxX: number; minZ: number; maxZ: number },
  margin = { side: 1.1, front: 0.9, back: 0.9 },
): Spread {
  const pageWidth = Math.max(Math.abs(box.minX), Math.abs(box.maxX)) + margin.side;
  const back = box.minZ - margin.back;
  const front = box.maxZ + margin.front;
  return { pageWidth, pageDepth: front - back, center: [0, 0, (back + front) / 2] };
}
