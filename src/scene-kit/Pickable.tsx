import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Box3, DoubleSide, Matrix4, type Group, type Object3D } from "three";
import { useOverlayItem } from "./overlay";
import { isClick, type Vec3 } from "./motion";
import { INK } from "./theme";
import { useStage } from "./context";
import { useAnimatedFrame } from "./frames";
import {
  approach,
  DETAIL_SECONDS,
  HINT_SECONDS,
  hopPose,
  HOVER_SECONDS,
  NOPE_SECONDS,
  pickNote,
  PRESS_SECONDS,
  reactionPose,
  REST_POSE,
  type HopPose,
  type PickNote,
  type ReactionPose,
} from "./reaction";
import { trackPress } from "./pressTracker";

const noRaycast = () => undefined;

/**
 * An object's own pick animation (rule 10a): called every frame after a pick with the seconds since it,
 * on the group that holds the object (already posed for hover and press). Move, turn or scale it and
 * return `true` while it still plays; once it returns false the group goes back to its pose. Not called
 * under reduced motion. Leave it out for the kit's default hop.
 */
export type PickMotion = (object: Object3D, t: number) => boolean;

export interface PickProps {
  /** Makes the object clickable. Also adds a focusable button named `pickLabel` for keyboards and tests. */
  onPick?: () => void;
  /** Accessible name of the pick button. Defaults to the object's name. */
  pickLabel?: string;
  /** Draws the selection ring under the object. */
  selected?: boolean;
  /**
   * "Not yet": the object can't be used at this step. A pick shakes it and shows this one-line hint
   * instead of calling `onPick` (it also makes an object without `onPick` pickable).
   */
  disabledHint?: string;
  /** Called on a "not yet" pick (after `disabledHint` shows), so a lesson can record it like any pick. */
  onNotYet?: () => void;
  /** Shown after a pick, for exploring once the step is done (a value, a short fact). */
  detail?: string;
  /** The object's own pick animation; the kit's hop when left out. */
  pickMotion?: PickMotion;
}

/** Whether an object with these props reacts to clicks. */
export const isPickable = (p: PickProps) => !!(p.onPick || p.disabledHint || p.detail);

/**
 * Wraps a pickable object. A click is a press whose pointer never went `CLICK_PX` (6 px) from where it
 * began; anything further, even if it comes back, is a camera drag (CameraRig counts the same way) and
 * picks nothing. `anchor` is where the pick button sits, local to the object.
 *
 * The object reacts (docs/book-scene.md rule 10a): hover or keyboard focus lifts it and rings it in the
 * stage accent, a press squashes it, a pick plays `pickMotion` (or a hop), a "not yet" pick shakes it and
 * shows `disabledHint`, and `detail` shows after a pick. Every move runs through `useAnimatedFrame` and
 * settles; under reduced motion only the ring shows. The pick button exposes `data-hover="on|off"`,
 * `data-pick="playing|idle"`, `data-hint` and `data-detail` for tests.
 */
export function Pickable({
  label,
  selected = false,
  onPick,
  anchor = [0, 1, 0],
  disabledHint,
  onNotYet,
  detail,
  pickMotion,
  children,
}: Omit<PickProps, "pickLabel"> & { label: string; anchor?: Vec3; children: ReactNode }) {
  const { reducedMotion, accent } = useStage();
  const ref = useRef<Object3D>(null);
  const inner = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const [pointerOver, setPointerOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState<PickNote | null>(null);
  const hover = pointerOver || focused;
  /** Progress of each reaction, advanced in the frame loop, and the poses it writes into. */
  const sim = useRef({
    hover: 0,
    press: 0,
    nope: -1,
    pick: -1,
    reducedMotion: false,
    pose: { ...REST_POSE } as ReactionPose,
    hop: { lift: 0, turn: 0, playing: false } as HopPose,
  });
  /** The furthest the pointer went from where this press began (px): the camera rig counts the same. */
  const travel = useRef(0);

  const pick = () => {
    // A new object (or a fresh note) each pick, so the bubble's timer restarts.
    const shown = pickNote({ disabledHint, detail });
    setNote(shown ? { ...shown } : null);
    if (disabledHint) {
      if (!reducedMotion) sim.current.nope = 0;
      onNotYet?.();
      return;
    }
    onPick?.();
    if (!reducedMotion) {
      sim.current.pick = 0;
      setPlaying(true);
    }
    // A render follows, and useAnimatedFrame asks for a frame after it.
  };
  useEffect(() => {
    if (!note) return;
    const ms = (note.kind === "hint" ? HINT_SECONDS : DETAIL_SECONDS) * 1000;
    const id = setTimeout(() => setNote(null), ms);
    return () => clearTimeout(id);
  }, [note]);

  useOverlayItem(
    { kind: "pick", label, pressed: selected, onPick: pick, onHover: setFocused, hover, playing, note },
    ref,
  );
  useLayoutEffect(() => {
    if (!pointerOver) return;
    document.body.style.cursor = disabledHint ? "not-allowed" : "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [pointerOver, disabledHint]);

  // The accent ring under the object, measured again at each hover start: objects grow and change
  // between steps (a ledger gains lines, a gauge fills).
  const [ringAt, setRingAt] = useState<RingAt | null>(null);
  useLayoutEffect(() => {
    if (!hover || !inner.current) return;
    const next = ringFor(inner.current);
    setRingAt((prev) => (prev && sameRing(prev, next) ? prev : next));
  }, [hover]);

  // A press in progress follows the pointer on the window; drop those listeners if we unmount mid-press.
  const stopPress = useRef<(() => void) | null>(null);
  useEffect(() => () => stopPress.current?.(), []);

  useAnimatedFrame((_, dt) => {
    const s = sim.current;
    const g = inner.current;
    if (!g) return false;
    const hoverTo = hover ? 1 : 0;
    const pressTo = pressing && !disabledHint ? 1 : 0;
    s.reducedMotion = reducedMotion;
    s.hover = reducedMotion ? hoverTo : approach(s.hover, hoverTo, dt, HOVER_SECONDS);
    s.press = reducedMotion ? pressTo : approach(s.press, pressTo, dt, PRESS_SECONDS);
    if (s.nope >= 0) s.nope = s.nope + dt >= NOPE_SECONDS ? -1 : s.nope + dt;
    // Reused objects: nothing is allocated per frame.
    const p = reactionPose(s, s.pose);
    restPose(g, p);
    let moving = s.hover !== hoverTo || s.press !== pressTo || s.nope >= 0;
    if (s.pick >= 0) {
      s.pick += dt;
      let still: boolean;
      if (pickMotion) still = pickMotion(g, s.pick);
      else {
        const h = hopPose(s.pick, s.hop);
        g.position.y += h.lift;
        g.rotation.y += h.turn;
        still = h.playing;
      }
      if (still) moving = true;
      else {
        s.pick = -1;
        restPose(g, p);
        setPlaying(false);
      }
    }
    if (ring.current) {
      // The ring comes with the hover (at once under reduced motion: s.hover jumps).
      ring.current.visible = s.hover > 0.01;
      ring.current.scale.setScalar(0.85 + 0.15 * s.hover);
    }
    return moving;
  });

  return (
    <group
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        // Follow the whole press, not just where it ends: out 7 px and back is a drag (the camera rig
        // takes it as a camera move), never also a pick.
        travel.current = 0;
        setPressing(true);
        stopPress.current?.();
        stopPress.current = trackPress(window, e.nativeEvent, {
          move: (px) => {
            travel.current = px;
            if (!isClick(px)) setPressing(false);
          },
          end: () => {
            stopPress.current = null;
            setPressing(false);
          },
        });
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!isClick(Math.max(e.delta, travel.current))) return;
        e.stopPropagation();
        pick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setPointerOver(true);
      }}
      onPointerOut={() => setPointerOver(false)}
    >
      <group ref={inner}>{children}</group>
      {ringAt ? (
        <group ref={ring} position={[ringAt.x, ringAt.y, ringAt.z]} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <ringGeometry args={[ringAt.r, ringAt.r + 0.12, 48]} />
            <meshBasicMaterial color={accent} side={DoubleSide} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} raycast={noRaycast}>
            <ringGeometry args={[ringAt.r + 0.12, ringAt.r + 0.16, 48]} />
            <meshBasicMaterial color={INK} side={DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ) : null}
      <object3D ref={ref} position={anchor} />
    </group>
  );
}

/** Writes the hover / press / shake pose onto the object group. */
function restPose(g: Object3D, p: ReactionPose) {
  g.position.set(p.shake, p.lift, 0);
  g.rotation.set(0, 0, 0);
  g.scale.set(p.sx, p.sy, p.sz);
}

type RingAt = { r: number; x: number; y: number; z: number };
const sameRing = (a: RingAt, b: RingAt) =>
  Math.abs(a.r - b.r) < 0.01 &&
  Math.abs(a.x - b.x) < 0.01 &&
  Math.abs(a.y - b.y) < 0.01 &&
  Math.abs(a.z - b.z) < 0.01;
const bounds = new Box3();
const inverse = new Matrix4();

/**
 * A ring around the object's footprint, in the object group's own space (its rest pose, so a lift, squash
 * or hop in progress does not skew it; a unit ring if the bounds make no sense).
 */
function ringFor(object: Object3D): RingAt {
  object.updateWorldMatrix(true, true);
  bounds.setFromObject(object);
  bounds.applyMatrix4(inverse.copy(object.matrixWorld).invert());
  const r = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2 + 0.12;
  if (bounds.isEmpty() || !Number.isFinite(r)) return { r: 1, x: 0, y: 0.03, z: 0 };
  return {
    r: Math.min(r, 6),
    x: (bounds.min.x + bounds.max.x) / 2,
    y: Math.max(0, bounds.min.y) + 0.03,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
}
