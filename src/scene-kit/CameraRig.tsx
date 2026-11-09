import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PerspectiveCamera, Vector3 } from "three";
import {
  clampLength,
  DAMPING,
  dampingFor,
  distance,
  EASE_SECONDS,
  fitView,
  isCameraGesture,
  MAX_FRAME_STEP,
  PAN_SHARE,
  smoothDamp,
  toFlat,
  type CameraView,
} from "./motion";
import { forgetView, recallView, rememberView } from "./viewMemory";

/**
 * Without `keep`: a new view that moves the camera less than this share of its distance (the panel grew
 * a line, the fonts loaded) does not take back the learner's own orbit, zoom or pan.
 */
const NUDGE_SHARE = 0.04;

type V3 = [number, number, number];
const goalOf = (key: string) => JSON.parse(key) as CameraView;
/** Whether the new view moves the camera or its target by more than a nudge. */
const far = (a: CameraView, b: CameraView, d: number) =>
  distance(a.position, b.position) > d * NUDGE_SHARE || distance(a.target, b.target) > d * NUDGE_SHARE;
const v3 = (v: Vector3): V3 => [v.x, v.y, v.z];

/**
 * Moves the camera to the current preset `view`, gliding on a critically damped spring (`smoothDamp`,
 * frame-rate independent; at once under reduced motion). In flat mode it looks straight down at the same
 * target. The learner can orbit, zoom and pan a little (right drag, shift / ctrl / cmd + drag, two-finger
 * drag): the pan is held within `PAN_SHARE` of the camera's distance from where they took over (less when
 * zoomed in), so the figure cannot leave the view.
 *
 * A press becomes the learner's own view only as a camera gesture (`isCameraGesture`: the pointer moved
 * at least `CLICK_PX`, the pick threshold, or they zoomed or used two fingers), so a tap on an object picks
 * it and leaves the camera alone. Until then a running glide carries on; from then on the rig lets go:
 * - with `keep` (the book scene) their view stays through every later step until `reset` changes
 *   (the Reset view button, the Flat view pill, the tour);
 * - without it, until the view changes by more than a nudge; then it glides back.
 * With `memory` (a lesson id, captured at mount) their view is kept while the 3D view is closed and given
 * back when it opens again in that lesson (`viewMemory`).
 *
 * Reports "moving" or "still" through `onMotion` (the camera and the picture's view offset), whether the
 * learner's own view is on through `onUserView`, and the rounded camera position and target
 * ("x,y,z@x,y,z") through `onPose` (tests).
 */
export function CameraRig({
  view,
  flat,
  reducedMotion,
  minDistance = 6,
  maxDistance = 40,
  keep = false,
  memory,
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
  /** Key of the learner's kept view (the lesson id). Read once, when the rig mounts. */
  memory?: string;
  /** Change it to drop the learner's own view and glide back to `view`. */
  reset?: string | number;
  onMotion?: (state: "moving" | "still") => void;
  onUserView?: (on: boolean) => void;
  onPose?: (pose: string) => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  // OrbitControls listens on R3F's event target (or the canvas): watch the same element for gestures.
  const surface = useThree((s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [memoryKey] = useState(memory);
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

  /** The press in progress: the controls are held; how far the pointer went; a zoom or second finger. */
  const press = useRef({ held: false, travel: 0, zoomOrMulti: false });
  /** The target when the press began: the pan is held around it (the drag may pan before it counts). */
  const pressHome = useRef(new Vector3());
  const downs = useRef(new Map<number, { x: number; y: number }>());
  /** The press became a camera gesture: the view is now the learner's, the glide hands over to them. */
  const takeOver = () => {
    const p = press.current;
    const c = controls.current;
    if (!p.held || !c || userMoved.current || !isCameraGesture(p.travel, p.zoomOrMulti)) return;
    velPos.current = [0, 0, 0];
    velTarget.current = [0, 0, 0];
    panHome.current.copy(pressHome.current);
    setUser(true);
  };

  // Capture phase, so these run before OrbitControls' own handlers on the same element.
  useEffect(() => {
    const el = surface;
    const opts = { capture: true } as const;
    const onDown = (e: PointerEvent) => {
      if (downs.current.size === 0) press.current = { ...press.current, travel: 0, zoomOrMulti: false };
      downs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (downs.current.size > 1) press.current.zoomOrMulti = true;
    };
    const onMove = (e: PointerEvent) => {
      const d = downs.current.get(e.pointerId);
      if (!d) return;
      press.current.travel = Math.max(press.current.travel, Math.hypot(e.clientX - d.x, e.clientY - d.y));
    };
    const onUp = (e: PointerEvent) => void downs.current.delete(e.pointerId);
    const onWheel = () => {
      press.current.zoomOrMulti = true;
    };
    el.addEventListener("pointerdown", onDown, opts);
    el.addEventListener("pointermove", onMove, opts);
    el.addEventListener("pointerup", onUp, opts);
    el.addEventListener("pointercancel", onUp, opts);
    el.addEventListener("wheel", onWheel, opts);
    return () => {
      el.removeEventListener("pointerdown", onDown, opts);
      el.removeEventListener("pointermove", onMove, opts);
      el.removeEventListener("pointerup", onUp, opts);
      el.removeEventListener("pointercancel", onUp, opts);
      el.removeEventListener("wheel", onWheel, opts);
    };
  }, [surface]);

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
      const saved = memoryKey ? recallView(memoryKey) : null;
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
  }, [key, reducedMotion, camera, keep, memoryKey]);

  // Reset: drop the learner's view and glide back (at once under reduced motion: the frame loop copies).
  const seenReset = useRef(reset);
  useLayoutEffect(() => {
    if (Object.is(seenReset.current, reset)) return;
    seenReset.current = reset;
    if (memoryKey) forgetView(memoryKey);
    velPos.current = [0, 0, 0];
    velTarget.current = [0, 0, 0];
    setUser(false);
  }, [reset, memoryKey]);

  // Closing the 3D view keeps the learner's own view, under the key captured at mount.
  useEffect(() => {
    if (!memoryKey) return;
    const c = controls.current;
    const home = panHome.current;
    return () => {
      if (!c) return;
      if (userMoved.current)
        rememberView(memoryKey, { position: v3(camera.position), target: v3(c.target), home: v3(home) });
      else forgetView(memoryKey);
    };
  }, [memoryKey, camera]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(delta, MAX_FRAME_STEP);
    // drei updates the controls once a frame (priority -1) and the rig once more below: per update,
    // this factor keeps the coasting after a drag the same at any frame rate (see dampingFor).
    c.dampingFactor = dampingFor(dt);
    if (!userMoved.current) {
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
      // Hold the pan within reach of where the learner started (the camera moves with the target). The
      // reach shrinks as they zoom in, so the spot they started from stays on screen.
      const reach = Math.min(
        camera.position.distanceTo(c.target),
        goalPos.current.distanceTo(goalTarget.current),
      );
      const off = c.target.clone().sub(panHome.current);
      const held = clampLength([off.x, off.y, off.z], reach * PAN_SHARE);
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
      dampingFactor={DAMPING}
      rotateSpeed={0.6}
      zoomSpeed={0.7}
      panSpeed={0.6}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={flat ? 0 : 0.2}
      maxPolarAngle={flat ? 0.05 : 1.38}
      onStart={() => {
        // A press alone changes nothing (a tap picks an object); a running glide carries on until the
        // press turns into a camera gesture (takeOver).
        const c = controls.current;
        if (!press.current.held && c) pressHome.current.copy(c.target);
        press.current.held = true;
      }}
      onEnd={() => {
        takeOver();
        press.current.held = false;
      }}
    />
  );
}
