/**
 * Lesson 6.1 in 3D: a pop-up book scene (docs/book-scene.md). On the right page, a small town hall: the
 * staking pool's mailbox (front left), the veNEAR gauge (back left), the example proposal's scroll (back
 * right) with its quorum bar on the page, and the YES and NO ballot stamps (front right). Every object
 * reacts per rule 10a (governance.ts: reactionFor, MOTIONS). Only draws the shared state from
 * useGovernance. Loaded lazily from Scene.tsx.
 */
import { useRef } from "react";
import type { Mesh } from "three";
import {
  Anchor,
  BookScene,
  COLORS,
  focusOf,
  INK,
  inset,
  Label,
  Mailbox,
  Outline,
  Pickable,
  Scroll,
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
import {
  describe,
  MOTIONS,
  multiplier,
  PICK_LABELS,
  tally,
  times,
  type Choice,
  type Obj,
  type Reaction,
} from "./governance";
import { FIGURE, GAUGE, GAUGE_UNIT, POOL, QUORUM, SCROLL, STAMPS, STAMPS_CENTER } from "./layout";
import { Facts } from "./parts";
import { tourFor, type Target } from "./tour";
import { CHECK, HALL, INSPECT, LOCK, STAKE, VOTE, type Governance } from "./useGovernance";

const ACCENT = stage.accent;
/** The page needs room in front for the names under the front objects. */
const SPREAD = {
  print: spreadBeside({ ...FIGURE, maxZ: FIGURE.maxZ + 0.3 }),
  docked: spreadFor({ ...FIGURE, maxZ: FIGURE.maxZ + 0.3 }),
};
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 6", "Read and vote on a proposal"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  The town hall",
  "Fig. 2  Delegating to a staking pool",
  "Fig. 3  Locking NEAR for veNEAR",
  "Fig. 4  An example proposal",
  "Fig. 5  Your practice vote",
  "Fig. 6  The whole hall",
];

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.4]], 46, 0, 0.25);

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
    case "pool":
      return close([POOL[0], 0.8, POOL[2]], 2.4, 2.2, 2);
    case "gauge":
      return close([GAUGE[0], 1, GAUGE[2]], 2.2, 2, 2.4);
    case "scroll":
      return close([SCROLL[0], 0.7, (SCROLL[2] + QUORUM.z) / 2], QUORUM.length + 0.4, 2.6, 1.8);
    case "stamps":
      return close([STAMPS_CENTER[0], 0.5, STAMPS_CENTER[2]], 3.2, 2, 1.4);
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
  m: Governance;
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
      className={`book-scene gov-book${summary ? " summary" : ""}`}
      data-testid="gov-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Read and vote on a proposal, in 3D"
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
      <div className="book-scene-panel gov-panel" ref={panel}>
        {summary ? null : <Facts m={m} compact />}
      </div>
    </div>
  );
}

function Figure({ m, compact }: { m: Governance; compact: boolean }) {
  const { step } = m;
  const props = (o: Obj) => pickFor(m.reaction(o), () => m.pick(o), MOTIONS[o]);
  return (
    <group>
      {/* ---------- the staking pool ---------- */}
      <Mailbox
        position={POOL}
        size={1.5}
        name="staking pool"
        note={compact ? undefined : "50 NEAR"}
        color={step === STAKE ? ACCENT : COLORS.paper}
        flag={step >= STAKE}
        pickLabel={PICK_LABELS.pool}
        selected={m.isPicked("pool")}
        {...props("pool")}
      />
      <Anchor name="pool" position={[POOL[0], 1.2, POOL[2]]} />

      {/* ---------- the veNEAR gauge ---------- */}
      <group position={GAUGE}>
        <SoftShadow position={[0, 0, 0.2]} size={[1.3, 0.9]} />
        <Pickable
          label={PICK_LABELS.gauge}
          selected={m.isPicked("gauge")}
          anchor={[0, 1, 0]}
          {...props("gauge")}
        >
          <Gauge months={m.months} lit={step === LOCK || m.locked} />
        </Pickable>
      </group>
      <Anchor name="gauge" position={[GAUGE[0], 1.6, GAUGE[2]]} />

      {/* ---------- the proposal and its quorum bar ---------- */}
      <Scroll
        position={SCROLL}
        size={1.3}
        name="Proposal #42"
        note={compact ? undefined : m.reviewed ? "read" : "example"}
        color={step === INSPECT ? ACCENT : COLORS.contract}
        pickLabel={PICK_LABELS.scroll}
        selected={m.isPicked("scroll")}
        {...props("scroll")}
      />
      <Anchor name="scroll" position={[SCROLL[0], 1.3, SCROLL[2]]} />
      <Anchor name="hall" position={[QUORUM.x, 0.6, QUORUM.z]} />
      <Quorum m={m} />

      {/* ---------- the ballot stamps ---------- */}
      {(["yes", "no"] as const).map((c) => (
        <group key={c} position={STAMPS[c]}>
          <SoftShadow position={[0, 0, 0.15]} size={[1, 0.7]} />
          <Pickable label={PICK_LABELS[c]} selected={m.isPicked(c)} anchor={[0, 0.5, 0]} {...props(c)}>
            <Ballot choice={c} mine={m.ballot?.choice === c} ready={step === VOTE && !m.ballot} />
          </Pickable>
        </group>
      ))}
      <Anchor name="stamps" position={[STAMPS_CENTER[0], 0.9, STAMPS_CENTER[2]]} />
      {step === HALL && !compact ? (
        <Label position={[STAMPS_CENTER[0], 0.05, STAMPS_CENTER[2] + 0.75]} variant="small">
          ballot stamps
        </Label>
      ) : null}
    </group>
  );
}

/**
 * The veNEAR gauge: a paper board with marks at 1× to 4× and a column that rises to the multiplier. The
 * column grows towards a new length (render on demand: it settles); reduced motion jumps there.
 */
function Gauge({ months, lit }: { months: number; lit: boolean }) {
  const { reducedMotion } = useStage();
  const board = useInk(COLORS.paper);
  const fill = useInk(lit ? ACCENT : COLORS.slab);
  const ink = useInk(INK);
  const column = useRef<Mesh>(null);
  const target = GAUGE_UNIT * multiplier(months);
  useAnimatedFrame((_, dt) => {
    const c = column.current;
    if (!c) return false;
    const now = c.scale.y;
    const next = reducedMotion ? target : now + (target - now) * Math.min(1, dt * 8);
    const done = Math.abs(next - target) < 0.002;
    c.scale.y = done ? target : next;
    c.position.y = 0.12 + c.scale.y / 2;
    return !done;
  });
  const h = GAUGE_UNIT * 4 + 0.3;
  return (
    <group>
      {/* Plinth. */}
      <mesh position={[0, 0.06, 0]} material={board}>
        <boxGeometry args={[0.9, 0.12, 0.6]} />
        <Outline />
      </mesh>
      {/* The board with its marks. */}
      <mesh position={[0, 0.12 + h / 2, -0.15]} material={board}>
        <boxGeometry args={[0.8, h, 0.06]} />
        <Outline />
      </mesh>
      {[1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[0.25, 0.12 + GAUGE_UNIT * k, -0.11]} material={ink}>
          <boxGeometry args={[0.18, 0.03, 0.01]} />
        </mesh>
      ))}
      {/* The column: unit height, scaled to the multiplier. */}
      <mesh
        ref={column}
        position={[-0.08, 0.12 + GAUGE_UNIT / 2, 0]}
        scale={[1, GAUGE_UNIT, 1]}
        material={fill}
      >
        <boxGeometry args={[0.3, 1, 0.24]} />
        <Outline />
      </mesh>
      <Label position={[0, 0.12 + h + 0.4, 0]}>{`veNEAR ${times(months)}`}</Label>
    </group>
  );
}

/** The quorum bar on the page: yes (green) and no (red) votes out of the quorum (the end post). */
function Quorum({ m }: { m: Governance }) {
  const t = tally(m.ballot);
  const track = useInk(COLORS.paper);
  const yes = useInk(COLORS.green);
  const no = useInk(COLORS.red);
  const ink = useInk(INK);
  const L = QUORUM.length;
  const ly = (t.yes / t.quorum) * L;
  const ln = (t.no / t.quorum) * L;
  const x0 = QUORUM.x - L / 2;
  return (
    <group position={[0, 0, QUORUM.z]}>
      <mesh position={[QUORUM.x, 0.04, 0]} material={track}>
        <boxGeometry args={[L, 0.08, QUORUM.width]} />
        <Outline />
      </mesh>
      <mesh position={[x0 + ly / 2, 0.1, 0]} material={yes}>
        <boxGeometry args={[ly, 0.06, QUORUM.width * 0.7]} />
      </mesh>
      <mesh position={[x0 + ly + ln / 2, 0.1, 0]} material={no}>
        <boxGeometry args={[ln, 0.06, QUORUM.width * 0.7]} />
      </mesh>
      {/* The quorum post at the end of the bar. */}
      <mesh position={[x0 + L, 0.3, 0]} material={ink}>
        <boxGeometry args={[0.06, 0.6, 0.06]} />
      </mesh>
      <Label position={[QUORUM.x, 0.05, -(QUORUM.width / 2 + 0.25)]} variant="small">
        {`quorum ${t.quorumPct}%`}
      </Label>
    </group>
  );
}

/** A ballot stamp: a wooden handle on a block whose face reads YES or NO. Inked once it is your vote. */
function Ballot({ choice, mine, ready }: { choice: Choice; mine: boolean; ready: boolean }) {
  const ink = choice === "yes" ? COLORS.green : COLORS.red;
  const tint = choice === "yes" ? COLORS.greenTint : COLORS.redTint;
  const wood = useInk(COLORS.kraft);
  const block = useInk(mine ? ink : ready ? ACCENT : tint);
  return (
    <group>
      <mesh position={[0, 0.14, 0]} material={block}>
        <boxGeometry args={[0.9, 0.28, 0.6]} />
        <Outline />
      </mesh>
      <mesh position={[0, 0.48, 0]} material={wood}>
        <cylinderGeometry args={[0.08, 0.1, 0.4, 12]} />
        <Outline threshold={40} />
      </mesh>
      <mesh position={[0, 0.76, 0]} material={wood}>
        <sphereGeometry args={[0.17, 14, 10]} />
        <Outline mode="hull" thickness={0.025} />
      </mesh>
      <Label position={[0, 1.0, 0]}>{mine ? `${choice.toUpperCase()} ✓` : choice.toUpperCase()}</Label>
    </group>
  );
}
