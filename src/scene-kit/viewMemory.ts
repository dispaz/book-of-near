import type { Vec3 } from "./motion";

/** The learner's own camera: where it is, what it looks at, and where their pan is held around. */
export interface SavedView {
  position: Vec3;
  target: Vec3;
  home: Vec3;
}

/**
 * The learner's own camera per scene (a lesson id), kept in memory only: switching a lesson's view to
 * 2D and back, or leaving it and coming back in the same visit, finds the camera where they left it. A
 * reload starts on the step's framing. The key is given by the caller and captured when the scene
 * mounts, never read from the URL (the router changes it before the scene unmounts, and hash routing
 * never changes the path).
 */
const views = new Map<string, SavedView>();

export const rememberView = (key: string, view: SavedView) => void views.set(key, view);
export const recallView = (key: string): SavedView | null => views.get(key) ?? null;
export const forgetView = (key: string) => void views.delete(key);
