import { useLayoutEffect, useRef, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView, orbitLimits, toFlat, type CameraView } from "./motion";

/**
 * Moves the camera to the current preset `view` (smoothly, or at once under reduced motion).
 * In flat mode it looks straight down at the same target. The learner can orbit and zoom (no pan);
 * once they do, the rig lets go until the view changes, so the two never fight. The learner's orbit is
 * kept near the step's view (orbitLimits): 45° either way and a little further out, never all the way
 * round. The limits hold once the camera has arrived (or the learner takes it), not while it glides.
 * Reports "moving" or "still" through `onMotion`, for tests and for anything that waits for the camera.
 */
export function CameraRig({
  view,
  flat,
  reducedMotion,
  minDistance = 6,
  maxDistance = 40,
  onMotion,
}: {
  view: CameraView;
  flat: boolean;
  reducedMotion: boolean;
  minDistance?: number;
  maxDistance?: number;
  onMotion?: (state: "moving" | "still") => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const goalPos = useRef(new Vector3());
  const goalTarget = useRef(new Vector3());
  const userMoved = useRef(false);
  const first = useRef(true);
  const last = useRef(new Vector3());
  const stillFrames = useRef(0);
  const motion = useRef<"moving" | "still" | null>(null);

  const aspect = size.width / Math.max(1, size.height);
  const narrow = aspect < 1;
  const v = fitView(flat ? toFlat(view) : view, aspect);
  const key = JSON.stringify(v);
  const limits = orbitLimits(v, minDistance, maxDistance);

  useLayoutEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      camera.fov = narrow ? 50 : 34;
      camera.updateProjectionMatrix();
    }
  }, [camera, narrow]);

  useLayoutEffect(() => {
    const goal: CameraView = JSON.parse(key);
    goalPos.current.set(...goal.position);
    goalTarget.current.set(...goal.target);
    userMoved.current = false;
    if (first.current || reducedMotion) {
      first.current = false;
      camera.position.copy(goalPos.current);
      controls.current?.target.copy(goalTarget.current);
      controls.current?.update();
    }
  }, [key, reducedMotion, camera]);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    let settled = userMoved.current;
    if (!userMoved.current) {
      const close = camera.position.distanceToSquared(goalPos.current) < 1e-4;
      const k = reducedMotion || close ? 1 : 0.06;
      camera.position.lerp(goalPos.current, k);
      c.target.lerp(goalTarget.current, k);
      settled = k === 1;
    }
    c.minAzimuthAngle = settled ? limits.minAzimuth : -Infinity;
    c.maxAzimuthAngle = settled ? limits.maxAzimuth : Infinity;
    c.maxDistance = settled ? limits.maxDistance : Infinity;
    c.update();
    // "still" after a few frames without movement.
    const moved = last.current.distanceToSquared(camera.position) > 1e-8;
    last.current.copy(camera.position);
    stillFrames.current = moved ? 0 : stillFrames.current + 1;
    const now = stillFrames.current > 5 ? "still" : "moving";
    if (now !== motion.current) {
      motion.current = now;
      onMotion?.(now);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableRotate={!flat}
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      minDistance={minDistance}
      minPolarAngle={flat ? 0 : 0.2}
      maxPolarAngle={flat ? 0.05 : 1.38}
      onStart={() => {
        userMoved.current = true;
      }}
    />
  );
}
