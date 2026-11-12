import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useAnimatedFrame } from "./frames";
import { viewOffset, type Frame } from "./framing";
import { EASE_SECONDS, smoothDamp } from "./motion";

/**
 * Shifts the picture so the camera's target sits in the middle of `frame`, the free part of the canvas
 * (gliding on the same spring and timing as the camera rig, so the two move as one; at once under
 * reduced motion). Labels, anchors and picking follow, because they use the same projection. Pair it
 * with `frameCamera` so the step's objects fill that frame.
 */
export function ViewOffset({ frame, reducedMotion }: { frame: Frame; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const cur = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const goal = viewOffset(frame, size.width, size.height);
  useAnimatedFrame((_, delta) => {
    const c = cur.current;
    let x = goal.x;
    let y = goal.y;
    let vx = 0;
    let vy = 0;
    if (c && !reducedMotion) {
      [x, vx] = smoothDamp(c.x, goal.x, c.vx, EASE_SECONDS, delta);
      [y, vy] = smoothDamp(c.y, goal.y, c.vy, EASE_SECONDS, delta);
      // Land once within a quarter pixel and barely moving.
      if (Math.abs(goal.x - x) < 0.25 && Math.abs(vx) < 1) [x, vx] = [goal.x, 0];
      if (Math.abs(goal.y - y) < 0.25 && Math.abs(vy) < 1) [y, vy] = [goal.y, 0];
    }
    const v = (camera as { view?: { offsetX: number; offsetY: number; fullWidth: number } | null }).view;
    cur.current = { x, y, vx, vy };
    if (v && v.offsetX === x && v.offsetY === y && v.fullWidth === size.width) return false;
    if ("setViewOffset" in camera)
      camera.setViewOffset(size.width, size.height, x, y, size.width, size.height);
    // Still gliding: ask for the next frame (the canvas draws on demand).
    return x !== goal.x || y !== goal.y;
  });
  useEffect(
    () => () => {
      if ("clearViewOffset" in camera) camera.clearViewOffset();
    },
    [camera],
  );
  return null;
}
