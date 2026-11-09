/**
 * Lesson 2.1, flat view: the same page as the 3D book scene, drawn from above in SVG with the same
 * layout (layout3d.ts), the same page model (page.ts) and the same scene objects: the signer's mailbox,
 * a ribbon per shard carrying its chunk cells, and a receipt slip per hop. Every object is a pick, as in
 * 3D. Only draws the shared state from useShardTrace.
 */
import type { SceneProps } from "../../../app/types";
import { SvgMailbox, SvgParcel, SvgReceiptSlip, SvgShardRibbon } from "../../../scene-kit/svg/objects";
import { cellAt, FIGURE, gridOf, MAILBOX_HOME, mailboxAt, PARCEL_HOME } from "./layout3d";
import { ACCENT, cellKey, describe, pageModel, shortName } from "./page";
import { Facts, hopLabel } from "./parts";
import { CHECK, FOLLOW, GRID, PICK, START, TIME } from "./steps";
import type { Trace } from "./trace";
import type { ShardTrace } from "./useShardTrace";

/** SVG units per world unit. */
const SCALE = 66;
const PAD_TOP = 34;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE + PAD_TOP;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE + PAD_TOP;

export default function Scene2D({
  st,
  reducedMotion,
  mode,
}: {
  st: ShardTrace;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  const { step, trace } = st;
  if (step >= CHECK) return null;
  return (
    <div
      className={`shs${reducedMotion ? " still" : ""}`}
      data-testid="shard-scene"
      data-scene-state={st.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="shs-2d" data-testid="shard-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(st)}>
          {step === PICK || !trace ? <Desk st={st} /> : <Page st={st} trace={trace} />}
        </svg>
      </div>
      <Facts st={st} />
    </div>
  );
}

/** Step 1: the mailbox and the parcel, before the path is open. */
function Desk({ st }: { st: ShardTrace }) {
  return (
    <g>
      <g data-explain="mailbox">
        <SvgMailbox
          x={px(MAILBOX_HOME[0])}
          y={pz(MAILBOX_HOME[2]) + 40}
          size={130}
          name={shortName(st.trace?.signerId ?? "your account")}
          color={ACCENT}
          flag={!!st.trace}
          onPick={() => st.choose("mine")}
          pickLabel="Mailbox: choose my 0.3 transaction"
          selected={st.choice === "mine"}
        />
      </g>
      <SvgParcel
        x={px(PARCEL_HOME[0])}
        y={pz(PARCEL_HOME[2]) + 40}
        size={110}
        stamped
        name="transaction"
        onPick={() => void st.load()}
        pickLabel="Parcel: load the transaction path"
        selected={!!st.trace}
      />
    </g>
  );
}

/** Steps 2 to 5: the ribbons with their chunk cells, the mailbox and the slips. */
function Page({ st, trace }: { st: ShardTrace; trace: Trace }) {
  const { step } = st;
  const g = gridOf(trace);
  const m = pageModel(trace, st);
  const ribbonX = (g.minX + g.maxX) / 2;
  const [cw, cd] = g.cell;
  const signer = mailboxAt(trace);
  const firstShard = trace.hops[0]!.shardId;
  return (
    <g>
      <g data-explain={step === GRID ? "grid" : undefined}>
        {trace.shardIds.map((s) => {
          const z = cellAt(trace, s, trace.firstBlock)[2];
          return (
            <SvgShardRibbon
              key={s}
              x={px(ribbonX)}
              y={pz(z)}
              length={(g.maxX - g.minX) * SCALE}
              width={g.row * SCALE * 0.86}
              name={`shard ${s}`}
              color={m.ribbonColor(s)}
              onPick={() => st.pickShard(s)}
              pickLabel={`Shard ${s}`}
              selected={st.shard === s}
            >
              {Array.from({ length: g.n }, (_, c) => {
                const [x] = cellAt(trace, s, trace.firstBlock + c);
                return (
                  <rect
                    key={c}
                    x={px(x - cw / 2)}
                    y={pz(z - cd / 2)}
                    width={cw * SCALE}
                    height={cd * SCALE}
                    rx={3}
                    className={`shs-cell${m.lit.has(cellKey(s, trace.firstBlock + c)) ? " lit" : ""}`}
                  />
                );
              })}
            </SvgShardRibbon>
          );
        })}
        {Array.from({ length: g.n }, (_, c) => {
          const [x] = cellAt(trace, trace.shardIds[0]!, trace.firstBlock + c);
          return (
            <text key={c} x={px(x)} y={pz(g.maxZ) - 6} textAnchor="middle" className="shs-svg-label">
              {`#…${String(trace.firstBlock + c).slice(-4)}`}
            </text>
          );
        })}
      </g>
      <SvgMailbox
        x={px(signer[0])}
        y={pz(signer[2]) + 14}
        size={54}
        name="signer"
        color={step >= START ? ACCENT : undefined}
        state={step >= START ? "ok" : "pending"}
        onPick={() => (step >= START ? st.pick(0) : st.pickShard(firstShard))}
        pickLabel={`Signer's mailbox: ${trace.signerId}, on shard ${firstShard}`}
      />
      {/* The path: an arc from each slip to the next, drawn as far as the learner has come. */}
      {m.pos.slice(1, m.count).map((p, i) => {
        const a = m.pos[i]!;
        const [x1, y1, x2, y2] = [px(a[0]), pz(a[2]), px(p[0]), pz(p[2])];
        const lift = Math.min(60, 18 + Math.abs(y2 - y1) * 0.3);
        return (
          <path
            key={i}
            className={`shs-path${trace.hops[i + 1]!.kind === "refund" ? " refund" : ""}`}
            d={`M${x1},${y1} Q${(x1 + x2) / 2},${Math.min(y1, y2) - lift} ${x2},${y2}`}
            fill="none"
          />
        );
      })}
      {trace.hops.slice(0, m.count).map((h, i) => {
        const note =
          i === st.at && (step === START || step === FOLLOW)
            ? "hop"
            : step === TIME && i === st.last
              ? "time"
              : undefined;
        return (
          <g key={h.id} data-explain={note}>
            <SvgReceiptSlip
              x={px(m.pos[i]![0])}
              y={pz(m.pos[i]![2]) + 8}
              size={Math.min(52, g.col * SCALE * 0.7)}
              color={ACCENT}
              refund={h.kind === "refund"}
              fate={m.isNewest(i) ? "idle" : "done"}
              label={String(i + 1)}
              selected={i === st.at}
              onPick={() => st.pick(i)}
              pickLabel={hopLabel(h)}
            />
          </g>
        );
      })}
    </g>
  );
}
