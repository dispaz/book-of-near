/**
 * Lesson 4.2, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout.ts) and the same scene objects. NEAR on the left (your mailbox, the verifier scroll), three
 * solvers in the middle (the winner lit), Arbitrum on the right (a marked area with your mailbox). The
 * parcel is your intent; USDC coins hop to Arbitrum when the solver fills it. Every object is a pick,
 * as in 3D. Only draws the shared state from useIntentSwap.
 */
import type { SceneProps } from "../../../app/types";
import {
  SvgChainArea,
  SvgMailbox,
  SvgParcel,
  SvgScroll,
  SvgSignerNode,
} from "../../../scene-kit/svg/objects";
import stage from "../../stages/4-any-chain/stage";
import {
  ARB_AREA,
  ARB_BLOCKS,
  COINS_AT,
  DESTINATION,
  FIGURE,
  ORIGIN,
  PARCEL_AT,
  SOLVERS,
  VERIFIER,
  WINNER,
  WINNER_INDEX,
} from "./layout";
import { Facts } from "./parts";
import { delivered, describe, fillReached, parcelSpot, PICK_LABELS } from "./swap";
import { CHECK, DECLARE, FILL, FINISH, HOOK, INSPECT, type IntentSwap } from "./useIntentSwap";

const ACCENT = stage.accent;
/** SVG units per world unit. */
const SCALE = 64;
const PAD_TOP = 64;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE + PAD_TOP;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE + PAD_TOP;

export default function Scene2D({
  m,
  reducedMotion,
  mode,
}: {
  m: IntentSwap;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (m.step >= CHECK) return null;
  const spot = parcelSpot(m.step, m.fill);
  return (
    <div
      className={`ixs${reducedMotion ? " still" : ""}`}
      data-testid="ixs-scene"
      data-scene-state={m.state}
      data-parcel={spot}
      data-view="2d"
      data-mode={mode}
    >
      <div className="ixs-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(m)}>
          <Page m={m} />
        </svg>
      </div>
      <Facts m={m} />
    </div>
  );
}

function Page({ m }: { m: IntentSwap }) {
  const { step, quote, fill } = m;
  const sel = (o: string) => m.picked?.what === o;
  // A "not yet" pick shakes the object. Two class names in turn, so a second click shakes it again.
  const shake = (o: string) =>
    m.picked?.what === o && m.picked.result.notYet ? ` ixs-shake${m.picked.n % 2}` : "";
  const spot = PARCEL_AT[parcelSpot(step, fill)];
  const arrived = delivered(fill);
  const coins = step >= FILL && fillReached(fill, "deliver") ? COINS_AT.destination : COINS_AT.solver;
  const area = {
    x: px(ARB_AREA.minX),
    y: pz(ARB_AREA.minZ),
    w: (ARB_AREA.maxX - ARB_AREA.minX) * SCALE,
    h: (ARB_AREA.maxZ - ARB_AREA.minZ) * SCALE,
  };
  const working = step === FILL && fill !== "idle" && fill !== "done";
  return (
    <g>
      {/* ---------- Arbitrum: its own area on the page ---------- */}
      <g data-explain={step === HOOK ? "arbitrum" : undefined}>
        <SvgChainArea
          x={area.x}
          y={area.y}
          width={area.w}
          height={area.h}
          name="Arbitrum"
          color={ACCENT}
          blocks={ARB_BLOCKS}
          blockSize={46}
          onPick={() => m.pick("arbitrum")}
          pickLabel={PICK_LABELS.arbitrum}
          selected={sel("arbitrum")}
        />
      </g>
      <g data-explain={step === FINISH ? "destination" : undefined} className={shake("destination")}>
        <SvgMailbox
          x={px(DESTINATION[0])}
          y={pz(DESTINATION[2]) + 30}
          size={84}
          name="your Arbitrum address"
          color={ACCENT}
          flag={arrived}
          onPick={() => m.pick("destination")}
          pickLabel={PICK_LABELS.destination}
          selected={sel("destination")}
        />
      </g>

      {/* ---------- the solvers ---------- */}
      <g data-explain={step === FILL ? "solver" : undefined}>
        {SOLVERS.map((s, i) => {
          const winner = i === WINNER_INDEX;
          return (
            <g key={i} className={winner && working ? "ixs-busy" : winner ? shake("solver") : undefined}>
              <SvgSignerNode
                x={px(s[0])}
                y={pz(s[2]) + 16}
                size={44}
                color={ACCENT}
                lit={winner && !!quote}
                name={winner ? "winning solver" : `solver ${i + 1}`}
                onPick={() => m.pick("solver")}
                pickLabel={winner ? PICK_LABELS.solver : `Solver ${i + 1} (a drawing)`}
                selected={winner && sel("solver")}
              />
            </g>
          );
        })}
        <text x={px(WINNER[0])} y={pz(SOLVERS[0]![2]) - 50} className="ixs-svg-note mid">
          solvers (a drawing)
        </text>
      </g>

      {/* ---------- NEAR ---------- */}
      <g className={shake("verifier")}>
        <SvgScroll
          x={px(VERIFIER[0])}
          y={pz(VERIFIER[2]) + 6}
          size={58}
          name="intents.near"
          running={fill === "settle"}
          onPick={() => m.pick("verifier")}
          pickLabel={PICK_LABELS.verifier}
          selected={sel("verifier")}
        />
      </g>
      <g data-explain={step === HOOK ? "origin" : undefined}>
        <SvgMailbox
          x={px(ORIGIN[0])}
          y={pz(ORIGIN[2]) + 30}
          size={90}
          name="your account"
          color={ACCENT}
          onPick={() => m.pick("origin")}
          pickLabel={PICK_LABELS.origin}
          selected={sel("origin")}
        />
      </g>

      {/* USDC coins: under the winner's desk until the solver sends them to Arbitrum. */}
      {step >= FILL ? (
        <g
          className="ixs-move"
          style={{ transform: `translate(${px(coins[0])}px, ${pz(coins[2])}px)` }}
          aria-hidden="true"
        >
          {[0, 1, 2].map((k) => (
            <ellipse key={k} cx={0} cy={-k * 6} rx={14} ry={6} className="ixs-coin" />
          ))}
          <text x={0} y={24} className="ixs-svg-note mid">
            USDC
          </text>
        </g>
      ) : null}

      {/* Your intent: a parcel carrying your NEAR. Dashed until the quote is back. */}
      <g
        className={`ixs-move${shake("parcel")}`}
        style={{ transform: `translate(${px(spot[0])}px, ${pz(spot[2]) + 24}px)` }}
        data-explain={step === DECLARE || step === INSPECT ? "parcel" : undefined}
      >
        <SvgParcel
          x={0}
          y={0}
          size={44}
          color={ACCENT}
          to={step >= FILL && fill !== "idle" && fill !== "done" ? "intents.near" : "USDC"}
          stamped={!!quote}
          open={step === INSPECT && m.inspected}
          state={quote ? "ok" : "pending"}
          onPick={() => m.pick("parcel")}
          pickLabel={PICK_LABELS.parcel}
          selected={sel("parcel")}
        />
        {step === INSPECT && m.inspected && quote ? (
          <g className="ixs-slip" aria-hidden="true">
            <rect x={-62} y={16} width={124} height={44} rx={4} />
            <text x={0} y={34}>
              min {quote.minAmountOutFormatted} USDC
            </text>
            <text x={0} y={50}>
              ~{quote.timeEstimate} s
            </text>
          </g>
        ) : null}
      </g>
      {step === DECLARE && m.loading ? (
        <text x={px(PARCEL_AT.home[0])} y={pz(PARCEL_AT.home[2]) + 64} className="ixs-svg-note mid">
          asking 1Click…
        </text>
      ) : null}
    </g>
  );
}
