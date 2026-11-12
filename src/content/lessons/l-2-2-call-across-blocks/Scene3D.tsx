/**
 * Lesson 2.2 in 3D: a pop-up book scene (docs/book-scene.md). On the right page: contract A and
 * contract B as scrolls (the gear turns while a receipt runs on them), the action receipt at step 2,
 * the block row (a parcel for the transaction, then a slip per receipt, one block each) and, at step 4,
 * the gas meter split 70 / 30. Every object is a pick that runs the step's action or shows a detail. It
 * only draws the shared state from useCrossCall. Loaded lazily from Scene.tsx.
 */
import { useRef } from "react";
import { Line } from "@react-three/drei";
import {
  Anchor,
  BookScene,
  COLORS,
  focusOf,
  INK,
  inset,
  Label,
  Outline,
  Parcel,
  Pickable,
  ReceiptSlip,
  Scroll,
  spreadBeside,
  spreadFor,
  textBlock,
  useFreeFrame,
  useInk,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";
import type { SceneProps } from "../../../app/types";
import { formatTgas } from "../../../chain/units";
import { gasSplit } from "./call";
import { A, B, BLOCK_Z, boxOf, COLUMNS, FIGURE, METER, partsAt, ROW_Z, SLIP } from "./layout3d";
import { calleeFailed, describe, Facts, namesOf, runningOn, shardOf, short, slotsOf, tagOf } from "./parts";
import { CHECK, FAIL, HOOK, ORDER } from "./steps";
import { tourFor, type Target } from "./tour";
import type { CallState } from "./useCrossCall";

const ACCENT = STAGE_ACCENTS[2];
const SPREAD = { print: spreadBeside(FIGURE), docked: spreadFor(FIGURE) };
/** Where the step's words are printed on the left page. */
const TEXT = textBlock(SPREAD.print);
/** Running heads, only when the words are docked (the printed step heads the page otherwise). */
const HEADS: [string, string] = ["Stage 2", "A call that takes several blocks"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  Two contracts, each on its own",
  "Fig. 2  An action receipt",
  "Fig. 3  One call, four blocks",
  "Fig. 4  Where the gas went",
  "Fig. 5  A failed call and its callback",
  "Fig. 6  Receipts, blocks and gas",
];

/** What the camera keeps in view at a step: the parts it draws. */
function focusFor(step: number): Focus {
  return focusOf(
    partsAt(step).map((p) => boxOf(p)),
    44,
  );
}

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target, base: Focus): Focus {
  if (t.kind === "all") return { ...base, elevation: 34, azimuth: -14 };
  const [minX, maxX, minZ, maxZ, h] = boxOf(t.kind);
  return {
    center: [(minX + maxX) / 2, h / 3, (minZ + maxZ) / 2],
    width: maxX - minX + 0.6,
    depth: maxZ - minZ + 0.6,
    height: h,
    elevation: t.kind === "meter" || t.kind === "blocks" ? 40 : 26,
    azimuth: -14,
  };
}

export default function Scene3D({
  c,
  reducedMotion,
  flat,
  mode,
}: {
  c: CallState;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = c;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  // Steps after the quiz stay on the quiz's sheet.
  const sheet = Math.min(step, CHECK);
  const focus = focusFor(step);
  return (
    <div
      ref={root}
      className={`book-scene xcc-book${summary ? " summary" : ""}`}
      data-testid="call-scene"
      data-scene-state={c.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="A call that takes several blocks, in 3D"
    >
      <BookScene
        page={step}
        sheet={sheet}
        spread={print ? SPREAD.print : SPREAD.docked}
        heads={print ? undefined : HEADS}
        caption={FIGURES[sheet]}
        text={print ? TEXT : null}
        focus={focus}
        frame={inset(frame, { top: 28, bottom: 20 })}
        size={size}
        shots={tourFor(step)}
        shotFocus={(t: Target) => shotFocus(t, focus)}
        flat={flat}
        reducedMotion={reducedMotion}
        state={c.state}
        description={summary ? "The book is open at the receipts page." : describe(c)}
        status={c.busy ? "Sending…" : undefined}
      >
        {summary && !wide ? null : <Figure c={c} />}
      </BookScene>
      {/* The facts both views show (HTML), over the right page. */}
      <div className="book-scene-panel xcc-panel" ref={panel}>
        {summary ? null : <Facts c={c} compact />}
      </div>
    </div>
  );
}

function Figure({ c }: { c: CallState }) {
  const parts = partsAt(c.step);
  const { caller, callee } = namesOf(c);
  const running = runningOn(c);
  const shardA = shardOf(c.drawn ?? c.call, caller);
  const shardB = shardOf(c.drawn ?? c.call, callee);
  return (
    <group>
      <Scroll
        position={A}
        size={1.5}
        name={tagOf("A", caller)}
        note={shardA !== null ? `shard ${shardA}` : undefined}
        color={ACCENT}
        running={running === caller}
        pickLabel={`Scroll: contract A, ${caller}`}
        onPick={() => c.pickContract("caller")}
      />
      <Scroll
        position={B}
        size={1.5}
        name={tagOf("B", callee)}
        note={shardB !== null ? `shard ${shardB}` : undefined}
        color={ACCENT}
        state={calleeFailed(c) ? "failed" : "ok"}
        running={running === callee}
        pickLabel={`Scroll: contract B, ${callee}`}
        onPick={() => c.pickContract("callee")}
      />
      {c.step === HOOK ? <Anchor name="contracts" position={[0, 1.0, A[2]]} /> : null}
      {parts.includes("slip") ? <ActionSlip c={c} caller={caller} callee={callee} /> : null}
      {parts.includes("blocks") ? <Row c={c} /> : null}
      {parts.includes("meter") ? <Meter c={c} /> : null}
    </group>
  );
}

/** Step 2: one action receipt between the two contracts, addressed from A to B. */
function ActionSlip({ c, caller, callee }: { c: CallState; caller: string; callee: string }) {
  const path: Vec3[] = [
    [A[0] + 0.7, 0.9, A[2]],
    [0, 1.3, A[2]],
    [B[0] - 0.7, 0.9, B[2]],
  ];
  return (
    <group>
      <Line points={path} color={INK} lineWidth={2} dashed dashSize={0.12} gapSize={0.08} />
      <ReceiptSlip
        position={SLIP}
        size={0.8}
        color={ACCENT}
        label="call"
        pickLabel={`Action receipt from ${caller} to ${callee}: call a method, with gas`}
        onPick={() => c.pickHop(0)}
      />
      <Label position={[SLIP[0], 0.05, SLIP[2] + 0.5]} variant="small">
        action receipt
      </Label>
      <Anchor name="slip" position={[SLIP[0], 0.6, SLIP[2]]} />
    </group>
  );
}

/** The block row: a parcel for the transaction, then a slip per receipt, one block each. */
function Row({ c }: { c: CallState }) {
  const slots = slotsOf(c);
  const line: Vec3[] = [
    [COLUMNS[0] - 0.6, 0.02, BLOCK_Z + 0.3],
    [COLUMNS[3] + 0.6, 0.02, BLOCK_Z + 0.3],
  ];
  return (
    <group>
      <Line points={line} color={INK} lineWidth={2} />
      <Label position={[COLUMNS[3] + 0.3, 0.05, BLOCK_Z + 0.55]} variant="small">
        time →
      </Label>
      {slots.map((s, i) => {
        const x = COLUMNS[i]!;
        const at: Vec3 = [x, 0, ROW_Z];
        return (
          <group key={i}>
            {i === 0 ? (
              <Parcel
                position={at}
                size={0.75}
                color={ACCENT}
                stamped={s.ran}
                state={s.ran ? "ok" : "pending"}
                pickLabel={s.pickLabel}
                onPick={s.onPick}
              />
            ) : (
              <ReceiptSlip
                position={at}
                size={0.75}
                color={ACCENT}
                state={s.ran ? (s.failed ? "failed" : "ok") : "pending"}
                fate={s.ran ? (s.failed ? "failed" : "done") : "idle"}
                label={String(i)}
                selected={s.picked}
                pickLabel={s.pickLabel}
                onPick={s.onPick}
              />
            )}
            <Label position={[x, 0.05, ROW_Z + 0.45]} variant="small">
              {short(s.name, 12)}
            </Label>
            <Label position={[x, 0.05, BLOCK_Z]} variant="small">
              {s.block}
            </Label>
          </group>
        );
      })}
      {c.step === ORDER ? <Anchor name="blocks" position={[COLUMNS[1], 0.5, ROW_Z]} /> : null}
      {c.step === FAIL ? <Anchor name="slip" position={[COLUMNS[2], 0.6, ROW_Z]} /> : null}
    </group>
  );
}

/** Step 4: the contracts' gas as a flat bar, 70% burned (grey) and 30% to the contracts (accent). */
function Meter({ c }: { c: CallState }) {
  const paper = useInk(COLORS.paper);
  const burn = useInk(COLORS.slab);
  const rebate = useInk(ACCENT);
  const [cx, , cz] = METER.center;
  const len = METER.length;
  const g = c.call ? gasSplit(c.call) : null;
  return (
    <group position={[cx, 0, cz]}>
      <Pickable label="Gas meter: inspect the gas rebate" onPick={c.pickMeter} anchor={[0, 0.4, 0]}>
        {g ? (
          <>
            <mesh position={[-len / 2 + (len * 0.7) / 2, 0.08, 0]} material={burn}>
              <boxGeometry args={[len * 0.7, 0.16, METER.depth]} />
              <Outline />
            </mesh>
            <mesh position={[len / 2 - (len * 0.3) / 2, 0.08, 0]} material={rebate}>
              <boxGeometry args={[len * 0.3, 0.16, METER.depth]} />
              <Outline />
            </mesh>
          </>
        ) : (
          <mesh position={[0, 0.06, 0]} material={paper}>
            <boxGeometry args={[len, 0.12, METER.depth]} />
            <Outline />
          </mesh>
        )}
      </Pickable>
      {g ? (
        <>
          <Label position={[-len / 2 + 1.4, 0.3, -0.45]} variant="small">
            {`about 70% burned: ${formatTgas(g.burned)} Tgas`}
          </Label>
          <Label position={[len / 2 - 1.4, 0.3, 0.5]} variant="small">
            {`about 30% to contracts: ${formatTgas(g.rebate)} Tgas`}
          </Label>
        </>
      ) : null}
      <Anchor name="meter" position={[-len / 2 + 0.4, 0.3, 0]} />
    </group>
  );
}
