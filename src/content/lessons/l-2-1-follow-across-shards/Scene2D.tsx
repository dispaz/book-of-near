/**
 * Lesson 2.1, flat view: the same page as the 3D book scene, drawn from above in SVG with the same
 * layout (layout3d.ts) and the same scene objects: the signer's mailbox, a ribbon per shard, a chunk
 * cell per shard per block, and a receipt slip per hop. Only draws the shared state from useShardTrace.
 */
import type { SceneProps } from "../../../app/types";
import { COLORS } from "../../../scene-kit/theme";
import { SvgMailbox, SvgParcel, SvgReceiptSlip, SvgShardRibbon } from "../../../scene-kit/svg/objects";
import { FIGURE, gridOf, hopAt, MAILBOX_HOME, mailboxAt, PARCEL_HOME, cellAt, slots } from "./layout3d";
import { Facts, hopLabel } from "./parts";
import type { Trace } from "./trace";
import { FOLLOW, GRID, PICK, START, TIME, type ShardTrace } from "./useShardTrace";

/** SVG units per world unit. */
const S = 66;
const PAD_TOP = 34;
const W = (FIGURE.maxX - FIGURE.minX) * S;
const H = (FIGURE.maxZ - FIGURE.minZ) * S + PAD_TOP;
const px = (x: number) => (x - FIGURE.minX) * S;
const pz = (z: number) => (z - FIGURE.minZ) * S + PAD_TOP;

export const ACCENT = COLORS.pink;
/** A light tint of the accent: shards the path has touched. */
export const TOUCHED = "#ffc4dc";

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
  const summary = step >= 5;
  if (summary) return null;
  return (
    <div
      className={`shs${reducedMotion ? " still" : ""}`}
      data-testid="shard-scene"
      data-scene-state={st.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="shs-2d" data-testid="shard-2d">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(st)}>
          {step === PICK || !trace ? <Desk st={st} /> : <Page st={st} trace={trace} />}
        </svg>
      </div>
      <Facts st={st} />
    </div>
  );
}

/** One sentence on what the drawing shows (also the 3D description). */
export function describe(st: ShardTrace): string {
  const { trace, step, drawn } = st;
  if (step === PICK || !trace)
    return trace
      ? "Your account's mailbox and the transaction's parcel. Its path is loaded."
      : "Your account's mailbox and a parcel: the transaction to open. No path is loaded yet.";
  const base = `${trace.shardIds.length} shard ribbons by ${trace.lastBlock - trace.firstBlock + 1} blocks, one chunk per shard per block.`;
  if (drawn < 0) return `${base} No path is drawn yet.`;
  const hop = st.hop!;
  return `${base} ${drawn + 1} of ${trace.hops.length} receipt slips drawn. Looking at step ${st.at + 1}: shard ${hop.shardId}, block ${hop.blockHeight}.`;
}

/** Step 1: the mailbox and the parcel, before the path is open. */
function Desk({ st }: { st: ShardTrace }) {
  const signer = st.trace?.signerId ?? "your account";
  return (
    <g>
      <g data-explain="mailbox">
        <SvgMailbox
          x={px(MAILBOX_HOME[0])}
          y={pz(MAILBOX_HOME[2]) + 40}
          size={130}
          name={short(signer)}
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

const short = (id: string) => (id.length > 24 ? `${id.slice(0, 21)}…` : id);

/** Steps 2 to 5: the ribbons, the chunk cells, the mailbox and the slips. */
function Page({ st, trace }: { st: ShardTrace; trace: Trace }) {
  const { step, drawn } = st;
  const g = gridOf(trace);
  const sl = slots(trace);
  const pos = trace.hops.map((h, i) => hopAt(trace, h, sl[i]!));
  const touched = new Set(trace.hops.slice(0, Math.max(0, drawn + 1)).map((h) => h.shardId));
  const lit = new Set(
    trace.hops.slice(0, Math.max(0, drawn + 1)).map((h) => `${h.shardId}:${h.blockHeight}`),
  );
  const ribbonX = (g.minX + g.maxX) / 2;
  const ribbonL = g.maxX - g.minX;
  const [cw, cd] = g.cell;
  const m = mailboxAt(trace);
  const signerLit = step >= START;
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
              length={ribbonL * S}
              width={g.row * S * 0.86}
              name={`shard ${s}`}
              color={st.shard === s ? ACCENT : touched.has(s) ? TOUCHED : COLORS.slab}
              onPick={step === GRID ? () => st.pickShard(s) : undefined}
              pickLabel={`Shard ${s}`}
              selected={st.shard === s}
            />
          );
        })}
        {trace.shardIds.map((s) =>
          Array.from({ length: g.n }, (_, c) => {
            const [x, , z] = cellAt(trace, s, trace.firstBlock + c);
            const on = lit.has(`${s}:${trace.firstBlock + c}`);
            return (
              <rect
                key={`${s}:${c}`}
                x={px(x - cw / 2)}
                y={pz(z - cd / 2)}
                width={cw * S}
                height={cd * S}
                rx={3}
                className={`shs-cell${on ? " lit" : ""}`}
              />
            );
          }),
        )}
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
        x={px(m[0])}
        y={pz(m[2]) + 14}
        size={54}
        name="signer"
        color={signerLit ? ACCENT : COLORS.slab}
      />
      {/* The path: an arc from each slip to the next, drawn as far as the learner has come. */}
      {pos.slice(1, drawn + 1).map((p, i) => {
        const a = pos[i]!;
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
      <g>
        {trace.hops.slice(0, Math.max(0, drawn + 1)).map((h, i) => {
          const newest = step === FOLLOW && i === st.reached && st.reached < st.last;
          const note =
            i === st.at && (step === START || step === FOLLOW)
              ? "hop"
              : step === TIME && i === st.last
                ? "time"
                : undefined;
          return (
            <g key={h.id} data-explain={note}>
              <SvgReceiptSlip
                x={px(pos[i]![0])}
                y={pz(pos[i]![2]) + 8}
                size={Math.min(52, g.col * S * 0.7)}
                color={ACCENT}
                refund={h.kind === "refund"}
                fate={newest ? "idle" : "done"}
                label={String(i + 1)}
                selected={i === st.at}
                onPick={() => st.pick(i)}
                pickLabel={hopLabel(h)}
              />
            </g>
          );
        })}
      </g>
    </g>
  );
}
