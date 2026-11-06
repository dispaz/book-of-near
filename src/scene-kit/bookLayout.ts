/**
 * The pure parts of the book scene standard (docs/book-scene.md): the reading shot, page numbers, the
 * camera tour's cursor and where the free part of the canvas is. No three.js, no DOM, unit tested.
 */
import type { TextBlock } from "./book";
import { focusOf, type Box, type Focus, type Frame } from "./framing";

/** Screens at least this wide print the step on the book's left page; narrower ones keep it docked. */
export const PRINT_MIN_WIDTH = 1100;
/** Screens at least this wide put the scene beside the dock; narrower ones put it above. */
export const WIDE_MIN_WIDTH = 900;
/** Camera elevation for reading the printed page: steep enough that the type is easy to read. */
export const READING_ELEVATION = 52;
/** Seconds each shot of the tour holds before the camera moves on. */
export const SHOT_SECONDS = 3.4;

/** The reading shot: the step's figure and the words printed on the left page, seen from higher up. */
export function readingShot(figure: Focus, text: TextBlock, elevation = READING_ELEVATION): Focus {
  const [cx, , cz] = figure.center;
  const fig: Box = [
    cx - figure.width / 2,
    cx + figure.width / 2,
    cz - figure.depth / 2,
    cz + figure.depth / 2,
    figure.height,
  ];
  const words: Box = [text.x0, text.x1, text.z0, text.z1, 0];
  return focusOf([fig, words], elevation);
}

/** Page numbers printed at the foot of sheet `sheet`'s two pages (left even, right odd). */
export function folios(sheet: number, first = 4): [number, number] {
  return [first + 2 * sheet, first + 1 + 2 * sheet];
}

// ---------- the camera tour ----------

/** One shot of a figure's camera tour: a caption for the stage bar and what the camera looks at. */
export interface Shot<T> {
  caption: string;
  target: T;
}

/** Where a running tour is: which page it was started on, which shot, and whether it plays. */
export interface TourCursor {
  page: number | string;
  i: number;
  playing: boolean;
}

/** The cursor if it still applies to this page and its shots; a new page or fewer shots end the tour. */
export function activeCursor(c: TourCursor | null, page: number | string, count: number): TourCursor | null {
  return c && c.page === page && c.i < count ? c : null;
}

/** After a shot has held: the next shot, or null (back to the reading shot) after the last one. */
export function nextShot(c: TourCursor, count: number): TourCursor | null {
  return c.i + 1 < count ? { ...c, i: c.i + 1 } : null;
}

/** The play / pause button: start at the first shot, or pause / resume the current one. */
export function toggleTour(active: TourCursor | null, page: number | string): TourCursor {
  return active ? { ...active, playing: !active.playing } : { page, i: 0, playing: true };
}

// ---------- the free part of the canvas ----------

/**
 * The lesson page's chrome around a 3D book scene, in pixels relative to the scene's root element.
 * `null` where an element is missing. The step heading (`headBottom`) and dock are ignored while the
 * words are printed on the page.
 */
export interface Chrome {
  width: number;
  height: number;
  titleBottom: number | null;
  headBottom: number | null;
  dockTop: number | null;
  dockRight: number | null;
  barTop: number | null;
  /** Left edge of the side panel (the quiz / honest take), if shown. */
  sideLeft: number | null;
  /** Height of the scene's status note (0 when empty). */
  statusHeight: number;
  /** Height of the scene's own panel (0 when empty). */
  panelHeight: number;
}

export interface FreeFrame {
  /** Where the figure may go: `frameCamera` and `ViewOffset` fit the step into it. */
  frame: Frame;
  /** Wide enough to put the scene beside the dock. */
  wide: boolean;
  /** Wide enough to print the step on the left page (never at the quiz / honest take). */
  print: boolean;
  /** Pixels for the CSS variables `--book-t/l/r/b/sh` that place the status note, panel and strips. */
  vars: { t: number; l: number; r: number; b: number; sh: number };
}

/** The free part of the canvas, between the lesson's title, step heading, dock, stage bar and panels. */
export function freeFrame(
  c: Chrome,
  { summary, printMinWidth = PRINT_MIN_WIDTH }: { summary: boolean; printMinWidth?: number },
): FreeFrame {
  const W = c.width;
  const H = c.height;
  const wide = W >= WIDE_MIN_WIDTH;
  // Printed: the heading and note are part of the picture, not boxes over it, so the whole width
  // between the title and the bar is free.
  const print = W >= printMinWidth && !summary;
  const head = print ? null : c.headBottom;
  const dockTop = print ? null : c.dockTop;
  const dockRight = print ? null : c.dockRight;
  const top = Math.max(c.titleBottom ?? 100, head ?? 0) + 12;
  const dockT = dockTop ?? H * 0.55;
  const dockR = dockRight ?? 416;
  const barT = c.barTop ?? H - 72;
  let col: Frame;
  if (print) col = { left: 24, right: W - 24, top, bottom: barT - 14 };
  // The quiz / honest take: everything left of its panel, above the dock.
  else if (wide && summary)
    col = { left: 24, right: c.sideLeft !== null ? c.sideLeft - 32 : W - 24, top, bottom: dockT - 12 };
  else if (wide) col = { left: dockR + 32, right: W - 24, top, bottom: barT - 14 };
  else col = { left: 12, right: W - 12, top, bottom: dockT - 10 };
  const sh = c.statusHeight ? c.statusHeight + 6 : 0;
  const ph = c.panelHeight ? c.panelHeight + 8 : 0;
  // Keep a band of the scene visible, even when the panel is tall.
  const bottom = Math.max(col.top + 70, col.bottom - sh - ph);
  return {
    frame: { ...col, bottom },
    wide,
    print,
    vars: {
      t: Math.round(col.top),
      // The panel and the status note stay over the right page, clear of the printed words.
      l: Math.round(print ? W * 0.47 : col.left),
      r: Math.round(W - col.right),
      b: Math.round(H - col.bottom),
      sh,
    },
  };
}
