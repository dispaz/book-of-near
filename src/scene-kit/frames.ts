import { useEffect } from "react";
import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { MAX_FRAME_STEP } from "./motion";

/**
 * Render on demand (issue #44). Every 3D stage's canvas uses `frameloop="demand"`: it draws a frame only
 * when something asks for one, so an idle scene costs nothing (without a GPU, WebGL runs in software and
 * a scene redrawn 60 times a second keeps several CPU cores busy).
 *
 * What asks for a frame:
 * - a React render that changes a prop of a three object (R3F does that on its own), a resize, a pointer
 *   gesture on the orbit controls (drei invalidates on "change", also while its damping coasts);
 * - anything that MOVES in a frame callback: use `useAnimatedFrame` instead of `useFrame` for it.
 *
 * A frame callback that only follows others (labels, printed copy, the fill that tracks the pop-up)
 * stays a plain `useFrame`: it runs in every frame that something else asked for.
 */

/** A frame callback for something that moves: return `true` while it still moves. */
export type AnimatedFrame = (state: RootState, delta: number) => boolean | void;

/**
 * `useFrame` for an animation, under `frameloop="demand"`. The callback returns `true` while it still
 * moves, and the next frame is requested; once it returns `false` (or nothing) it has settled and the
 * canvas may rest. The component also asks for one frame after each of its renders, so a new prop that
 * starts a move (or a reduced-motion end state written in an effect) is drawn.
 *
 * `delta` is capped at MAX_FRAME_STEP: the first frame after a rest comes long after the last one, and a
 * move that starts then should not jump. Time measured from `clock.elapsedTime` is real time, as before.
 */
export function useAnimatedFrame(callback: AnimatedFrame, priority = 0) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  });
  useFrame((state, delta) => {
    if (callback(state, Math.min(delta, MAX_FRAME_STEP))) state.invalidate();
  }, priority);
}

/** Asks for one frame after every render of the calling component (a safety net for imperative edits). */
export function useFrameOnRender() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  });
}

/**
 * How long an attention cue (a bob or pulse on the thing to click next) moves before it rests in a pose
 * that still reads as "here". A cue that never stops would keep an idle page drawing forever.
 */
export const CUE_SECONDS = 4;
