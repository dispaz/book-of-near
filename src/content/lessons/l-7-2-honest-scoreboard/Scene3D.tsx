/**
 * Lesson 7.2 in 3D: a pop-up book scene (docs/book-scene.md). On the right page, four chain pillars
 * (NEAR, Ethereum, Solana, Cosmos) stand along the back and rise or sink with the open card; the four
 * dimension cards lie in front of them. A pick of a card slides it forward and opens its dimension; a
 * pick of a pillar bounces it and shows that chain's note. Only draws the shared state from
 * useScoreboard. Loaded lazily from Scene.tsx.
 */
import { useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import type { Group, Object3D } from "three";
import {
  Anchor,
  BookScene,
  COLORS,
  focusOf,
  inset,
  Label,
  Outline,
  Pickable,
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
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import stage from "../../stages/7-book-of-near/stage";
import {
  CHAINS,
  describeBoard,
  dimForStep,
  DIMS,
  pillarHeight,
  VERDICT_TEXT,
  verdictOf,
  type Obj,
} from "./board";
import { CARD, CARD_X, CARD_Z, CHAIN_COLOR, FIGURE, PILLAR_W, PILLAR_X, PILLAR_Z } from "./layout";
import { Facts, pickName } from "./parts";
import { tourFor, type Target } from "./tour";
import { CHECK, type Scoreboard } from "./useScoreboard";

const ACCENT = stage.accent;
/** The page needs room behind the pillars for their names, in front for the cards' words. */
const BOX = { ...FIGURE, minZ: FIGURE.minZ - 0.3, maxZ: FIGURE.maxZ + 0.3 };
const SPREAD = { print: spreadBeside(BOX), docked: spreadFor(BOX) };
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 7", "The honest scoreboard"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  No chain wins at everything",
  "Fig. 2  Accounts",
  "Fig. 3  Scalability",
  "Fig. 4  Speed and atomicity",
  "Fig. 5  Liquidity",
  "Fig. 6  The whole board",
];

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.8]], 40, 0, 0.25);

function shotFocus(t: Target): Focus {
  switch (t.kind) {
    case "pillars":
      return { center: [0, 1.1, PILLAR_Z], width: 8, depth: 1.6, height: 2.4, elevation: 22, azimuth: -10 };
    case "cards":
      return { center: [0, 0.2, CARD_Z], width: 8, depth: 1.4, height: 0.8, elevation: 40, azimuth: -8 };
    case "near":
      return {
        center: [PILLAR_X.near, 1.1, PILLAR_Z],
        width: 2.2,
        depth: 1.6,
        height: 2.6,
        elevation: 20,
        azimuth: -14,
      };
    default:
      return { ...WHOLE, elevation: 34, azimuth: -12 };
  }
}

export default function Scene3D({
  m,
  reducedMotion,
  flat,
  mode,
}: {
  m: Scoreboard;
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
      className={`book-scene hsb-book${summary ? " summary" : ""}`}
      data-testid="hsb-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="The honest scoreboard, in 3D"
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
        description={describeBoard(m.active)}
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : <Figure m={m} compact={!print} />}
      </BookScene>
      <div className="book-scene-panel hsb-panel" ref={panel}>
        {summary ? null : <Facts m={m} compact />}
      </div>
    </div>
  );
}

/** Rule 10a's props for an object: its hint at this step, or its detail. */
function react(m: Scoreboard, o: Obj) {
  const r = m.reactionOf(o);
  return r.hint ? { disabledHint: r.hint } : { detail: r.detail };
}

/**
 * The board. `compact` (a narrow scene, the words docked): the verdicts stay in the panel's table and
 * only the step's card and the open card keep their titles, so the labels do not crowd.
 */
function Figure({ m, compact }: { m: Scoreboard; compact: boolean }) {
  const stepDim = dimForStep(m.step);
  return (
    <group>
      {CHAINS.map((c) => {
        const o: Obj = { kind: "pillar", chain: c.id };
        return (
          <Pillar
            key={c.id}
            x={PILLAR_X[c.id]}
            height={pillarHeight(c.id, m.active)}
            color={CHAIN_COLOR[c.id]}
            name={c.name}
            verdict={m.active && !compact ? VERDICT_TEXT[verdictOf(m.active, c.id)] : null}
            small={compact}
            label={pickName(o)}
            onPick={() => m.pick(o)}
            {...react(m, o)}
          />
        );
      })}
      <Anchor name="pillars" position={[0, 1.2, PILLAR_Z]} />
      {DIMS.map((d) => {
        const o: Obj = { kind: "card", dim: d.id };
        return (
          <DimensionCard
            key={d.id}
            x={CARD_X[d.id]}
            title={!compact || d.id === stepDim || d.id === m.active ? d.title : null}
            explored={m.explored.has(d.id)}
            active={m.active === d.id}
            label={pickName(o)}
            onPick={() => m.pick(o)}
            {...react(m, o)}
          />
        );
      })}
      <Anchor name="cards" position={[0, 0.3, CARD_Z]} />
    </group>
  );
}

/** A pillar's pick: a springy bounce up and back (it "weighs in"). */
const bounce: PickMotion = (obj: Object3D, t) => {
  const u = Math.min(1, t / 0.6);
  const s = Math.sin(u * Math.PI) * (1 - u * 0.5);
  obj.position.y += 0.35 * s;
  obj.scale.y *= 1 + 0.12 * s;
  return u < 1;
};

/** A card's pick: it slides toward the reader and tilts up, then lies back down. */
const slide: PickMotion = (obj: Object3D, t) => {
  const u = Math.min(1, t / 0.6);
  const s = Math.sin(u * Math.PI);
  obj.position.z += 0.35 * s;
  obj.position.y += 0.15 * s;
  obj.rotation.x -= 0.5 * s;
  return u < 1;
};

/**
 * A chain's pillar: an inked column in the chain's colour. Its height eases to the verdict on the open
 * card (render on demand: it stops asking for frames once it is there). Reduced motion: it jumps.
 */
function Pillar({
  x,
  height,
  color,
  name,
  verdict,
  small,
  label,
  onPick,
  disabledHint,
  detail,
}: {
  x: number;
  height: number;
  color: string;
  name: string;
  verdict: string | null;
  small: boolean;
  label: string;
  onPick: () => void;
  disabledHint?: string;
  detail?: string;
}) {
  const { reducedMotion } = useStage();
  const ink = useInk(color, true);
  const col = useRef<Group>(null);
  useAnimatedFrame((_, dt) => {
    const g = col.current;
    if (!g) return false;
    const now = g.scale.y;
    const next = reducedMotion ? height : now + (height - now) * Math.min(1, dt * 7);
    const done = Math.abs(height - next) < 0.005;
    g.scale.y = done ? height : next;
    return !done;
  });
  return (
    <group position={[x, 0, PILLAR_Z]}>
      <SoftShadow position={[0, 0, 0.15]} size={[PILLAR_W * 1.8, PILLAR_W * 1.3]} />
      <Pickable
        label={label}
        anchor={[0, height / 2, 0]}
        onPick={onPick}
        disabledHint={disabledHint}
        detail={detail}
        pickMotion={bounce}
      >
        <group ref={col} scale={[1, height, 1]}>
          <RoundedBox
            args={[PILLAR_W, 1, PILLAR_W]}
            radius={0.06}
            smoothness={1}
            position={[0, 0.5, 0]}
            material={ink}
          >
            <Outline threshold={20} />
          </RoundedBox>
        </group>
      </Pickable>
      <Label position={[0, height + (verdict ? 0.95 : 0.6), 0]} variant={small ? "small" : "hand"}>
        {name}
      </Label>
      {verdict ? (
        <Label position={[0, height + 0.45, 0]} variant="small">
          {verdict}
        </Label>
      ) : null}
    </group>
  );
}

/** A dimension card lying on the page: accent once explored, raised while it is the open one. */
function DimensionCard({
  x,
  title,
  explored,
  active,
  label,
  onPick,
  disabledHint,
  detail,
}: {
  x: number;
  title: string | null;
  explored: boolean;
  active: boolean;
  label: string;
  onPick: () => void;
  disabledHint?: string;
  detail?: string;
}) {
  const ink = useInk(explored ? ACCENT : COLORS.paper);
  const lift = active ? 0.12 : 0;
  return (
    <group position={[x, 0, CARD_Z]}>
      <Pickable
        label={label}
        anchor={[0, 0.3, 0]}
        onPick={onPick}
        disabledHint={disabledHint}
        detail={detail}
        pickMotion={slide}
      >
        <mesh position={[0, CARD.thick / 2 + lift, 0]} rotation={[active ? -0.12 : 0, 0, 0]} material={ink}>
          <boxGeometry args={[CARD.width, CARD.thick, CARD.depth]} />
          <Outline />
        </mesh>
      </Pickable>
      {title ? (
        <Label position={[0, 0.25 + lift, 0.1]} variant="small">
          {title}
        </Label>
      ) : null}
    </group>
  );
}
