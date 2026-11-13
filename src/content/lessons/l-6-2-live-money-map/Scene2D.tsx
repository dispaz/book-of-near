/**
 * Lesson 6.2, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout.ts): the oracle booth, the NEAR Intents area, the Rhea Lend ledger, the USDC mailbox and the two
 * Rhea pools. Every object is a pick, as in 3D. Only draws the shared state from useMoneyMap.
 */
import type { SceneProps } from "../../../app/types";
import { SvgLabel, SvgPickable } from "../../../scene-kit/svg";
import { SvgChainArea, SvgLedger, SvgMailbox, SvgRpcWindow } from "../../../scene-kit/svg/objects";
import { COLORS, INK } from "../../../scene-kit/theme";
import stage from "../../stages/6-citizen/stage";
import { describe, fmt, ORACLE_READ, PICK_LABELS, QUOTES, SUPPLY, USDCE_LABEL, type Obj } from "./money";
import { FIGURE, INTENTS_AT, LEND_AT, ORACLE_AT, POOL_R, SIMPLE_AT, STABLE_AT, USDC_AT } from "./layout";
import { Facts } from "./parts";
import { CHECK, DOLLARS, FLOWS, MAP, ORACLE, SWAP } from "./steps";
import type { MoneyMap } from "./useMoneyMap";

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
  m: MoneyMap;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (m.step >= CHECK) return null;
  return (
    <div
      className={`money${reducedMotion ? " still" : ""}`}
      data-testid="money-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="money-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(m)}>
          <Page m={m} />
        </svg>
      </div>
      <Facts m={m} notes />
    </div>
  );
}

function Page({ m }: { m: MoneyMap }) {
  const { step } = m;
  const sel = m.isPicked;
  // A "not yet" pick shakes the object. Two class names in turn, so a second click shakes it again.
  const shake = (o: Obj) => (m.notYet(o) ? ` money-shake${(m.picked?.n ?? 0) % 2}` : "");
  const ia = INTENTS_AT;
  return (
    <g>
      {/* ---------- the NEAR Intents area (back middle) ---------- */}
      <g
        className={shake("intents")}
        data-explain={step === FLOWS ? "intents" : step === MAP ? "map" : undefined}
      >
        <SvgChainArea
          x={px(ia.x - ia.width / 2)}
          y={pz(ia.z - ia.depth / 2)}
          width={ia.width * SCALE}
          height={ia.depth * SCALE}
          name="NEAR Intents"
          color={step === FLOWS ? ACCENT : COLORS.chain}
          blocks={3}
          blockSize={38}
          onPick={() => m.pick("intents")}
          pickLabel={PICK_LABELS.intents}
          selected={sel("intents")}
        />
      </g>
      {m.flows ? <Flows /> : null}

      {/* ---------- the oracle booth (back left) ---------- */}
      <g className={shake("oracle")} data-explain={step === ORACLE ? "oracle" : undefined}>
        <SvgRpcWindow
          x={px(ORACLE_AT[0])}
          y={pz(ORACLE_AT[2]) + 40}
          size={78}
          name="oracle"
          note={m.oracleRead ? `${ORACLE_READ.stored}, Aug` : "Pyth"}
          color={step === ORACLE ? ACCENT : COLORS.blue}
          lit={m.oracleRead}
          onPick={() => m.pick("oracle")}
          pickLabel={PICK_LABELS.oracle}
          selected={sel("oracle")}
        />
      </g>

      {/* ---------- Rhea Lend (back right) ---------- */}
      <g className={shake("lend")}>
        <SvgLedger
          x={px(LEND_AT[0])}
          y={pz(LEND_AT[2]) + 30}
          size={44}
          pages={3}
          name="Rhea Lend"
          edge={step === MAP ? ACCENT : COLORS.slab}
          onPick={() => m.pick("lend")}
          pickLabel={PICK_LABELS.lend}
          selected={sel("lend")}
        />
      </g>

      {/* ---------- the USDC mailbox (front left) ---------- */}
      <g className={shake("usdc")} data-explain={step === DOLLARS ? "usdc" : undefined}>
        <SvgMailbox
          x={px(USDC_AT[0])}
          y={pz(USDC_AT[2]) + 40}
          size={86}
          name="USDC"
          note={m.compared ? SUPPLY.usdc.short : "Circle"}
          color={step === DOLLARS ? ACCENT : COLORS.paper}
          flag={m.compared}
          onPick={() => m.pick("usdc")}
          pickLabel={PICK_LABELS.usdc}
          selected={sel("usdc")}
        />
      </g>
      {m.compared ? (
        <SvgLabel x={px(USDC_AT[0])} y={pz(USDC_AT[2]) + 62} variant="small">
          {USDCE_LABEL}
        </SvgLabel>
      ) : null}

      {/* ---------- the two pools (front) ---------- */}
      <g data-explain={step === SWAP ? "pools" : undefined}>
        <g className={shake("stable")}>
          <SvgPool m={m} which="stable" />
        </g>
        <g className={shake("simple")}>
          <SvgPool m={m} which="simple" />
        </g>
      </g>
    </g>
  );
}

/** A pool basin seen from above: two tokens' water, side by side. After a trade, its output under it. */
function SvgPool({ m, which }: { m: MoneyMap; which: "stable" | "simple" }) {
  const at = which === "stable" ? STABLE_AT : SIMPLE_AT;
  const x = px(at[0]);
  const y = pz(at[2]);
  const r = POOL_R * SCALE;
  const lit = m.step === SWAP;
  const out = m.trade
    ? which === "stable"
      ? `${fmt(QUOTES[m.trade].stableOut, 2)} USDt`
      : `${fmt(QUOTES[m.trade].simpleOut, 2)} NEAR`
    : null;
  return (
    <SvgPickable
      label={PICK_LABELS[which]}
      selected={m.isPicked(which)}
      onPick={() => m.pick(which)}
      focus={[x - r - 10, y - r * 0.6 - 34, 2 * r + 20, r * 1.2 + 64]}
    >
      <ellipse cx={x + 4} cy={y + 4} rx={r} ry={r * 0.6} fill={INK} opacity={0.12} />
      <ellipse
        cx={x}
        cy={y}
        rx={r}
        ry={r * 0.6}
        fill={COLORS.paper}
        stroke={lit ? ACCENT : INK}
        strokeWidth={lit ? 4 : 2.5}
      />
      <path
        d={`M${x},${y - r * 0.5} A${r * 0.85},${r * 0.5} 0 0 0 ${x},${y + r * 0.5} Z`}
        fill={COLORS.blue}
        opacity={0.55}
      />
      <path
        d={`M${x},${y - r * 0.5} A${r * 0.85},${r * 0.5} 0 0 1 ${x},${y + r * 0.5} Z`}
        fill={which === "stable" ? COLORS.green : COLORS.near}
        opacity={0.55}
      />
      <SvgLabel x={x} y={y - r * 0.6 - 10}>
        {which === "stable" ? "stable pool" : "simple pool"}
      </SvgLabel>
      <SvgLabel x={x} y={y + r * 0.6 + 18} variant="small">
        {which === "stable" ? "USDC | USDt" : "USDC | NEAR"}
      </SvgLabel>
      {out ? (
        <SvgLabel x={x} y={y + r * 0.6 + 34} variant="small">
          {`→ ${out}`}
        </SvgLabel>
      ) : null}
    </SvgPickable>
  );
}

/** The intent flows: arrows from the NEAR Intents area to the pools and the mailbox. */
function Flows() {
  const from = { x: px(INTENTS_AT.x), y: pz(INTENTS_AT.z + INTENTS_AT.depth / 2) };
  const to = [STABLE_AT, SIMPLE_AT, USDC_AT].map((a) => ({ x: px(a[0]), y: pz(a[2]) - 50 }));
  return (
    <g aria-hidden="true" data-testid="flows">
      {to.map((t, i) => (
        <path
          key={i}
          className="money-flow"
          d={`M${from.x},${from.y} Q${(from.x + t.x) / 2},${from.y + 10} ${t.x},${t.y}`}
          fill="none"
          stroke={ACCENT}
          strokeWidth={4}
          strokeDasharray="10 8"
          markerEnd="url(#money-arrow)"
        />
      ))}
      <defs>
        <marker
          id="money-arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={INK} />
        </marker>
      </defs>
    </g>
  );
}
