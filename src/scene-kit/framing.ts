/**
 * Camera framing for the 3D view (pure maths, no three.js, unit tested).
 * The 3D canvas fills the whole lesson page, but only part of it is free: the title, the docked step
 * card, panels and the stage bar cover the rest. Each step names the box of the world that must be
 * seen (`Focus`); `frameCamera` places the camera so that box fills the free rectangle (`Frame`),
 * and `viewOffset` shifts the picture so the box sits in the middle of that rectangle.
 */
import type { CameraView, Vec3 } from "./motion";

/** A box of the world to keep in view: centre, width (x), depth (z) and height (y). */
export interface Focus {
  center: Vec3;
  width: number;
  depth: number;
  height: number;
  /** Camera elevation above the ground, in degrees. */
  elevation?: number;
  /** Turn around the box (degrees, positive looks from the right). */
  azimuth?: number;
}

/** The free part of the canvas, in CSS pixels from the canvas' top left corner. */
export interface Frame {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Pixels to keep free on each side of a frame, for HTML tags that hang off the objects. */
export type Reserve = Partial<Frame>;

/** The frame minus the reserved margins. Never thinner than 80 px. */
export function inset(frame: Frame, r: Reserve = {}): Frame {
  const left = frame.left + (r.left ?? 0);
  const top = frame.top + (r.top ?? 0);
  return {
    left,
    top,
    right: Math.max(left + 80, frame.right - (r.right ?? 0)),
    bottom: Math.max(top + 80, frame.bottom - (r.bottom ?? 0)),
  };
}

/** Field of view the kit's camera rig uses: wider on portrait screens. */
export const fovFor = (aspect: number) => (aspect < 1 ? 50 : 34);
/** How far the kit's rig pulls back on portrait screens (see fitView in scene-kit/motion.ts). */
export const pullBackFor = (aspect: number) => (aspect < 0.6 ? 1.5 : aspect < 1 ? 1.25 : 1);

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The camera preset that fits `focus` into `frame` on a canvas of `width` x `height` pixels.
 * The returned preset is what to pass to <InkStage view>: the rig's own pull-back is already undone.
 * By default the box is sized at its centre. With `nearFit`, its near edge fits instead: use it when
 * the camera comes close to a deep box (a small window), where the front objects look much bigger.
 */
export function frameCamera(
  focus: Focus,
  frame: Frame,
  width: number,
  height: number,
  margin = 0.86,
  { nearFit = false }: { nearFit?: boolean } = {},
): CameraView {
  const aspect = width / Math.max(1, height);
  const el = rad(focus.elevation ?? 32);
  const az = rad(focus.azimuth ?? 0);
  const fw = Math.max(80, frame.right - frame.left) * margin;
  const fh = Math.max(80, frame.bottom - frame.top) * margin;
  // Seen from the camera: the width runs across, the depth and the height stack up.
  const across = focus.width * Math.cos(az) + focus.depth * Math.abs(Math.sin(az));
  const up = focus.depth * Math.sin(el) + focus.height * Math.cos(el);
  const tan = Math.tan(rad(fovFor(aspect)) / 2);
  // Pixels per world unit at distance d is height / (2 d tan): solve for the d that fits both ways.
  const fit = Math.max((across * height) / fw, (up * height) / fh) / (2 * tan);
  // How much nearer than the centre the box's near edge is, along the line of sight.
  const nearer =
    ((focus.depth / 2) * Math.abs(Math.cos(az)) + (focus.width / 2) * Math.abs(Math.sin(az))) * Math.cos(el);
  const dist = nearFit ? fit + nearer : fit;
  const d = dist / pullBackFor(aspect);
  const [cx, cy, cz] = focus.center;
  return {
    target: [cx, cy, cz],
    position: [
      cx + d * Math.cos(el) * Math.sin(az),
      cy + d * Math.sin(el),
      cz + d * Math.cos(el) * Math.cos(az),
    ],
  };
}

/**
 * The view offset (three.js `camera.setViewOffset`) that moves the canvas centre to the centre of
 * `frame`: render the full picture shifted by (x, y).
 */
export function viewOffset(frame: Frame, width: number, height: number): { x: number; y: number } {
  const cx = (frame.left + frame.right) / 2;
  const cy = (frame.top + frame.bottom) / 2;
  return { x: Math.round(width / 2 - cx), y: Math.round(height / 2 - cy) };
}
