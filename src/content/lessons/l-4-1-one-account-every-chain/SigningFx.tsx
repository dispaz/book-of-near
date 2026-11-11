/**
 * Lesson 4.1, 3D: the signing animation on step 4, driven by the real wait (`cs.anim`, `cs.lit`).
 * While the request waits the signer sends a pulse round the ring and lines out to every node, the nodes
 * that have not answered yet work (a small staggered turn), and each node's share chip flies back to the
 * parcel one by one, as `lit` grows with the countdown. When the answer comes the last chips fly in up to
 * the threshold, a short flash seals them, and the r, s and v slips form (RsvSlips). Under reduced motion
 * nothing moves: the lines show while it waits, and each phase shows its end state.
 *
 * Cheap on purpose: a handful of simple meshes that share one geometry and one material, hidden when the
 * figure is idle (no draw calls then), moved in one frame callback with no React renders.
 */
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  LineBasicMaterial,
  MeshBasicMaterial,
  RingGeometry,
  type Group,
  type LineSegments,
  type Mesh,
  type Sprite,
  type SpriteMaterial,
} from "three";
import { Label, Outline, useInk, useStage } from "../../../scene-kit";
import { glowTexture } from "../../../scene-kit/materials";
import { arcPoint, easeInOut, type Vec3 } from "../../../scene-kit/motion";
import { COLORS, INK } from "../../../scene-kit/theme";
import { nodeSpots, PARCEL_WAIT, RING_CENTER, RING_RADIUS, shareSpot } from "./layout3d";
import { sharesIn, THRESHOLD, type SignAnim } from "./signing";

/** Seconds: a chip's flight, the gap between chips, the same while catching up, the pulse, the flash. */
const FLIGHT = 0.5;
const GAP = 0.22;
const CATCH_UP = 0.08;
const PULSE = 1.6;
const FLASH = 0.45;

const CHIP = new BoxGeometry(0.24, 0.08, 0.18);

export function SigningFx({
  anim,
  lit,
  color,
  parcelTop,
}: {
  anim: SignAnim;
  lit: number;
  color: string;
  /** Height of the waiting parcel's lid: the chips stack on it. */
  parcelTop: number;
}) {
  const { reducedMotion } = useStage();
  const chipInk = useInk(color);
  const spots = useMemo(() => nodeSpots(), []);
  const from = useMemo(() => spots.map((s) => [s.position[0], 0.3, s.position[2]] as Vec3), [spots]);
  const to = useMemo(() => from.map((_, i) => shareSpot(i, parcelTop)), [from, parcelTop]);
  const spokes = useMemo(() => {
    const g = new BufferGeometry();
    const pts: number[] = [];
    for (const s of spots) pts.push(RING_CENTER[0], 0.9, RING_CENTER[2], s.position[0], 0.35, s.position[2]);
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return g;
  }, [spots]);
  const spokeInk = useMemo(() => new LineBasicMaterial({ color, transparent: true, opacity: 0.6 }), [color]);
  const pulseGeo = useMemo(() => new RingGeometry(0.92, 1, 48), []);
  const pulseInk = useMemo(
    () => new MeshBasicMaterial({ color, transparent: true, side: DoubleSide, depthWrite: false }),
    [color],
  );

  const pulse = useRef<Mesh>(null);
  const lines = useRef<LineSegments>(null);
  const chips = useRef<(Mesh | null)[]>([]);
  const flash = useRef<Sprite>(null);
  // The animation's clock: when each chip left its node, when the wait began, when the seal came.
  const run = useRef({ prev: "idle" as SignAnim, launch: [] as number[], last: -1, wait0: 0, sealed: -1 });
  const now = useRef({ anim, lit });
  useLayoutEffect(() => {
    now.current = { anim, lit };
  });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { anim: a, lit: l } = now.current;
    const r = run.current;
    if (a !== r.prev) {
      if (a === "work") r.wait0 = t;
      if (a === "sealed") r.sealed = t;
      if (a === "idle" || a === "travel" || a === "done") {
        r.launch = [];
        r.last = -1;
      }
      r.prev = a;
    }
    const working = a === "work";
    // The signer's pulse, spreading round the ring.
    const p = pulse.current;
    if (p) {
      p.visible = working && !reducedMotion;
      if (p.visible) {
        const u = ((t - r.wait0) % PULSE) / PULSE;
        p.scale.setScalar(0.2 + u * (RING_RADIUS - 0.2));
        pulseInk.opacity = 0.55 * (1 - u);
      }
    }
    // Lines from the signer out to every node.
    if (lines.current) {
      lines.current.visible = working;
      spokeInk.opacity = reducedMotion ? 0.5 : 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 5));
    }
    // The share chips, one per node that has answered, flying to the parcel.
    const want = sharesIn(a, l);
    for (let i = 0; i < THRESHOLD; i++) {
      const chip = chips.current[i];
      if (!chip) continue;
      if (i < want && r.launch[i] === undefined) {
        r.launch[i] = Math.max(t, r.last + (a === "shares" ? CATCH_UP : GAP));
        r.last = r.launch[i]!;
      }
      const at = r.launch[i];
      if (i >= want || at === undefined || t < at) {
        chip.visible = false;
        continue;
      }
      const u = reducedMotion ? 1 : Math.min(1, (t - at) / FLIGHT);
      chip.position.set(...arcPoint(from[i]!, to[i]!, 0.7, easeInOut(u)));
      chip.visible = true;
    }
    // The seal: a short flash at the parcel.
    const f = flash.current;
    if (f) {
      const u = (t - r.sealed) / FLASH;
      f.visible = a === "sealed" && !reducedMotion && u < 1;
      if (f.visible) {
        f.scale.setScalar(0.5 + 2.2 * u);
        (f.material as SpriteMaterial).opacity = 0.85 * (1 - u);
      }
    }
  });

  const [cx, , cz] = RING_CENTER;
  return (
    <group>
      <mesh
        ref={pulse}
        geometry={pulseGeo}
        material={pulseInk}
        position={[cx, 0.03, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      />
      <lineSegments ref={lines} geometry={spokes} material={spokeInk} visible={false} />
      {Array.from({ length: THRESHOLD }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            chips.current[i] = m;
          }}
          geometry={CHIP}
          material={chipInk}
          visible={false}
        >
          <Outline threshold={20} />
        </mesh>
      ))}
      {/* Normal blending: an additive glow would vanish on the white page. */}
      <sprite ref={flash} position={[PARCEL_WAIT[0], parcelTop + 0.2, PARCEL_WAIT[2]]} visible={false}>
        <spriteMaterial map={glowTexture()} color={color} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

/** A node at work: a small staggered turn while the request waits and its share is not in yet. */
export function NodeWork({ i, busy, children }: { i: number; busy: boolean; children: ReactNode }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  const on = busy && !reducedMotion;
  useFrame(({ clock }) => {
    const n = g.current;
    if (!n) return;
    if (!on) {
      if (n.rotation.y !== 0) n.rotation.y = 0;
      return;
    }
    n.rotation.y = Math.sin(clock.elapsedTime * 7 + i * 0.9) * 0.25;
  });
  return <group ref={g}>{children}</group>;
}

const SLIP = new BoxGeometry(0.36, 0.4, 0.03);
const SLIP_PITCH = 0.42;

/**
 * The signature's three values as slips standing in a row on the parcel: r, s and v (its value, 0 or
 * 1). The full r and s are in the facts panel; a slip only names them, so the labels stay readable.
 */
export function RsvSlips({ parcelTop, v }: { parcelTop: number; v: number }) {
  const paper = useInk(COLORS.paper);
  const rows = ["r", "s", `v ${v}`];
  return (
    <group position={[0, parcelTop + 0.3, 0]}>
      {rows.map((text, k) => (
        <group key={k} position={[(k - 1) * SLIP_PITCH, 0, 0]} rotation={[0, 0, (k - 1) * -0.12]}>
          <mesh geometry={SLIP} material={paper}>
            <Outline threshold={20} />
          </mesh>
          <Label position={[0, 0, 0.04]} variant="small">
            {text}
          </Label>
        </group>
      ))}
      {/* A thin ink band holding the slips on the parcel. */}
      <mesh position={[0, -0.22, 0]} material={TIE}>
        <boxGeometry args={[SLIP_PITCH * 2 + 0.36, 0.03, 0.04]} />
      </mesh>
    </group>
  );
}

const TIE = new MeshBasicMaterial({ color: INK });
