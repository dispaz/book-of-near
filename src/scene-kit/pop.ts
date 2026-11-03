/**
 * Timeline of the pop-up book (seconds). When the page turns, the figure folds flat into a line drawing,
 * the page sweeps over it, the outlines rise off the new page and the hatching fills them in.
 * "grow" is the same without a page turn (the 3D view opening out of the 2D page). Pure, unit tested.
 */
export const POP = {
  /** The figure folds flat. */
  collapse: 0.18,
  turnStart: 0.05,
  turnEnd: 0.95,
  riseStart: 0.8,
  riseEnd: 1.75,
  fillStart: 1.35,
  fillEnd: 2.15,
} as const;

/** "grow" runs the rise and fill parts only, starting this many seconds early. */
const GROW_SHIFT = POP.riseStart - 0.35;

export type PopKind = "turn" | "grow";

export interface PopFrame {
  /** Height of the figure, 0..1 (with a little overshoot while it pops up). */
  scale: number;
  /** How much of the fill is drawn: 0 = outlines only, 1 = solid. */
  reveal: number;
  /** How far the turning page has gone, 0..1, or null when no page is turning. */
  turn: number | null;
  done: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
/** Ease out with a small overshoot, like paper popping up. */
const popOut = (u: number) => (u >= 1 ? 1 : 1 + 1.4 * Math.pow(u - 1, 3) + 0.4 * Math.pow(u - 1, 2));

const FLAT = 0.02;

export function popState(t: number, kind: PopKind): PopFrame {
  const at = kind === "grow" ? t + GROW_SHIFT : t;
  if (at >= POP.fillEnd) return { scale: 1, reveal: 1, turn: null, done: true };
  const rise = span(at, POP.riseStart, POP.riseEnd);
  const fold = kind === "turn" ? 1 - span(at, 0, POP.collapse) : 0;
  const scale = rise > 0 ? Math.max(FLAT, popOut(rise)) : Math.max(FLAT, fold);
  // The fill goes at once, so the page sweeps over a line drawing, and comes back after the rise.
  const reveal = span(at, POP.fillStart, POP.fillEnd);
  const turning = kind === "turn" && at >= POP.turnStart && at < POP.turnEnd;
  const turn = turning ? easeInOut(span(at, POP.turnStart, POP.turnEnd)) : null;
  return { scale, reveal, turn, done: false };
}
