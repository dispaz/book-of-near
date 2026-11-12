/**
 * Lesson 2.2, flat view: the same page as the 3D book scene, drawn in SVG with the same layout
 * (layout3d.ts) and the same scene objects: contract A and contract B as scrolls, the action receipt,
 * the block row (a parcel for the transaction, a slip per receipt) and the gas meter. Every object is a
 * pick, as in 3D. Only draws the shared state from useCrossCall.
 */
import type { SceneProps } from "../../../app/types";
import { formatTgas } from "../../../chain/units";
import { SvgPickable } from "../../../scene-kit/svg";
import { SvgParcel, SvgReceiptSlip, SvgScroll } from "../../../scene-kit/svg/objects";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";
import { gasSplit } from "./call";
import { A, B, COLUMNS, FIGURE, METER, partsAt, ROW_Z, SLIP } from "./layout3d";
import { calleeFailed, describe, Facts, namesOf, runningOn, shardOf, short, slotsOf, tagOf } from "./parts";
import { CHECK, FAIL, HOOK, ORDER } from "./steps";
import type { CallState } from "./useCrossCall";

/** The stage accent (stage 2). */
export const ACCENT = STAGE_ACCENTS[2];

/** SVG units per world unit. */
const SCALE = 70;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE;

export default function Scene2D({
  c,
  reducedMotion,
  mode,
}: {
  c: CallState;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (c.step >= CHECK) return null;
  return (
    <div
      className={`xcc${reducedMotion ? " still" : ""}`}
      data-testid="call-scene"
      data-scene-state={c.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="xcc-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(c)}>
          <Figure c={c} />
        </svg>
      </div>
      <Facts c={c} />
    </div>
  );
}

function Figure({ c }: { c: CallState }) {
  const parts = partsAt(c.step);
  const { caller, callee } = namesOf(c);
  const running = runningOn(c);
  const ay = pz(A[2]) + 70;
  const shardA = shardOf(c.drawn ?? c.call, caller);
  const shardB = shardOf(c.drawn ?? c.call, callee);
  return (
    <g>
      <g data-explain={c.step === HOOK ? "contracts" : undefined}>
        <SvgScroll
          x={px(A[0])}
          y={ay}
          size={104}
          name={tagOf("A", caller)}
          note={shardA !== null ? `shard ${shardA}` : undefined}
          color={ACCENT}
          running={running === caller}
          pickLabel={`Scroll: contract A, ${caller}`}
          onPick={() => c.pickContract("caller")}
        />
        <SvgScroll
          x={px(B[0])}
          y={ay}
          size={104}
          name={tagOf("B", callee)}
          note={shardB !== null ? `shard ${shardB}` : undefined}
          color={ACCENT}
          state={calleeFailed(c) ? "failed" : "ok"}
          running={running === callee}
          pickLabel={`Scroll: contract B, ${callee}`}
          onPick={() => c.pickContract("callee")}
        />
      </g>
      {parts.includes("slip") ? (
        <g data-explain="slip">
          <path d={`M${px(A[0]) + 50},${ay - 50} L${px(B[0]) - 50},${ay - 50}`} className="xcc-link dashed" />
          <SvgReceiptSlip
            x={px(SLIP[0])}
            y={ay - 30}
            size={52}
            color={ACCENT}
            label="call"
            pickLabel={`Action receipt from ${caller} to ${callee}: call a method, with gas`}
            onPick={() => c.pickHop(0)}
          />
          <text x={px(SLIP[0])} y={ay + 2} textAnchor="middle" className="xcc-svg-label small">
            action receipt
          </text>
        </g>
      ) : null}
      {parts.includes("blocks") ? <Row c={c} /> : null}
      {parts.includes("meter") ? <Meter c={c} /> : null}
    </g>
  );
}

/** The block row: one column per block, time left to right. */
function Row({ c }: { c: CallState }) {
  const slots = slotsOf(c);
  const y = pz(ROW_Z) + 20;
  const by = y + 44;
  const explain = c.step === ORDER ? "blocks" : undefined;
  return (
    <g data-explain={explain}>
      <path
        d={`M${px(COLUMNS[0]) - 40},${by + 28} L${px(COLUMNS[3]) + 40},${by + 28}`}
        className="xcc-link"
      />
      <text x={px(COLUMNS[3]) + 40} y={by + 44} textAnchor="end" className="xcc-svg-label small soft">
        time →
      </text>
      {slots.map((s, i) => {
        const x = px(COLUMNS[i]!);
        return (
          <g key={i} data-explain={c.step === FAIL && i === 2 ? "slip" : undefined}>
            {i === 0 ? (
              <SvgParcel
                x={x}
                y={y}
                size={50}
                color={ACCENT}
                stamped={s.ran}
                state={s.ran ? "ok" : "pending"}
                pickLabel={s.pickLabel}
                onPick={s.onPick}
              />
            ) : (
              <SvgReceiptSlip
                x={x}
                y={y}
                size={46}
                color={ACCENT}
                state={s.ran ? (s.failed ? "failed" : "ok") : "pending"}
                fate={s.ran ? (s.failed ? "failed" : "done") : "idle"}
                label={String(i)}
                selected={s.picked}
                pickLabel={s.pickLabel}
                onPick={s.onPick}
              />
            )}
            <text x={x} y={y + 22} textAnchor="middle" className="xcc-svg-label small">
              {short(s.name, 18)}
            </text>
            <text x={x} y={by} textAnchor="middle" className="xcc-svg-label small">
              {s.block}
            </text>
            <text x={x} y={by + 17} textAnchor="middle" className="xcc-svg-label small soft">
              {s.shard}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Step 4: the contracts' gas as a bar, 70% burned (grey) and 30% to the contracts (accent). */
function Meter({ c }: { c: CallState }) {
  const w = METER.length * SCALE;
  const h = METER.depth * SCALE;
  const x = px(METER.center[0]) - w / 2;
  const y = pz(METER.center[2]) - h / 2 + 10;
  const g = c.call ? gasSplit(c.call) : null;
  return (
    <g data-explain="meter">
      <SvgPickable
        label="Gas meter: inspect the gas rebate"
        onPick={c.pickMeter}
        focus={[x - 6, y - 24, w + 12, h + 48]}
      >
        <rect x={x} y={y} width={w} height={h} rx={8} className="xcc-bar" />
        {g ? (
          <>
            <rect x={x} y={y} width={w * 0.7} height={h} rx={8} className="xcc-bar-burn" />
            <rect x={x + w * 0.7} y={y} width={w * 0.3} height={h} rx={8} className="xcc-bar-rebate" />
            <text x={x} y={y - 6} className="xcc-svg-label small">
              {`70% burned: ${formatTgas(g.burned)} Tgas`}
            </text>
            <text x={x + w} y={y - 6} textAnchor="end" className="xcc-svg-label small">
              {`30% to the contracts: ${formatTgas(g.rebate)} Tgas`}
            </text>
          </>
        ) : null}
      </SvgPickable>
    </g>
  );
}
