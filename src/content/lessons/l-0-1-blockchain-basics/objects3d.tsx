/**
 * 3D objects of lesson 0.1, built from the scene kit's ink pieces: people with coin stacks, notebooks,
 * ledger blocks with a lid, and the hash links between blocks. Loaded only with the 3D view.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Html, RoundedBox } from "@react-three/drei";
import { DoubleSide, type Group } from "three";
import {
  Coin,
  COLORS,
  INK,
  Label,
  Outline,
  Pickable,
  SoftShadow,
  useInk,
  type Vec3,
} from "../../../scene-kit";

// ---------- layout (world units) ----------
export const PEOPLE_X = { Ana: -3.6, Ben: 0, Cy: 3.6 } as const;
export const PEOPLE_Z = -2.6;
export const PERSON = 1.3;
export const NOTEBOOK_Z = PEOPLE_Z + 1.75;
export const CHAIN_Z = 1.4;
export const PITCH = 3;
export const BW = 1.5;
export const BH = 0.95;
export const BD = 1.1;
const LID = 0.2;
export const chainX = (i: number, pitch = PITCH) => (i - 1.5) * pitch;

const PAPER = COLORS.paper;
const RED_PAPER = "#f7d3cd";
const COIN_H = 0.15;
const MAX_COINS = 14;

const noRaycast = () => undefined;

export type TagPlace = "below" | "left" | "right" | "center";

/** An HTML tag that follows a point. `place` says which side of the point it hangs on. */
export function Tag({
  position,
  place = "below",
  className = "",
  children,
}: {
  position: Vec3;
  place?: TagPlace;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Html position={[...position]} zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
      <div className={`bb3-tag ${place} ${className}`}>{children}</div>
    </Html>
  );
}

/** easeOutBounce, for blocks landing on the chain. */
function bounce(u: number) {
  const n = 7.5625;
  const d = 2.75;
  if (u < 1 / d) return n * u * u;
  if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75;
  if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375;
  return n * (u -= 2.625 / d) * u + 0.984375;
}

/** A ring on the ground under a selected or edited object. */
function Ring({ radius, color = COLORS.orange }: { radius: number; color?: string }) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <mesh raycast={noRaycast}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh raycast={noRaycast}>
        <ringGeometry args={[radius, radius + 0.08, 48]} />
        <meshBasicMaterial color={INK} side={DoubleSide} />
      </mesh>
    </group>
  );
}

/** A gentle up-and-down bob for the object the learner should click next. */
function useBob(on: boolean, reducedMotion: boolean) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = on && !reducedMotion ? 0.12 + Math.sin(clock.elapsedTime * 4) * 0.1 : 0;
  });
  return ref;
}

// ---------- people ----------

/** A person's account: an orange block with their coins stacked on top. */
export function Person({
  name,
  position,
  coins,
  size = PERSON,
  balance,
  label = true,
}: {
  name: string;
  position: Vec3;
  coins: number;
  size?: number;
  /** Shows the balance tag in front of the block. */
  balance?: ReactNode;
  label?: boolean;
}) {
  const ink = useInk(COLORS.orange, true);
  const shown = Math.min(MAX_COINS, Math.max(0, coins));
  return (
    <group position={position}>
      <SoftShadow position={[0, 0, 0.25]} size={[size * 1.9, size * 1.3]} />
      <RoundedBox
        args={[size, size, size]}
        radius={0.08}
        smoothness={1}
        position={[0, size / 2, 0]}
        material={ink}
      >
        <Outline mode="hull" thickness={0.03} />
        <Outline threshold={20} />
      </RoundedBox>
      {Array.from({ length: shown }, (_, k) => (
        <Coin key={k} position={[0, size + 0.07 + k * COIN_H, 0]} />
      ))}
      {label ? <Label position={[0, size + 0.75 + shown * COIN_H, 0]}>{name}</Label> : null}
      {balance ? (
        <Tag position={[0, 0.02, size / 2 + 0.05]} className="person">
          {balance}
        </Tag>
      ) : null}
    </group>
  );
}

/** Where a coin sits on top of a person's stack. */
export const coinTop = (x: number, z: number, size: number, coins: number): Vec3 => [
  x,
  size + 0.07 + Math.min(MAX_COINS, Math.max(0, coins)) * COIN_H,
  z,
];

/** Height of a person with a full coin stack and their name, for framing. */
export const personHeight = (size: number) => size + 0.6 + MAX_COINS * COIN_H * 0.6;

// ---------- notebooks ----------

/** A notebook lying in front of its owner. Its cover flips open when it is opened. */
export function Notebook({
  label,
  position,
  open,
  hint,
  reducedMotion,
  onOpen,
  children,
}: {
  label: string;
  position: Vec3;
  open: boolean;
  hint: boolean;
  reducedMotion: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  const pages = useInk(PAPER);
  const cover = useInk(COLORS.orange);
  const spine = useInk(INK);
  const hinge = useRef<Group>(null);
  const bob = useBob(hint, reducedMotion);
  const W = 1.25;
  const D = 1.0;
  useFrame(() => {
    const h = hinge.current;
    if (!h) return;
    const goal = open ? Math.PI * 0.94 : 0;
    h.rotation.z = reducedMotion ? goal : h.rotation.z + (goal - h.rotation.z) * 0.14;
  });
  return (
    <group position={position}>
      <SoftShadow position={[0, 0, 0.15]} size={[2.2, 1.6]} />
      {open ? <Ring radius={0.95} /> : null}
      <Pickable label={label} selected={open} onPick={onOpen} anchor={[0, 0.3, 0]}>
        <group ref={bob}>
          <mesh position={[0, 0.09, 0]} material={pages}>
            <boxGeometry args={[W, 0.18, D]} />
            <Outline />
          </mesh>
          {/* Ruled lines on the first page, seen when the cover is open. */}
          {[-0.25, 0, 0.25].map((z) => (
            <mesh key={z} position={[0.05, 0.185, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
              <planeGeometry args={[W * 0.75, 0.035]} />
              <meshBasicMaterial color={COLORS.blue} transparent opacity={0.5} />
            </mesh>
          ))}
          <mesh position={[-W / 2 - 0.03, 0.1, 0]} material={spine}>
            <boxGeometry args={[0.08, 0.22, D + 0.04]} />
          </mesh>
          <group ref={hinge} position={[-W / 2, 0.2, 0]}>
            <mesh position={[W / 2, 0.02, 0]} material={cover}>
              <boxGeometry args={[W + 0.04, 0.04, D + 0.04]} />
              <Outline />
            </mesh>
          </group>
        </group>
      </Pickable>
      <Tag position={[0, 0.02, D / 2 + 0.1]} className="notebook">
        {children}
      </Tag>
    </group>
  );
}

// ---------- ledger blocks ----------

/**
 * A block of the ledger: a paper box with an orange lid. `open` lifts the lid, `bad` turns it red (its
 * stored link is broken), `drop` makes it fall onto the chain when it first appears.
 */
export function LedgerBlock({
  position,
  scale = 1,
  open = false,
  bad = false,
  ring = false,
  hint = false,
  drop = false,
  reducedMotion,
  pick,
  children,
}: {
  position: Vec3;
  scale?: number;
  open?: boolean;
  bad?: boolean;
  ring?: boolean;
  hint?: boolean;
  drop?: boolean;
  reducedMotion: boolean;
  pick?: { label: string; onPick: () => void; selected: boolean };
  /** Tags that hang off the block (its card). */
  children?: ReactNode;
}) {
  const body = useInk(bad ? RED_PAPER : PAPER, true);
  const lidInk = useInk(bad ? COLORS.red : COLORS.orange);
  const lid = useRef<Group>(null);
  const fall = useRef<Group>(null);
  const bob = useBob(hint, reducedMotion);
  // Remember whether to drop at mount only: later renders never restart the fall.
  const [falling] = useState(() => drop && !reducedMotion);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const l = lid.current;
    if (l) {
      // The lid swings open on its back edge.
      const r = open ? -1.9 : 0;
      l.rotation.x += (r - l.rotation.x) * (reducedMotion ? 1 : 0.15);
    }
    const f = fall.current;
    if (f && falling) {
      if (t0.current === null) t0.current = clock.elapsedTime;
      const u = Math.min(1, (clock.elapsedTime - t0.current) / 0.8);
      f.position.y = 5 * (1 - bounce(u));
    }
  });
  const edge = bad ? COLORS.red : INK;
  const box = (
    <group ref={bob}>
      <RoundedBox
        args={[BW, BH - LID, BD]}
        radius={0.06}
        smoothness={1}
        position={[0, (BH - LID) / 2, 0]}
        material={body}
      >
        <Outline mode="hull" thickness={0.025} />
        <Edges threshold={20} lineWidth={1.6} color={edge} />
      </RoundedBox>
      <group ref={lid} position={[0, BH - LID / 2, -BD / 2]}>
        <mesh position={[0, 0, BD / 2]} material={lidInk}>
          <boxGeometry args={[BW + 0.06, LID, BD + 0.06]} />
          <Edges threshold={20} lineWidth={1.6} color={INK} />
        </mesh>
      </group>
    </group>
  );
  return (
    <group position={position} scale={scale}>
      <group ref={fall} position={[0, falling ? 5 : 0, 0]}>
        <SoftShadow position={[0, 0, 0.2]} size={[BW * 1.9, BD * 1.6]} />
        {ring || pick?.selected ? <Ring radius={1.05} /> : null}
        {pick ? (
          <Pickable label={pick.label} selected={pick.selected} onPick={pick.onPick} anchor={[0, BH / 2, 0]}>
            {box}
          </Pickable>
        ) : (
          box
        )}
        {children}
      </group>
    </group>
  );
}

/** Where a block's card hangs: under the front of the block. */
export const CARD_AT: Vec3 = [0, 0.02, BD / 2 + 0.05];

// ---------- hash links ----------

/**
 * The link from a block back to the block before it: an ink rod with an arrowhead pointing at the
 * previous block. When the stored hash is wrong it turns red and cracks in two.
 */
export function HashLink({
  from,
  to,
  ok,
  faint = false,
  scale = 1,
  reducedMotion,
  children,
}: {
  /** Centre of the previous block (the arrow points here). */
  from: Vec3;
  /** Centre of this block. */
  to: Vec3;
  ok: boolean;
  faint?: boolean;
  scale?: number;
  reducedMotion: boolean;
  children?: ReactNode;
}) {
  const ink = useInk(ok ? (faint ? "#8d8778" : INK) : COLORS.red);
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  // The rod runs between the two blocks' faces, a little off each one.
  const halfBlock = (Math.abs(dx) >= Math.abs(dz) ? BW / 2 : BD / 2) * scale + 0.05;
  const len = Math.hypot(dx, dz) - 2 * halfBlock;
  const mid: Vec3 = [(from[0] + to[0]) / 2, (BH / 2) * scale, (from[2] + to[2]) / 2];
  // Local +x runs from the previous block to this one.
  const yaw = Math.atan2(-dz, dx);
  const a = useRef<Group>(null);
  const b = useRef<Group>(null);
  const crackT = useRef<number | null>(null);
  const wasOk = useRef(ok);
  useLayoutEffect(() => {
    if (wasOk.current && !ok) crackT.current = -1;
    wasOk.current = ok;
  }, [ok]);
  useFrame(({ clock }) => {
    if (!a.current || !b.current) return;
    let shake = 0;
    if (crackT.current !== null && !reducedMotion) {
      if (crackT.current < 0) crackT.current = clock.elapsedTime;
      const u = (clock.elapsedTime - crackT.current) / 0.6;
      if (u >= 1) crackT.current = null;
      else shake = Math.sin(u * 40) * 0.12 * (1 - u);
    }
    const tilt = ok ? 0 : 0.22;
    a.current.rotation.z = -tilt + shake;
    b.current.rotation.z = tilt - shake;
  });
  const half = ok ? len / 2 : len / 2 - 0.14;
  const rod = 0.09 * Math.max(0.8, scale);
  return (
    <group position={mid} rotation={[0, yaw, 0]}>
      {/* Left half, with the arrowhead at the previous block. Hinged at its outer end. */}
      <group ref={a} position={[-len / 2, 0, 0]}>
        <mesh position={[half / 2, 0, 0]} material={ink} raycast={noRaycast}>
          <boxGeometry args={[half, rod, rod]} />
        </mesh>
        <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={ink} raycast={noRaycast}>
          <coneGeometry args={[0.16 * Math.max(0.8, scale), 0.3, 16]} />
        </mesh>
      </group>
      <group ref={b} position={[len / 2, 0, 0]}>
        <mesh position={[-half / 2, 0, 0]} material={ink} raycast={noRaycast}>
          <boxGeometry args={[half, rod, rod]} />
        </mesh>
      </group>
      {ok ? null : <Crack />}
      {children}
    </group>
  );
}

/** A jagged red crack where a link broke. */
function Crack() {
  const red = useInk(COLORS.red);
  const pts: [number, number][] = [
    [-0.05, 0.42],
    [0.08, 0.16],
    [-0.08, -0.04],
    [0.07, -0.26],
    [-0.04, -0.44],
  ];
  return (
    <group>
      {pts.slice(1).map(([x, y], i) => {
        const [px, py] = pts[i]!;
        const dx = x - px;
        const dy = y - py;
        return (
          <mesh
            key={i}
            position={[(x + px) / 2, (y + py) / 2, 0]}
            rotation={[0, 0, Math.atan2(dy, dx)]}
            material={red}
            raycast={noRaycast}
          >
            <boxGeometry args={[Math.hypot(dx, dy) + 0.03, 0.05, 0.05]} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------- the travelling coin ----------

/** A coin that spins while it travels. */
export function SpinningCoin() {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.x += dt * 6;
  });
  return (
    <group ref={ref}>
      <Coin />
    </group>
  );
}
