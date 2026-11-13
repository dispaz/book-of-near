/**
 * Lesson 6.1, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout.ts). The staking pool's mailbox, the veNEAR gauge, the proposal scroll with its quorum bar and
 * the two ballot stamps. Every object is a pick, as in 3D. Only draws the shared state from useGovernance.
 */
import type { SceneProps } from "../../../app/types";
import { SvgLabel, SvgPickable } from "../../../scene-kit/svg";
import { SvgMailbox, SvgScroll } from "../../../scene-kit/svg/objects";
import { COLORS, INK } from "../../../scene-kit/theme";
import stage from "../../stages/6-citizen/stage";
import {
  describe,
  extraVe,
  fmt,
  LOCKED,
  MAX_VE,
  PICK_LABELS,
  stampColors,
  tally,
  vePower,
  type Choice,
  type Obj,
} from "./governance";
import { FIGURE, GAUGE, GAUGE_TICKS, POOL, QUORUM, SCROLL, STAMPS } from "./layout";
import { Facts } from "./parts";
import { CHECK, HALL, INSPECT, LOCK, STAKE, VOTE } from "./steps";
import type { Governance } from "./useGovernance";

const ACCENT = stage.accent;
/** SVG units per world unit. */
const SCALE = 64;
const PAD_TOP = 40;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE + PAD_TOP;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE + PAD_TOP;

export default function Scene2D({
  m,
  reducedMotion,
  mode,
}: {
  m: Governance;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (m.step >= CHECK) return null;
  return (
    <div
      className={`gov${reducedMotion ? " still" : ""}`}
      data-testid="gov-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="gov-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(m)}>
          <Page m={m} />
        </svg>
      </div>
      <Facts m={m} notes />
    </div>
  );
}

function Page({ m }: { m: Governance }) {
  const { step } = m;
  const sel = m.isPicked;
  // A "not yet" pick shakes the object. Two class names in turn, so a second click shakes it again.
  const shake = (o: Obj) => (m.notYet(o) ? ` gov-shake${(m.picked?.n ?? 0) % 2}` : "");
  const lit = (on: boolean) => (on ? ACCENT : undefined);
  return (
    <g>
      {/* ---------- the staking pool ---------- */}
      <g className={shake("pool")} data-explain={step === STAKE ? "pool" : undefined}>
        <SvgMailbox
          x={px(POOL[0])}
          y={pz(POOL[2]) + 40}
          size={92}
          name="staking pool"
          note="50 NEAR"
          color={lit(step === STAKE) ?? COLORS.paper}
          flag={step >= STAKE}
          onPick={() => m.pick("pool")}
          pickLabel={PICK_LABELS.pool}
          selected={sel("pool")}
        />
      </g>

      {/* ---------- the veNEAR gauge ---------- */}
      <g className={shake("gauge")} data-explain={step === LOCK ? "gauge" : undefined}>
        <SvgGauge m={m} />
      </g>

      {/* ---------- the proposal and its quorum bar ---------- */}
      <g
        className={shake("scroll")}
        data-explain={step === INSPECT ? "scroll" : step === HALL ? "hall" : undefined}
      >
        <SvgScroll
          x={px(SCROLL[0])}
          y={pz(SCROLL[2]) + 40}
          size={84}
          name="Proposal #42"
          note={m.reviewed ? "read" : "example"}
          color={lit(step === INSPECT) ?? COLORS.contract}
          onPick={() => m.pick("scroll")}
          pickLabel={PICK_LABELS.scroll}
          selected={sel("scroll")}
        />
      </g>
      <SvgQuorum m={m} />

      {/* ---------- the ballot stamps ---------- */}
      <g data-explain={step === VOTE ? "stamps" : undefined}>
        {(["yes", "no"] as const).map((c) => (
          <g key={c} className={shake(c)}>
            <SvgBallot m={m} choice={c} />
          </g>
        ))}
      </g>
    </g>
  );
}

/**
 * The veNEAR gauge: a board with marks at 100, 200 and 300 veNEAR. The bottom block is the 100 veNEAR the
 * 100 locked NEAR gives at once; the accent column on top is the extra, grown with time locked.
 */
function SvgGauge({ m }: { m: Governance }) {
  const x = px(GAUGE[0]);
  const base = pz(GAUGE[2]) + 50;
  /** SVG units per 100 veNEAR. */
  const unit = 35;
  const h = (unit * MAX_VE) / LOCKED + 14;
  const extra = (unit * extraVe(m.months)) / LOCKED;
  const lit = m.step === LOCK || m.locked;
  return (
    <SvgPickable
      label={PICK_LABELS.gauge}
      selected={m.isPicked("gauge")}
      onPick={() => m.pick("gauge")}
      focus={[x - 44, base - h - 34, 88, h + 44]}
    >
      <rect
        x={x - 26}
        y={base - h}
        width={52}
        height={h}
        rx={6}
        fill={COLORS.paper}
        stroke={INK}
        strokeWidth={2.5}
      />
      {GAUGE_TICKS.map((k) => (
        <g key={k}>
          <line
            x1={x + 12}
            x2={x + 22}
            y1={base - (unit * k) / LOCKED}
            y2={base - (unit * k) / LOCKED}
            stroke={INK}
            strokeWidth={2}
          />
          <text x={x + 30} y={base - (unit * k) / LOCKED + 4} fontSize={11} fontFamily="var(--ui)" fill={INK}>
            {k}
          </text>
        </g>
      ))}
      {/* The 100 veNEAR for the 100 locked NEAR: there at once. */}
      <rect
        x={x - 16}
        y={base - unit}
        width={24}
        height={unit}
        fill={COLORS.slab}
        stroke={INK}
        strokeWidth={2}
      />
      {/* The extra veNEAR, grown with time locked. Gone on unlock. */}
      {extra > 0 ? (
        <rect
          className="gov-fill"
          x={x - 16}
          y={base - unit - extra}
          width={24}
          height={extra}
          fill={lit ? ACCENT : COLORS.paper}
          stroke={INK}
          strokeWidth={2}
        />
      ) : null}
      <SvgLabel x={x} y={base - h - 12}>
        {`${fmt(vePower(m.months))} veNEAR`}
      </SvgLabel>
    </SvgPickable>
  );
}

/** The quorum bar: yes (green) and no (red) votes, out of the quorum (the end mark). */
function SvgQuorum({ m }: { m: Governance }) {
  const t = tally(m.ballot);
  const x0 = px(QUORUM.x - QUORUM.length / 2);
  const len = QUORUM.length * SCALE;
  const y = pz(QUORUM.z);
  const hgt = 16;
  const yes = t.yesBar * len;
  const no = t.noBar * len;
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y} width={len} height={hgt} fill={COLORS.paper} stroke={INK} strokeWidth={2} />
      <rect className="gov-fill" x={x0} y={y} width={yes} height={hgt} fill={COLORS.green} />
      <rect className="gov-fill" x={x0 + yes} y={y} width={no} height={hgt} fill={COLORS.red} />
      <line x1={x0 + len} x2={x0 + len} y1={y - 6} y2={y + hgt + 6} stroke={INK} strokeWidth={3} />
      <SvgLabel x={x0 + len / 2} y={y - 10} variant="small">
        {`quorum ${t.quorumPct}%`}
      </SvgLabel>
    </g>
  );
}

/** A ballot stamp: a handle on a block with YES or NO on its face. Inked once it is your vote. */
function SvgBallot({ m, choice }: { m: Governance; choice: Choice }) {
  const at = STAMPS[choice];
  const x = px(at[0]);
  const y = pz(at[2]) + 26;
  const mine = m.ballot?.choice === choice;
  const { ink, tint } = stampColors(choice);
  return (
    <SvgPickable
      label={PICK_LABELS[choice]}
      selected={m.isPicked(choice)}
      onPick={() => m.pick(choice)}
      focus={[x - 42, y - 72, 84, 86]}
    >
      <circle cx={x} cy={y - 58} r={10} fill={COLORS.kraft} stroke={INK} strokeWidth={2.5} />
      <rect x={x - 6} y={y - 50} width={12} height={22} fill={COLORS.kraft} stroke={INK} strokeWidth={2.5} />
      <rect
        x={x - 32}
        y={y - 28}
        width={64}
        height={28}
        rx={4}
        fill={mine ? ink : tint}
        stroke={m.step === VOTE && !m.ballot ? ACCENT : INK}
        strokeWidth={m.step === VOTE && !m.ballot ? 4 : 2.5}
      />
      <text
        x={x}
        y={y - 8}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fontFamily="var(--ui)"
        fill={INK}
      >
        {mine ? `${choice.toUpperCase()} ✓` : choice.toUpperCase()}
      </text>
    </SvgPickable>
  );
}
