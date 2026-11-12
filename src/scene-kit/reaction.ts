/**
 * How a clickable object reacts (docs/book-scene.md rule 10a): pure maths, no three.js. `Pickable`
 * feeds it the hover, press and "not yet" progress every frame and writes the pose to the object.
 */

/** Hover lift (world units) at full hover. */
export const HOVER_LIFT = 0.14;
/** Seconds a hover lift or press squash takes to come in or go out. */
export const HOVER_SECONDS = 0.16;
export const PRESS_SECONDS = 0.09;
/** How long the "no" shake lasts. */
export const NOPE_SECONDS = 0.5;
/** How long the default pick animation (a hop with a twist) lasts. */
export const HOP_SECONDS = 0.55;
/** How long a "not yet" hint and a detail stay on screen. */
export const HINT_SECONDS = 3;
export const DETAIL_SECONDS = 6;

export interface ReactionInput {
  /** Hover progress, 0..1. */
  hover: number;
  /** Press progress, 0..1. */
  press: number;
  /** Seconds since the "not yet" shake began, or -1. */
  nope: number;
  reducedMotion: boolean;
}

/** Offsets from the object's own transform: a lift, a scale and a sideways shake. */
export interface ReactionPose {
  lift: number;
  sx: number;
  sy: number;
  sz: number;
  shake: number;
}

export const REST_POSE: ReactionPose = { lift: 0, sx: 1, sy: 1, sz: 1, shake: 0 };

/** The pose for this frame. Under reduced motion the object never moves (the outline still shows). */
export function reactionPose({ hover, press, nope, reducedMotion }: ReactionInput): ReactionPose {
  if (reducedMotion) return REST_POSE;
  const squash = 0.14 * press;
  const shake =
    nope >= 0 && nope < NOPE_SECONDS
      ? 0.12 * Math.sin((nope / NOPE_SECONDS) * Math.PI * 6) * (1 - nope / NOPE_SECONDS)
      : 0;
  return {
    lift: HOVER_LIFT * hover * (1 - press),
    sx: 1 + squash * 0.5,
    sy: 1 - squash,
    sz: 1 + squash * 0.5,
    shake,
  };
}

/** Moves `value` toward `target` by `dt / seconds` of the way from 0 to 1, landing on it exactly. */
export function approach(value: number, target: number, dt: number, seconds: number): number {
  const step = dt / seconds;
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

/** The default pick animation: a hop with a twist. `playing` is false once it has landed. */
export function hopPose(t: number): { lift: number; turn: number; playing: boolean } {
  if (t >= HOP_SECONDS) return { lift: 0, turn: 0, playing: false };
  const u = t / HOP_SECONDS;
  return { lift: 0.45 * Math.sin(u * Math.PI), turn: 0.35 * Math.sin(u * 2 * Math.PI), playing: true };
}

export type PickNote = { kind: "hint" | "detail"; text: string };

/** What a pick puts on screen: the "not yet" hint wins over a detail. */
export function pickNote(p: { disabledHint?: string; detail?: string }): PickNote | null {
  if (p.disabledHint) return { kind: "hint", text: p.disabledHint };
  if (p.detail) return { kind: "detail", text: p.detail };
  return null;
}
