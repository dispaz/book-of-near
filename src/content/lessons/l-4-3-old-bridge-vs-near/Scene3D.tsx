/**
 * Lesson 4.3 in 3D: a pop-up book scene (docs/book-scene.md). On the right page, two tracks. Behind,
 * path A, the old bridge: the vault (a safe full of locked coins), six step tiles and the wUSDC slip, an
 * IOU tied to the vault. In front, path B, the NEAR way: your intent (a parcel) with the confidential
 * shield beside it, two step tiles, the native USDC coin and your mailbox on the other chain. The tiles
 * light as the two timelines play; the vault cracks and drains in the simulated exploit. Only draws the
 * shared state from useBridgeCompare. Loaded lazily from Scene.tsx.
 */
import { useRef, type ReactNode } from "react";
import { DoubleSide, type Group } from "three";
import {
  Anchor,
  BookScene,
  focusOf,
  inset,
  Label,
  Mailbox,
  Outline,
  Parcel,
  Pickable,
  ReceiptSlip,
  spreadBeside,
  spreadFor,
  textBlock,
  Traveller,
  useAnimatedFrame,
  useFreeFrame,
  useInk,
  useStage,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import { Cross } from "../../../scene-kit/objects3d";
import { COLORS, INK } from "../../../scene-kit/theme";
import type { SceneProps } from "../../../app/types";
import stage from "../../stages/4-any-chain/stage";
import { describe, litSteps, PICK_LABELS, VAULT_USD, type Obj } from "./compare";
import {
  BRIDGE_TILES,
  COIN_AT,
  FIGURE,
  INTENT_TILES,
  MAILBOX,
  PARCEL,
  SHIELD,
  SLIP,
  TRACK_A_Z,
  TRACK_B_Z,
  VAULT,
} from "./layout";
import { Facts } from "./parts";
import { BACKING, CHECK, COMPARE, EXPLOIT } from "./steps";
import { tourFor, type Target } from "./tour";
import type { BridgeCompare } from "./useBridgeCompare";

const ACCENT = stage.accent;
const SPREAD = {
  print: spreadBeside({ ...FIGURE, maxZ: FIGURE.maxZ + 0.4 }),
  docked: spreadFor({ ...FIGURE, maxZ: FIGURE.maxZ + 0.4 }),
};
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 4", "Old bridge vs the NEAR way"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  Two paths across chains",
  "Fig. 2  Six steps against two",
  "Fig. 3  An IOU and a real coin",
  "Fig. 4  The vault is drained",
  "Fig. 5  The confidential shield",
  "Fig. 6  Bridges and intents",
];

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2]], 46, 0, 0.25);

function shotFocus(t: Target): Focus {
  const close = (center: Vec3, width: number, depth: number, height = 1.6): Focus => ({
    center,
    width,
    depth,
    height,
    elevation: 28,
    azimuth: -14,
  });
  switch (t.kind) {
    case "vault":
      return close([VAULT[0], 0.7, VAULT[2]], 2.4, 2.2, 1.8);
    case "slip":
      return close([SLIP[0], 0.5, SLIP[2]], 2, 2, 1.4);
    case "trackA":
      return close([0, 0.4, TRACK_A_Z], 8.6, 2.2, 1.6);
    case "trackB":
      return close([0, 0.4, TRACK_B_Z], 8.6, 2.2, 1.6);
    case "mailbox":
      return close([MAILBOX[0] - 0.4, 0.7, MAILBOX[2]], 2.6, 2.2, 1.8);
    case "parcel":
      return close([PARCEL[0] + 0.6, 0.5, PARCEL[2]], 2.6, 2.2, 1.6);
    default:
      return { ...WHOLE, elevation: 36, azimuth: -14 };
  }
}

export default function Scene3D({
  m,
  reducedMotion,
  flat,
  mode,
}: {
  m: BridgeCompare;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = m;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  const sheet = Math.min(step, CHECK);
  return (
    <div
      ref={root}
      className={`book-scene blc-book${summary ? " summary" : ""}`}
      data-testid="blc-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Old bridge vs the NEAR way, in 3D"
    >
      <BookScene
        page={step}
        sheet={sheet}
        spread={print ? SPREAD.print : SPREAD.docked}
        heads={print ? undefined : HEADS}
        caption={FIGURES[sheet]}
        text={print ? TEXT : null}
        focus={WHOLE}
        frame={inset(frame, { top: 24, bottom: 16 })}
        size={size}
        shots={tourFor(step)}
        shotFocus={shotFocus}
        flat={flat}
        reducedMotion={reducedMotion}
        state={m.state}
        description={summary ? "The book is open at the bridges page." : describe(m)}
        status={
          step === EXPLOIT && m.exploit !== "idle" && m.exploit !== "done"
            ? `the simulated exploit: ${m.exploit}`
            : undefined
        }
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : <Figure m={m} compact={!print} />}
      </BookScene>
      <div className={`book-scene-panel blc-panel${reducedMotion ? " still" : ""}`} ref={panel}>
        {summary ? null : <Facts m={m} compact />}
      </div>
    </div>
  );
}

type Kind = "shake" | "rattle" | "spin" | "hop" | "flip" | "pulse";

/**
 * A pick's reaction, drawn on demand: each object has its own (the vault rattles, the coin spins, the
 * slip flips, the mailbox hops, the shield pulses), and a "not yet" pick gives a short shake. `n` is the
 * pick's number, so each click plays it again. Reduced motion: no movement (the hint and the outline
 * still show).
 */
function Reaction({ n, kind, children }: { n: number; kind: Kind | null; children: ReactNode }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  const seen = useRef(n);
  const play = useRef<{ t0: number; kind: Kind } | null>(null);
  useAnimatedFrame(({ clock }) => {
    const node = g.current;
    if (!node) return false;
    if (seen.current !== n) {
      seen.current = n;
      play.current = kind && !reducedMotion ? { t0: clock.elapsedTime, kind } : null;
    }
    const p = play.current;
    node.position.set(0, 0, 0);
    node.rotation.set(0, 0, 0);
    node.scale.set(1, 1, 1);
    if (!p) return false;
    const u = Math.min(1, (clock.elapsedTime - p.t0) / (p.kind === "shake" ? 0.45 : 0.6));
    const bump = Math.sin(u * Math.PI);
    switch (p.kind) {
      case "shake":
        node.position.x = Math.sin(u * Math.PI * 6) * 0.09 * (1 - u);
        break;
      case "rattle":
        node.rotation.z = Math.sin(u * Math.PI * 4) * 0.06 * (1 - u);
        break;
      case "spin":
        node.rotation.y = u * Math.PI * 2;
        node.position.y = bump * 0.3;
        break;
      case "flip":
        node.rotation.y = u * Math.PI * 2;
        break;
      case "hop":
        node.position.y = bump * 0.25;
        break;
      case "pulse":
        node.scale.setScalar(1 + bump * 0.15);
        break;
    }
    if (u >= 1) play.current = null;
    return u < 1;
  });
  return <group ref={g}>{children}</group>;
}

/** Moves a value toward `target` (on demand), for the vault door and the shield's dome. */
function useEase(target: number, apply: (v: number) => void, speed = 4) {
  const { reducedMotion } = useStage();
  const v = useRef(target);
  useAnimatedFrame((_, delta) => {
    if (reducedMotion) v.current = target;
    else v.current += (target - v.current) * Math.min(1, delta * speed);
    if (Math.abs(target - v.current) < 0.002) v.current = target;
    apply(v.current);
    return v.current !== target;
  });
}

/** A bridge vault: a safe on the page, a round door with a dial and a stack of locked coins behind it. */
function Vault({
  cracked,
  drained,
  onPick,
  selected,
}: {
  cracked: boolean;
  drained: boolean;
  onPick: () => void;
  selected: boolean;
}) {
  const paper = useInk(cracked ? COLORS.redTint : COLORS.paper);
  const slab = useInk(COLORS.slab);
  const coin = useInk(ACCENT);
  const red = useInk(COLORS.red);
  const door = useRef<Group>(null);
  useEase(cracked ? -1.9 : 0, (v) => {
    if (door.current) door.current.rotation.y = v;
  });
  const W = 1.5;
  const H = 1.3;
  const D = 1.1;
  return (
    <Pickable label={PICK_LABELS.vault} selected={selected} onPick={onPick} anchor={[0, H + 0.3, 0]}>
      <group>
        {/* The body: a box open at the front, so the coins show when the door swings. */}
        <mesh position={[0, H / 2, 0]} material={paper}>
          <boxGeometry args={[W, H, D]} />
          <Outline mode="hull" thickness={0.03} />
          <Outline />
        </mesh>
        {/* The door, hinged on its left edge. */}
        <group ref={door} position={[-W / 2 + 0.1, H / 2, D / 2 + 0.03]}>
          <mesh position={[W / 2 - 0.1, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={slab}>
            <cylinderGeometry args={[0.5, 0.5, 0.08, 32]} />
            <Outline />
          </mesh>
          <mesh position={[W / 2 - 0.1, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]} material={paper}>
            <cylinderGeometry args={[0.14, 0.14, 0.06, 20]} />
            <Outline />
          </mesh>
        </group>
        {/* The locked coins, on the vault's floor in front: gone once drained. */}
        {drained
          ? null
          : [0, 1, 2].map((k) => (
              <mesh key={k} position={[W / 2 + 0.35, 0.07 + k * 0.13, 0.25]} material={coin}>
                <cylinderGeometry args={[0.26, 0.26, 0.11, 24]} />
                <Outline />
              </mesh>
            ))}
        {/* The crack: red ink zigzag across the front. */}
        {cracked
          ? [
              [-0.45, 1.0, 0.6],
              [-0.25, 0.75, -0.7],
              [-0.05, 0.5, 0.6],
            ].map(([x, y, r], i) => (
              <mesh key={i} position={[x!, y!, D / 2 + 0.03]} rotation={[0, 0, r!]} material={red}>
                <boxGeometry args={[0.38, 0.06, 0.02]} />
              </mesh>
            ))
          : null}
        {drained ? <Cross at={[0, H / 2, D / 2 + 0.12]} size={0.9} /> : null}
      </group>
    </Pickable>
  );
}

/** A confidential shield: a heraldic shield standing up, with a lock. In the accent once it is on. */
function Shield({ on, onPick, selected }: { on: boolean; onPick: () => void; selected: boolean }) {
  const face = useInk(on ? ACCENT : COLORS.paper);
  const ink = useInk(INK);
  return (
    <Pickable label={PICK_LABELS.shield} selected={selected} onPick={onPick} anchor={[0, 1.3, 0]}>
      <group position={[0, 0.6, 0]}>
        <mesh material={face}>
          <boxGeometry args={[0.8, 0.7, 0.08]} />
          <Outline mode="hull" thickness={0.025} />
          <Outline dashed={!on} />
        </mesh>
        <mesh position={[0, -0.42, 0]} rotation={[0, 0, Math.PI / 4]} material={face}>
          <boxGeometry args={[0.4, 0.4, 0.08]} />
          <Outline />
        </mesh>
        <mesh position={[0, 0, 0.06]} material={ink}>
          <boxGeometry args={[0.22, 0.18, 0.03]} />
        </mesh>
        <mesh position={[0, 0.13, 0.06]} material={ink}>
          <torusGeometry args={[0.08, 0.025, 8, 16, Math.PI]} />
        </mesh>
      </group>
    </Pickable>
  );
}

/** The dome the shield closes around your intent: it grows from the page (at once under reduced motion). */
function Dome({ on }: { on: boolean }) {
  const g = useRef<Group>(null);
  useEase(on ? 1 : 0, (v) => {
    if (!g.current) return;
    g.current.scale.setScalar(Math.max(0.001, v));
    g.current.visible = v > 0.01;
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.95, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.22} side={DoubleSide} depthWrite={false} />
        <Outline />
      </mesh>
    </group>
  );
}

/** A native USDC coin: a plain token coin in the accent, with no NEAR mark (another token, another face). */
function TokenCoin({ y }: { y: number }) {
  const ink = useInk(ACCENT);
  return (
    <mesh position={[0, y, 0]} material={ink}>
      <cylinderGeometry args={[0.36, 0.36, 0.12, 32]} />
      <Outline mode="hull" thickness={0.03} />
      <Outline />
    </mesh>
  );
}

/** A step tile on a track: a flat card, lit in the accent once its step has played. */
function Tile({ at, lit }: { at: Vec3; lit: boolean }) {
  const ink = useInk(lit ? ACCENT : COLORS.paper);
  return (
    <mesh position={[at[0], 0.04, at[2]]} material={ink}>
      <boxGeometry args={[0.6, 0.08, 0.36]} />
      <Outline dashed={!lit} />
    </mesh>
  );
}

function Figure({ m, compact }: { m: BridgeCompare; compact: boolean }) {
  const { step } = m;
  const n = m.picked?.n ?? 0;
  const OWN: Record<Obj, Kind> = {
    vault: "rattle",
    slip: "flip",
    coin: "spin",
    mailbox: "hop",
    shield: "pulse",
  };
  const kind = (o: Obj): Kind | null =>
    m.picked?.what === o ? (m.picked.result.notYet ? "shake" : OWN[o]) : null;
  const sel = (o: Obj) => m.picked?.what === o;
  const lit = litSteps(m.played);
  const delivered = step > COMPARE || lit.intent >= 2;
  const cracked = m.exploit !== "idle";
  const drained = m.exploit === "drain" || m.exploited;
  return (
    <group>
      {/* ---------- the two tracks ---------- */}
      {compact ? null : (
        <>
          <Label position={[0.1, 0.05, TRACK_A_Z - 0.45]} variant="small">
            Path A: the old bridge
          </Label>
          <Label position={[0.3, 0.05, TRACK_B_Z - 0.25]} variant="small">
            Path B: the NEAR way
          </Label>
        </>
      )}
      {BRIDGE_TILES.map((p, i) => (
        <Tile key={i} at={p} lit={i < lit.bridge} />
      ))}
      {INTENT_TILES.map((p, i) => (
        <Tile key={`i${i}`} at={p} lit={i < lit.intent} />
      ))}
      <Anchor name="timelines" position={[0, 0.4, (TRACK_A_Z + TRACK_B_Z) / 2]} />

      {/* ---------- path A: the old bridge ---------- */}
      <group position={VAULT}>
        <Reaction n={n} kind={kind("vault")}>
          <Vault cracked={cracked} drained={drained} onPick={() => m.pick("vault")} selected={sel("vault")} />
        </Reaction>
        <Label position={[0, 0.05, 0.95]} variant="small">
          {drained ? "bridge vault: $0 left" : `bridge vault: ${VAULT_USD}`}
        </Label>
      </group>
      <Anchor name="vault" position={[VAULT[0], 1.4, VAULT[2]]} />
      <group position={SLIP}>
        <Reaction n={n} kind={kind("slip")}>
          <ReceiptSlip
            size={1.1}
            color={ACCENT}
            label={m.exploited ? "wUSDC $0.00" : "wUSDC (IOU)"}
            state={m.exploited ? "failed" : "ok"}
            onPick={() => m.pick("slip")}
            pickLabel={PICK_LABELS.slip}
            selected={sel("slip")}
          />
        </Reaction>
      </group>
      <Anchor name="slip" position={[SLIP[0], 1.0, SLIP[2]]} />
      {/* The IOU's string to the vault, once inspected: red once the vault is drained. */}
      {step >= BACKING && m.inspected ? <Tether red={m.exploited} /> : null}

      {/* ---------- path B: the NEAR way ---------- */}
      <group position={PARCEL}>
        <Parcel size={0.8} color={ACCENT} to="USDC" stamped />
        <Dome on={m.shielded} />
      </group>
      <group position={SHIELD}>
        <Reaction n={n} kind={kind("shield")}>
          <Shield on={m.shielded} onPick={() => m.pick("shield")} selected={sel("shield")} />
        </Reaction>
      </group>
      <Anchor name="shield" position={[SHIELD[0], 1.2, SHIELD[2]]} />
      <group position={MAILBOX}>
        <Reaction n={n} kind={kind("mailbox")}>
          <Mailbox
            size={1.4}
            name="your account"
            color={ACCENT}
            flag={delivered && m.inspected}
            onPick={() => m.pick("mailbox")}
            pickLabel={PICK_LABELS.mailbox}
            selected={sel("mailbox")}
          />
        </Reaction>
      </group>
      <Traveller to={delivered ? COIN_AT.delivered : COIN_AT.solver} arc={1.4} duration={0.9} color={ACCENT}>
        <Reaction n={n} kind={kind("coin")}>
          <Pickable
            label={PICK_LABELS.coin}
            selected={sel("coin")}
            onPick={() => m.pick("coin")}
            anchor={[0, 0.7, 0]}
          >
            {[0, 1].map((k) => (
              <TokenCoin key={k} y={0.07 + k * 0.13} />
            ))}
          </Pickable>
        </Reaction>
        {compact ? null : (
          <Label position={[0, 0.05, 0.6]} variant="small">
            {m.exploited ? "USDC $1.00" : "native USDC"}
          </Label>
        )}
      </Traveller>
    </group>
  );
}

/** A thin ink string from the slip back to the vault: the IOU's claim. */
function Tether({ red }: { red: boolean }) {
  const ink = useInk(red ? COLORS.red : INK);
  const from: Vec3 = [VAULT[0] + 0.8, 0.9, VAULT[2]];
  const to: Vec3 = [SLIP[0] - 0.4, 0.6, SLIP[2]];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  return (
    <mesh
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 0.3, from[2]]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
      material={ink}
    >
      <boxGeometry args={[len, 0.03, 0.03]} />
    </mesh>
  );
}
