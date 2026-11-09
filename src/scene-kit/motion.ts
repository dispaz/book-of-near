/**
 * Pure maths shared by the 3D kit and the SVG fallback kit. No three.js here, so the
 * fallback (which loads eagerly with the lesson manifest) stays free of 3D code.
 */
export type Vec3 = readonly [number, number, number];

/** A camera preset: where the camera sits and what it looks at. */
export interface CameraView {
  position: Vec3;
  target: Vec3;
}

/** A pointer that moved less than this many pixels between down and up is a click, not a drag. */
export const CLICK_PX = 6;
export const isClick = (movedPx: number) => movedPx < CLICK_PX;

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

/** Cubic ease in and out. */
export function easeInOut(u: number): number {
  const t = clamp01(u);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** A point on a hop from `from` to `to` that rises `height` at its middle. `u` runs 0..1. */
export function arcPoint(from: Vec3, to: Vec3, height: number, u: number): [number, number, number] {
  const t = clamp01(u);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return [lerp(from[0], to[0]), lerp(from[1], to[1]) + Math.sin(t * Math.PI) * height, lerp(from[2], to[2])];
}

/** Straight-line distance between two points. */
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The top-down version of a view: straight above the same target, a little further away. */
export function toFlat(view: CameraView): CameraView {
  const [x, y, z] = view.target;
  // A tiny z offset keeps OrbitControls' up vector stable when looking straight down.
  return { target: view.target, position: [x, y + distance(view.position, view.target) * 1.15, z + 0.001] };
}

/** Pull the camera back along its line of sight on narrow screens so the scene still fits. */
export function fitView(view: CameraView, aspect: number): CameraView {
  const k = aspect < 0.6 ? 1.5 : aspect < 1 ? 1.25 : 1;
  if (k === 1) return view;
  const [tx, ty, tz] = view.target;
  const [px, py, pz] = view.position;
  return { target: view.target, position: [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k] };
}

/**
 * The camera's (and the picture's view offset's) glide time constant, in seconds: 60 % of
 * the way after one EASE_SECONDS, 90 % after two. A critically damped spring, so it starts gently,
 * never overshoots and bends smoothly when the goal changes mid-flight.
 */
export const EASE_SECONDS = 0.45;

/**
 * Longest frame time (seconds) any kit animation advances by in one frame (camera glide, view offset,
 * a Traveller's hop, the orbit damping): a slow device still animates, a stalled frame cannot jump.
 */
export const MAX_FRAME_STEP = 0.1;

/**
 * OrbitControls' damping per update at 60 Hz. `dampingFor(dt)` scales it to the frame time so the
 * learner's drag coasts the same at any frame rate.
 */
export const DAMPING = 0.06;
export const dampingFor = (dt: number) => 1 - Math.pow(1 - DAMPING, Math.min(dt, MAX_FRAME_STEP) * 60);

/**
 * Whether a press has become a camera gesture: the pointer travelled at least `CLICK_PX` (the same
 * threshold a pick uses, so a press is either a pick or a move, never both), or the learner zoomed
 * (wheel, pinch) or used two fingers.
 */
export const isCameraGesture = (travelPx: number, zoomOrMulti: boolean) => zoomOrMulti || !isClick(travelPx);

/**
 * One step of a critically damped spring from `current` towards `goal` (Game Programming Gems 4,
 * "Critically Damped Ease-In/Ease-Out Smoothing"). `dt` is the frame time in seconds, so the motion is
 * the same at 30, 60 or 120 frames a second. Returns the new value and the new velocity.
 */
export function smoothDamp(
  current: number,
  goal: number,
  velocity: number,
  smoothTime: number,
  dt: number,
): [value: number, velocity: number] {
  if (dt <= 0) return [current, velocity];
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - goal;
  const temp = (velocity + omega * change) * dt;
  let v = (velocity - omega * temp) * decay;
  let out = goal + (change + temp) * decay;
  // Never pass the goal.
  if (goal - current > 0 === out > goal) {
    out = goal;
    v = 0;
  }
  return [out, v];
}

/** `offset` shortened to at most `limit` long (same direction). */
export function clampLength(offset: Vec3, limit: number): [number, number, number] {
  const len = Math.hypot(offset[0], offset[1], offset[2]);
  if (len <= limit || len === 0) return [offset[0], offset[1], offset[2]];
  const k = Math.max(0, limit) / len;
  return [offset[0] * k, offset[1] * k, offset[2] * k];
}

/** How far the learner may move the camera away from a step's view (CameraRig): the one source. */
export const ORBIT = {
  /** Turn at most this far either side of the step's view (radians): a 90° wedge, not all the way round. */
  azimuth: Math.PI / 4,
  /** Zoom out at most this many times the step's distance. */
  zoomOut: 1.3,
  /**
   * Outside a book: slide at most this share of the camera's distance from where the learner took over.
   * Book scenes hold the slide to the open book instead (`bookFootprint`).
   */
  pan: 0.15,
} as const;

/** An angle in -π..π. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The orbit limits round a camera preset, for OrbitControls: the azimuth range (min > max means it wraps
 * through ±π) and the furthest zoom. The zoom stays under the lesson's `maxDistance` but never comes
 * closer than the preset itself, so the limits never fight the rig.
 */
export function orbitLimits(
  view: CameraView,
  minDistance: number,
  maxDistance: number,
): { minAzimuth: number; maxAzimuth: number; maxDistance: number } {
  const [px, , pz] = view.position;
  const [tx, , tz] = view.target;
  const az = Math.atan2(px - tx, pz - tz);
  const d = distance(view.position, view.target);
  return {
    minAzimuth: wrap(az - ORBIT.azimuth),
    maxAzimuth: wrap(az + ORBIT.azimuth),
    maxDistance: Math.max(d, minDistance, Math.min(maxDistance, d * ORBIT.zoomOut)),
  };
}
