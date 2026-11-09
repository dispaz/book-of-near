/**
 * Lesson 2.1 in 3D: a pop-up book scene (docs/book-scene.md). The figure stands on the right page:
 * at the start the learner's mailbox and the transaction's parcel; then one ribbon per shard, a chunk
 * cell per shard per block (time running left to right), the signer's mailbox in its shard's row, and
 * a receipt slip per hop that hops along arcs as the learner follows the path. It only draws the shared
 * state from useShardTrace. Loaded lazily from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useRef } from "react";
import { Line } from "@react-three/drei";
import {
  Anchor,
  arcPoint,
  BookScene,
  COLORS,
  INK,
  inset,
  focusOf,
  Label,
  Mailbox,
  Outline,
  Parcel,
  ReceiptSlip,
  ShardRibbon,
  spreadBeside,
  spreadFor,
  textBlock,
  Traveller,
  useFreeFrame,
  useInk,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import { cellAt, FIGURE, gridOf, hopAt, MAILBOX_HOME, mailboxAt, PARCEL_HOME, slots } from "./layout3d";
import { ACCENT, cellKey, describe, pageModel, shortName } from "./page";
import { Facts, hopLabel } from "./parts";
import { CHECK, PICK, START, TIME } from "./steps";
import { tourFor, type Target } from "./tour";
import type { Trace } from "./trace";
import type { ShardTrace } from "./useShardTrace";

const SPREAD = { print: spreadBeside(FIGURE), docked: spreadFor(FIGURE) };
/** Where the step's words are printed on the left page. */
const TEXT = textBlock(SPREAD.print);
/** Running heads, only when the words are docked (the printed step heads the page otherwise). */
const HEADS: [string, string] = ["Stage 2", "Follow your transaction across shards"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  Your account and the transaction it sent",
  "Fig. 2  Shards as ribbons, blocks as columns",
  "Fig. 3  Where the transaction started",
  "Fig. 4  The receipts, hop by hop",
  "Fig. 5  Where the time went",
  "Fig. 6  Shards, chunks and receipts",
];

/** What the camera keeps in view at a step. */
function focusFor(step: number): Focus {
  if (step === PICK) return focusOf([[-3.2, 3.2, -0.7, 1.9, 2.6]], 34);
  return focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 1.4]], 56, 0, 0.2);
}

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target, base: Focus, trace: Trace | null): Focus {
  const close = (center: Vec3, width: number, depth: number, height = 1.2): Focus => ({
    center,
    width,
    depth,
    height,
    elevation: 28,
    azimuth: -14,
  });
  if (t.kind === "all" || !trace) {
    if (t.kind === "mailbox") return close([MAILBOX_HOME[0], 0.8, MAILBOX_HOME[2]], 2.2, 2.2, 2);
    if (t.kind === "parcel") return close([PARCEL_HOME[0], 0.5, PARCEL_HOME[2]], 2, 2, 1.6);
    return { ...base, elevation: 40, azimuth: -14 };
  }
  const g = gridOf(trace);
  switch (t.kind) {
    case "mailbox": {
      const m = mailboxAt(trace);
      return close([m[0] + 0.6, 0.5, m[2]], 2.6, 2, 1.4);
    }
    case "parcel":
      return close([PARCEL_HOME[0], 0.5, PARCEL_HOME[2]], 2, 2, 1.6);
    case "hop": {
      const h = trace.hops[t.index]!;
      const p = hopAt(trace, h, slots(trace)[t.index]!);
      return close([p[0], 0.3, p[2]], 2.4, 1.8, 0.9);
    }
    case "row": {
      const z = cellAt(trace, t.shardId, trace.firstBlock)[2];
      return { ...close([(g.minX + g.maxX) / 2, 0.1, z], g.maxX - g.minX, 1.4, 0.5), elevation: 34 };
    }
    case "column": {
      const x = cellAt(trace, trace.shardIds[0]!, t.height)[0];
      return { ...close([x, 0.1, (g.minZ + g.maxZ) / 2], 1.8, g.maxZ - g.minZ, 0.5), elevation: 48 };
    }
  }
}

/** The 3D view: the same state as the 2D view, on an open pop-up book. */
export default function Scene3D({
  st,
  reducedMotion,
  flat,
  mode,
}: {
  st: ShardTrace;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step, trace } = st;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  // Steps after the quiz stay on the quiz's sheet.
  const sheet = Math.min(step, CHECK);
  const focus = focusFor(step);
  const hop = st.hop;
  return (
    <div
      ref={root}
      className={`book-scene shs-book${summary ? " summary" : ""}`}
      data-testid="shard-scene"
      data-scene-state={st.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Your transaction across shards, in 3D"
    >
      <BookScene
        page={step}
        sheet={sheet}
        spread={print ? SPREAD.print : SPREAD.docked}
        heads={print ? undefined : HEADS}
        caption={FIGURES[sheet]}
        text={print ? TEXT : null}
        focus={focus}
        frame={inset(frame, { top: 20, bottom: 16 })}
        size={size}
        shots={tourFor(step, trace, st.at)}
        shotFocus={(t: Target) => shotFocus(t, focus, trace)}
        flat={flat}
        reducedMotion={reducedMotion}
        state={st.state}
        description={summary ? "The book is open at the shard page." : describe(st)}
        status={
          st.drawn >= 0 && hop && trace
            ? `step ${st.at + 1} of ${trace.hops.length}: shard ${hop.shardId}`
            : undefined
        }
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : step === PICK || !trace ? (
          <Desk st={st} />
        ) : (
          <Page st={st} trace={trace} compact={!print} />
        )}
      </BookScene>
      {/* The facts both views show (HTML), over the right page. */}
      <div className="book-scene-panel shs-panel" ref={panel} data-testid="shard-3d">
        {summary ? null : <Facts st={st} compact />}
      </div>
    </div>
  );
}

/** Step 1: the learner's mailbox and the parcel (the transaction) that already arrived. */
function Desk({ st }: { st: ShardTrace }) {
  return (
    <group>
      <Mailbox
        position={MAILBOX_HOME}
        size={1.8}
        name={shortName(st.trace?.signerId ?? "your account")}
        color={ACCENT}
        flag={!!st.trace}
        onPick={() => st.choose("mine")}
        pickLabel="Mailbox: choose my 0.3 transaction"
        selected={st.choice === "mine"}
      />
      <Anchor name="mailbox" position={[MAILBOX_HOME[0], 1.2, MAILBOX_HOME[2]]} />
      <Parcel
        position={PARCEL_HOME}
        size={1.3}
        stamped
        name="transaction"
        onPick={() => void st.load()}
        pickLabel="Parcel: load the transaction path"
        selected={!!st.trace}
      />
    </group>
  );
}

/** One chunk: a thin paper cell on its shard's ribbon. Lit (accent) when the path passes through it. */
function Cell({ position, size, lit }: { position: Vec3; size: [number, number]; lit: boolean }) {
  const ink = useInk(lit ? ACCENT : COLORS.paper);
  return (
    <mesh position={[position[0], 0.05, position[2]]} material={ink}>
      <boxGeometry args={[size[0], 0.04, size[1]]} />
      <Outline />
    </mesh>
  );
}

/** Steps 2 to 5: ribbons carrying their chunk cells, the signer's mailbox and the receipt slips. */
function Page({ st, trace, compact }: { st: ShardTrace; trace: Trace; compact: boolean }) {
  const { step, drawn } = st;
  // The labels are HTML at a fixed size: on a small book (phones, tablets) they keep to short forms.
  const shardName = (s: number) => (compact ? String(s) : `shard ${s}`);
  const blockName = (h: number) => (compact ? `…${String(h).slice(-2)}` : `#…${String(h).slice(-4)}`);
  const g = gridOf(trace);
  const model = pageModel(trace, st);
  const { pos } = model;
  const shown = trace.hops.slice(0, model.count);
  const ribbonX = (g.minX + g.maxX) / 2;
  const m = mailboxAt(trace);
  const firstShard = trace.hops[0]!.shardId;
  const slip = Math.min(1, g.col * 0.78);
  const cur = pos[Math.min(Math.max(st.at, 0), pos.length - 1)]!;
  const fateOf = (i: number) => (model.isNewest(i) ? ("idle" as const) : ("done" as const));
  return (
    <group>
      <Anchor name="grid" position={[g.minX + 0.4, 0.3, g.minZ + 0.3]} />
      {trace.shardIds.map((s) => {
        const z = cellAt(trace, s, trace.firstBlock)[2];
        return (
          <ShardRibbon
            key={s}
            position={[ribbonX, 0.01, z]}
            length={g.maxX - g.minX}
            width={g.row * 0.86}
            name={shardName(s)}
            color={model.ribbonColor(s)}
            onPick={() => st.pickShard(s)}
            pickLabel={`Shard ${s}`}
            selected={st.shard === s}
          >
            {/* The row's chunks lie on the ribbon (local to its middle), so picking one picks the shard. */}
            {Array.from({ length: g.n }, (_, c) => {
              const [x] = cellAt(trace, s, trace.firstBlock + c);
              return (
                <Cell
                  key={c}
                  position={[x - ribbonX, 0, 0]}
                  size={g.cell}
                  lit={model.lit.has(cellKey(s, trace.firstBlock + c))}
                />
              );
            })}
          </ShardRibbon>
        );
      })}
      {Array.from({ length: g.n }, (_, c) => {
        const [x] = cellAt(trace, trace.shardIds[0]!, trace.firstBlock + c);
        return (
          <Label key={c} position={[x, 0.05, g.maxZ - 0.2]} variant="small">
            {blockName(trace.firstBlock + c)}
          </Label>
        );
      })}
      <Mailbox
        position={m}
        size={0.95}
        name="signer"
        color={step >= START ? ACCENT : COLORS.slab}
        flag={step >= START}
        onPick={() => (step >= START ? st.pick(0) : st.pickShard(firstShard))}
        pickLabel={`Signer's mailbox: ${trace.signerId}, on shard ${firstShard}`}
      />

      {/* The path: an arc from each slip to the next, as far as the learner has come. */}
      {pos.slice(1, drawn + 1).map((p, i) => {
        const a = pos[i]!;
        const lift = 0.5 + Math.abs(p[2] - a[2]) * 0.25;
        const pts = Array.from({ length: 17 }, (_, k) => arcPoint(a, p, lift, k / 16)).map(
          ([x, y, z]) => [x, y + 0.2, z] as Vec3,
        );
        return (
          <Line
            key={i}
            points={pts}
            color={INK}
            lineWidth={2}
            dashed={trace.hops[i + 1]!.kind === "refund"}
            dashSize={0.12}
            gapSize={0.08}
          />
        );
      })}

      {/* Every drawn slip but the one being looked at stands still; that one travels. */}
      {shown.map((h, i) =>
        i === st.at ? null : (
          <ReceiptSlip
            key={h.id}
            position={pos[i]!}
            size={slip}
            color={ACCENT}
            refund={h.kind === "refund"}
            fate={fateOf(i)}
            label={String(i + 1)}
            onPick={() => st.pick(i)}
            pickLabel={hopLabel(h)}
          />
        ),
      )}
      {drawn >= 0 ? (
        <Traveller to={cur} arc={1.2} duration={0.8} color={ACCENT}>
          <ReceiptSlip
            size={slip * 1.1}
            color={ACCENT}
            refund={trace.hops[st.at]!.kind === "refund"}
            fate={fateOf(st.at)}
            label={String(st.at + 1)}
            selected
            onPick={() => st.pick(st.at)}
            pickLabel={hopLabel(trace.hops[st.at]!)}
          />
          <Anchor name="hop" position={[0, 0.6, 0]} />
        </Traveller>
      ) : null}
      {step === TIME ? <Anchor name="time" position={[pos[st.last]![0], 0.6, pos[st.last]![2]]} /> : null}
    </group>
  );
}
