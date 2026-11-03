import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { viewOffset, type Frame } from "./framing";

/**
 * Shifts the picture so the camera's target sits in the middle of `frame`, the free part of the canvas
 * (eased; at once under reduced motion). Labels, anchors and picking follow, because they use the same
 * projection. Pair it with `frameCamera` so the step's objects fill that frame.
 */
export function ViewOffset({ frame, reducedMotion }: { frame: Frame; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const cur = useRef<{ x: number; y: number } | null>(null);
  const goal = viewOffset(frame, size.width, size.height);
  useFrame(() => {
    const c = cur.current ?? goal;
    const k = reducedMotion || !cur.current ? 1 : 0.1;
    const x = Math.abs(goal.x - c.x) < 0.5 ? goal.x : c.x + (goal.x - c.x) * k;
    const y = Math.abs(goal.y - c.y) < 0.5 ? goal.y : c.y + (goal.y - c.y) * k;
    const v = (camera as { view?: { offsetX: number; offsetY: number; fullWidth: number } | null }).view;
    if (cur.current && v && v.offsetX === x && v.offsetY === y && v.fullWidth === size.width) return;
    cur.current = { x, y };
    if ("setViewOffset" in camera)
      camera.setViewOffset(size.width, size.height, x, y, size.width, size.height);
  });
  useEffect(
    () => () => {
      if ("clearViewOffset" in camera) camera.clearViewOffset();
    },
    [camera],
  );
  return null;
}
