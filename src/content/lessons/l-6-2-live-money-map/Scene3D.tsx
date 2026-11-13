/**
 * Lesson 6.2 in 3D: a pop-up book scene (docs/book-scene.md). On the right page, the money map: the
 * oracle booth (back left), the NEAR Intents area (back middle), the Rhea Lend ledger (back right), the
 * USDC mailbox (front left) and two Rhea pools, stable and simple (front). Every object reacts per rule
 * 10a (money.ts: reactionFor, MOTIONS). Only draws the shared state from useMoneyMap. Loaded lazily.
 */
import { useRef } from "react";
import type { Group } from "three";
import {
  Anchor,
  BookScene,
  ChainArea,
  COLORS,
  focusOf,
  INK,
  inset,
  Label,
  Ledger,
  Mailbox,
  Outline,
  Pickable,
  RpcWindow,
  SoftShadow,
  spreadBeside,
  spreadFor,
  textBlock,
  useAnimatedFrame,
  useFreeFrame,
  useInk,
  useStage,
  type Focus,
  type PickMotion,
  type Vec3,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import stage from "../../stages/6-citizen/stage";
import { describe, fmt, MOTIONS, ORACLE_READ, PICK_LABELS, QUOTES, type Obj, type Reaction } from "./money";
import { FIGURE, INTENTS_AT, LEND_AT, ORACLE_AT, POOL_R, SIMPLE_AT, STABLE_AT, USDC_AT } from "./layout";
import { Facts } from "./parts";
import { tourFor, type Target } from "./tour";
import { CHECK, DOLLARS, FLOWS, MAP, ORACLE, SWAP } from "./steps";
import type { MoneyMap } from "./useMoneyMap";

const ACCENT = stage.accent;
/** The page needs room in front for the names under the front objects. */
const SPREAD = {
  print: spreadBeside({ ...FIGURE, maxZ: FIGURE.maxZ + 0.3 }),
  docked: spreadFor({ ...FIGURE, maxZ: FIGURE.maxZ + 0.3 }),
};
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 6", "The live money map"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  The money map (recorded 13 Nov 2026)",
  "Fig. 2  Native USDC and a bridge's copy",
  "Fig. 3  The oracle's stored price",
  "Fig. 4  One trade, two pools",
  "Fig. 5  Intents settling on NEAR",
  "Fig. 6  The whole map",
];

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.2]], 46, 0, 0.25);
const POOLS_MID: Vec3 = [(STABLE_AT[0] + SIMPLE_AT[0]) / 2, 0.4, STABLE_AT[2]];

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target): Focus {
  const close = (center: Vec3, width: number, depth: number, height = 1.8): Focus => ({
    center,
    width,
    depth,
    height,
    elevation: 28,
    azimuth: -14,
  });
  switch (t.kind) {
    case "usdc":
      return close([USDC_AT[0], 0.8, USDC_AT[2]], 2.4, 2.2, 2);
    case "oracle":
      return close([ORACLE_AT[0], 0.9, ORACLE_AT[2]], 2.4, 2.2, 2.2);
    case "pools":
      return close(POOLS_MID, SIMPLE_AT[0] - STABLE_AT[0] + 2 * POOL_R + 0.6, 2.4, 1.4);
    case "lend":
      return close([LEND_AT[0], 0.5, LEND_AT[2]], 2.2, 2, 1.4);
    case "intents":
      return close([INTENTS_AT.x, 0.4, INTENTS_AT.z], INTENTS_AT.width + 0.4, INTENTS_AT.depth + 0.4, 1.2);
    default:
      return { ...WHOLE, elevation: 36, azimuth: -14 };
  }
}

/** Pickable props for one object's reaction (rule 10a): its step action, a "not yet" hint or a detail. */
const pickFor = (r: Reaction, action: () => void, pickMotion: PickMotion) => ({
  onPick: r.act ? action : undefined,
  disabledHint: r.hint,
  detail: r.detail,
  pickMotion,
});

export default function Scene3D({
  m,
  reducedMotion,
  flat,
  mode,
}: {
  m: MoneyMap;
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
      className={`book-scene money-book${summary ? " summary" : ""}`}
      data-testid="money-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="The live money map, in 3D"
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
        description={describe(m)}
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : <Figure m={m} compact={!print} />}
      </BookScene>
      <div className="book-scene-panel money-panel" ref={panel}>
        {summary ? null : <Facts m={m} compact />}
      </div>
    </div>
  );
}

function Figure({ m, compact }: { m: MoneyMap; compact: boolean }) {
  const { step } = m;
  const props = (o: Obj) => pickFor(m.reaction(o), () => m.pick(o), MOTIONS[o]);
  return (
    <group>
      {/* ---------- the NEAR Intents area (back middle) ---------- */}
      <ChainArea
        position={[INTENTS_AT.x, 0, INTENTS_AT.z]}
        width={INTENTS_AT.width}
        depth={INTENTS_AT.depth}
        name="NEAR Intents"
        color={step === FLOWS ? ACCENT : COLORS.chain}
        blocks={3}
        blockSize={0.7}
        pickLabel={PICK_LABELS.intents}
        selected={m.isPicked("intents")}
        {...props("intents")}
      />
      <Anchor name="intents" position={[INTENTS_AT.x, 0.8, INTENTS_AT.z]} />
      <Anchor name="map" position={[INTENTS_AT.x, 0.6, 0]} />
      {m.flows ? <Flows /> : null}

      {/* ---------- the oracle booth (back left) ---------- */}
      <RpcWindow
        position={ORACLE_AT}
        size={1.2}
        name="oracle"
        note={compact ? undefined : m.oracleRead ? `${ORACLE_READ.stored}, Aug` : "Pyth"}
        color={step === ORACLE ? ACCENT : COLORS.blue}
        lit={m.oracleRead}
        pickLabel={PICK_LABELS.oracle}
        selected={m.isPicked("oracle")}
        {...props("oracle")}
      />
      <Anchor name="oracle" position={[ORACLE_AT[0], 1.4, ORACLE_AT[2]]} />

      {/* ---------- Rhea Lend (back right) ---------- */}
      <Ledger
        position={LEND_AT}
        size={0.8}
        pages={3}
        name="Rhea Lend"
        edge={step === MAP ? ACCENT : COLORS.slab}
        pickLabel={PICK_LABELS.lend}
        selected={m.isPicked("lend")}
        {...props("lend")}
      />

      {/* ---------- the USDC mailbox (front left) ---------- */}
      <Mailbox
        position={USDC_AT}
        size={1.4}
        name="USDC"
        note={compact ? undefined : m.compared ? "79.3M" : "Circle"}
        color={step === DOLLARS ? ACCENT : COLORS.paper}
        flag={m.compared}
        pickLabel={PICK_LABELS.usdc}
        selected={m.isPicked("usdc")}
        {...props("usdc")}
      />
      <Anchor name="usdc" position={[USDC_AT[0], 1.2, USDC_AT[2]]} />
      {m.compared && !compact ? (
        <Label position={[USDC_AT[0], 0.05, USDC_AT[2] + 0.95]} variant="small">
          USDC.e: 14.6M bridged
        </Label>
      ) : null}

      {/* ---------- the two pools (front) ---------- */}
      {(["stable", "simple"] as const).map((w) => {
        const at = w === "stable" ? STABLE_AT : SIMPLE_AT;
        return (
          <group key={w} position={at}>
            <SoftShadow position={[0, 0, 0.1]} size={[POOL_R * 2.3, POOL_R * 1.6]} />
            <Pickable label={PICK_LABELS[w]} selected={m.isPicked(w)} anchor={[0, 0.5, 0]} {...props(w)}>
              <Pool which={w} lit={step === SWAP} />
            </Pickable>
            <Label position={[0, 1.3, -0.2]}>{w === "stable" ? "stable pool" : "simple pool"}</Label>
            {m.trade && !compact ? (
              <Label position={[0, 0.05, POOL_R + 0.45]} variant="small">
                {w === "stable"
                  ? `→ ${fmt(QUOTES[m.trade].stableOut, 2)} USDt`
                  : `→ ${fmt(QUOTES[m.trade].simpleOut, 2)} NEAR`}
              </Label>
            ) : null}
          </group>
        );
      })}
      <Anchor name="pools" position={POOLS_MID} />
    </group>
  );
}

/** A pool basin: a paper tub with two tokens' water side by side (USDC blue, and USDt or NEAR). */
function Pool({ which, lit }: { which: "stable" | "simple"; lit: boolean }) {
  const tub = useInk(lit ? ACCENT : COLORS.paper);
  const usdc = useInk(COLORS.blue);
  const other = useInk(which === "stable" ? COLORS.green : COLORS.near);
  return (
    <group>
      <mesh position={[0, 0.18, 0]} material={tub}>
        <cylinderGeometry args={[POOL_R, POOL_R * 0.9, 0.36, 28, 1, true]} />
        <Outline threshold={40} />
      </mesh>
      <mesh position={[0, 0.03, 0]} material={tub}>
        <cylinderGeometry args={[POOL_R * 0.9, POOL_R * 0.9, 0.06, 28]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[0, 0, 0]} material={usdc}>
        <cylinderGeometry args={[POOL_R * 0.92, POOL_R * 0.92, 0.04, 20, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} material={other}>
        <cylinderGeometry args={[POOL_R * 0.92, POOL_R * 0.92, 0.04, 20, 1, false, Math.PI, Math.PI]} />
      </mesh>
    </group>
  );
}

/**
 * The intent flows: three arrows from the NEAR Intents area to the pools and the mailbox. They grow in
 * once and settle (render on demand); reduced motion shows them at full length at once.
 */
function Flows() {
  const { reducedMotion } = useStage();
  const ink = useInk(ACCENT);
  const head = useInk(INK);
  const refs = useRef<(Group | null)[]>([]);
  const grow = useRef(0);
  useAnimatedFrame((_, dt) => {
    grow.current = reducedMotion ? 1 : Math.min(1, grow.current + dt * 1.5);
    for (const g of refs.current) if (g) g.scale.z = Math.max(0.001, grow.current);
    return grow.current < 1;
  });
  const from: Vec3 = [INTENTS_AT.x, 0.12, INTENTS_AT.z + INTENTS_AT.depth / 2];
  return (
    <group>
      {[STABLE_AT, SIMPLE_AT, USDC_AT].map((to, i) => {
        const dx = to[0] - from[0];
        const dz = to[2] - POOL_R - from[2];
        const len = Math.hypot(dx, dz);
        const yaw = Math.atan2(dx, dz);
        return (
          <group key={i} position={from} rotation={[0, yaw, 0]}>
            <group
              ref={(g) => {
                refs.current[i] = g;
              }}
              scale={[1, 1, reducedMotion ? 1 : 0.001]}
            >
              <mesh position={[0, 0, len / 2]} material={ink}>
                <boxGeometry args={[0.1, 0.06, len]} />
                <Outline />
              </mesh>
              <mesh position={[0, 0, len]} rotation={[Math.PI / 2, 0, 0]} material={head}>
                <coneGeometry args={[0.16, 0.3, 12]} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}
