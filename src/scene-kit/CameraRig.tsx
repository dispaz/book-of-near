import { useEffect, useLayoutEffect, useRef, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PerspectiveCamera, Vector3 } from "three";
import { clampLength, EASE_SECONDS, fitView, PAN_SHARE, smoothDamp, toFlat, type CameraView } from "./motion";

/** Longest frame time the glide advances by in one frame: a slow device still glides, a stall cannot jump. */
const MAX_STEP = 0.1;
/**
 * Without `keep`: a new view that moves the camera less than this share of its distance (the panel grew
 * a line, the fonts loaded) does not take back the learner's own orbit, zoom or pan.
 */
const NUDGE_SHARE = 0.04;

type V3 = [number, number, number];
const goalOf = (key: string) => JSON.parse(key) as CameraView;
const far = (a: CameraView, b: CameraView, d: number) =>
  Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]) >
    d * NUDGE_SHARE ||
  Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]) >
    d * NUDGE_SHARE;
const v3 = (v: Vector3): V3 => [v.x, v.y, v.z];

/**
 * The learner's own view, kept in memory (not stored) while the 3D view is closed, so switching to 2D
 * and back within a lesson keeps it. Keyed by the page's path: another lesson starts on its framing.
 */
let savedView: { path: string; position: V3; target: V3; home: V3 } | null = null;
const here = () => (typeof location === "undefined" ? "" : location.pathname);

/**
 * Moves the camera to the current preset `view`, gliding on a critically damped spring (`smoothDamp`,
 * frame-rate independent; at once under reduced motion). In flat mode it looks straight down at the same
 * target. The learner can orbit, zoom and pan a little (right drag, shift / ctrl / cmd + drag, two-finger
 * drag): the pan is held within `PAN_SHARE` of the camera's distance from where they took over, so the
 * figure cannot leave the view. Once the learner moves the camera the rig lets go, so the two never fight:
 * - with `keep` (the book scene) their view stays through every later step until `reset` changes
 *   (the Reset view button, the Flat view pill, the tour); it also survives a 2D / 3D switch;
 * - without it, until the view changes by more than a nudge; then it glides back.
 * Reports "moving" or "still" through `onMotion` (the camera and the picture's view offset), whether the
 * learner's own view is on through `onUserView`, and the rounded camera position and target ("x,y,z@x,y,z") through `onPose` (tests).
 */
export function CameraRig({
  view,
  flat,
  reducedMotion,
  minDistance = 6,
  maxDistance = 40,
  keep = false,
  reset,
  onMotion,
  onUserView,
  onPose,
}: {
  view: CameraView;
  flat: boolean;
  reducedMotion: boolean;
  minDistance?: number;
  maxDistance?: number;
  keep?: boolean;
  /** Change it to drop the learner's own view and glide back to `view`. */
  reset?: string | number;
  onMotion?: (state: "moving" | "still") => void;
  onUserView?: (on: boolean) => void;
  onPose?: (pose: string) => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const goalPos = useRef(new Vector3());
  const goalTarget = useRef(new Vector3());
  const goal = useRef<CameraView | null>(null);
  const velPos = useRef<V3>([0, 0, 0]);
  const velTarget = useRef<V3>([0, 0, 0]);
  const userMoved = useRef(false);
  /** Where the target was when the learner took over: the pan is held around it. */
  const panHome = useRef(new Vector3());
  const first = useRef(true);
  const last = useRef(new Vector3());
  const lastOffset = useRef({ x: 0, y: 0 });
  const stillFrames = useRef(0);
  const motion = useRef<"moving" | "still" | null>(null);
  const pose = useRef("");
  const report = useRef(onUserView);
  useLayoutEffect(() => {
    report.current = onUserView;
  });
  const setUser = (on: boolean) => {
    if (userMoved.current === on) return;
    userMoved.current = on;
    report.current?.(on);
  };
  /** The camera as it was when the learner pressed the controls, while they hold them. */
  const touch = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  /** While pressed: once the camera has moved, the view is the learner's (pan held around the start). */
  const takeOver = () => {
    const t = touch.current;
    const c = controls.current;
    if (!t || !c || userMoved.current) return;
    if (camera.position.distanceToSquared(t.position) < 1e-6 && c.target.distanceToSquared(t.target) < 1e-6)
      return;
    panHome.current.copy(t.target);
    setUser(true);
  };

  const aspect = size.width / Math.max(1, size.height);
  const narrow = aspect < 1;
  const v = fitView(flat ? toFlat(view) : view, aspect);
  const key = JSON.stringify(v);

  useLayoutEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      camera.fov = narrow ? 50 : 34;
      camera.updateProjectionMatrix();
    }
  }, [camera, narrow]);

  useLayoutEffect(() => {
    const next = goalOf(key);
    const prev = goal.current;
    goal.current = next;
    goalPos.current.set(...next.position);
    goalTarget.current.set(...next.target);
    if (first.current) {
      first.current = false;
      const saved = keep && savedView?.path === here() ? savedView : null;
      camera.position.set(...(saved?.position ?? next.position));
      controls.current?.target.set(...(saved?.target ?? next.target));
      controls.current?.update();
      if (saved) {
        panHome.current.set(...saved.home);
        setUser(true);
      }
      return;
    }
    // With `keep` the learner's view outlives every new view; without it, only a nudge.
    if (userMoved.current && (keep || !far(prev!, next, goalPos.current.distanceTo(goalTarget.current))))
      return;
    setUser(false);
    if (reducedMotion) {
      velPos.current = [0, 0, 0];
      velTarget.current = [0, 0, 0];
      camera.position.copy(goalPos.current);
      controls.current?.target.copy(goalTarget.current);
      controls.current?.update();
    }
  }, [key, reducedMotion, camera, keep]);

  // Reset: drop the learner's view and glide back (at once under reduced motion: the frame loop copies).
  const seenReset = useRef(reset);
  useLayoutEffect(() => {
    if (Object.is(seenReset.current, reset)) return;
    seenReset.current = reset;
    if (keep) savedView = null;
    velPos.current = [0, 0, 0];
    velTarget.current = [0, 0, 0];
    setUser(false);
  }, [reset, keep]);

  // Closing the 3D view keeps the learner's own view for when it opens again.
  useEffect(() => {
    if (!keep) return;
    const c = controls.current;
    const home = panHome.current;
    return () => {
      if (!userMoved.current || !c) return;
      savedView = {
        path: here(),
        position: v3(camera.position),
        target: v3(c.target),
        home: v3(home),
      };
    };
  }, [keep, camera]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    if (!userMoved.current && !touch.current) {
      const dt = reducedMotion ? 1 : Math.min(delta, MAX_STEP);
      const glide = (from: Vector3, to: Vector3, vel: V3) => {
        if (reducedMotion) {
          from.copy(to);
          vel.fill(0);
          return;
        }
        const [x, vx] = smoothDamp(from.x, to.x, vel[0], EASE_SECONDS, dt);
        const [y, vy] = smoothDamp(from.y, to.y, vel[1], EASE_SECONDS, dt);
        const [z, vz] = smoothDamp(from.z, to.z, vel[2], EASE_SECONDS, dt);
        from.set(x, y, z);
        vel[0] = vx;
        vel[1] = vy;
        vel[2] = vz;
        // The spring's tail is endless: land within 0.01 units, nearly at rest.
        if (from.distanceToSquared(to) < 1e-4 && Math.hypot(vx, vy, vz) < 0.1) {
          from.copy(to);
          vel.fill(0);
        }
      };
      glide(camera.position, goalPos.current, velPos.current);
      glide(c.target, goalTarget.current, velTarget.current);
    }
    c.update();
    takeOver();
    if (userMoved.current) {
      // Hold the pan within reach of where the learner started (the camera moves with the target).
      const limit = goalPos.current.distanceTo(goalTarget.current) * PAN_SHARE;
      const off = c.target.clone().sub(panHome.current);
      const held = clampLength([off.x, off.y, off.z], limit);
      const fix = new Vector3(held[0] - off.x, held[1] - off.y, held[2] - off.z);
      if (fix.lengthSq() > 0) {
        c.target.add(fix);
        camera.position.add(fix);
      }
    }
    // "still" after a few frames without movement of the camera or the picture's view offset.
    const o = (camera as { view?: { offsetX: number; offsetY: number } | null }).view;
    const ox = o?.offsetX ?? 0;
    const oy = o?.offsetY ?? 0;
    const moved =
      last.current.distanceToSquared(camera.position) > 1e-8 ||
      Math.abs(ox - lastOffset.current.x) > 0.01 ||
      Math.abs(oy - lastOffset.current.y) > 0.01;
    last.current.copy(camera.position);
    lastOffset.current = { x: ox, y: oy };
    stillFrames.current = moved ? 0 : stillFrames.current + 1;
    const now = stillFrames.current > 5 ? "still" : "moving";
    if (now !== motion.current) {
      motion.current = now;
      onMotion?.(now);
    }
    if (onPose) {
      const p = camera.position;
      const t = c.target;
      const s = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}@${t.x.toFixed(2)},${t.y.toFixed(2)},${t.z.toFixed(2)}`;
      if (s !== pose.current) {
        pose.current = s;
        onPose(s);
      }
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      screenSpacePanning
      enableRotate={!flat}
      enableDamping={!reducedMotion}
      dampingFactor={0.06}
      rotateSpeed={0.6}
      zoomSpeed={0.7}
      panSpeed={0.6}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={flat ? 0 : 0.2}
      maxPolarAngle={flat ? 0.05 : 1.38}
      onStart={() => {
        const c = controls.current;
        if (!c) return;
        // A press pauses the glide. It becomes the learner's own view only if the camera then moves:
        // a plain click on an object (which also presses the controls) changes nothing.
        touch.current = { position: camera.position.clone(), target: c.target.clone() };
        velPos.current = [0, 0, 0];
        velTarget.current = [0, 0, 0];
      }}
      onEnd={() => {
        takeOver();
        touch.current = null;
      }}
    />
  );
}
