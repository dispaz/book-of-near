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

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The top-down version of a view: straight above the same target, a little further away. */
export function toFlat(view: CameraView): CameraView {
  const [x, y, z] = view.target;
  // A tiny z offset keeps OrbitControls' up vector stable when looking straight down.
  return { target: view.target, position: [x, y + dist(view.position, view.target) * 1.15, z + 0.001] };
}

/** Pull the camera back along its line of sight on narrow screens so the scene still fits. */
export function fitView(view: CameraView, aspect: number): CameraView {
  const k = aspect < 0.6 ? 1.5 : aspect < 1 ? 1.25 : 1;
  if (k === 1) return view;
  const [tx, ty, tz] = view.target;
  const [px, py, pz] = view.position;
  return { target: view.target, position: [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k] };
}
