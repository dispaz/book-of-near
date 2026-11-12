/**
 * Lesson 4.3, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout.ts). Behind, path A: the bridge vault, six step tiles and the wUSDC slip. In front, path B:
 * your intent (a parcel) with its shield, two step tiles, the native USDC coin and your mailbox. Every
 * object is a pick, as in 3D. Only draws the shared state from useBridgeCompare.
 */
import type { SceneProps } from "../../../app/types";
import { COLORS, INK } from "../../../scene-kit/theme";
import { SvgPickable } from "../../../scene-kit/svg";
import { SvgMailbox, SvgParcel, SvgReceiptSlip } from "../../../scene-kit/svg/objects";
import stage from "../../stages/4-any-chain/stage";
import { describe, litSteps, PICK_LABELS, VAULT_USD, type Obj } from "./compare";
import {
  BRIDGE_TILES,
  COIN_AT,
  FIGURE,
  INTENT_TILES,
  MAILBOX,
  PARCEL,
  SHIELD,
  SLIP,
  TRACK_A_Z,
  TRACK_B_Z,
  VAULT,
} from "./layout";
import { Facts } from "./parts";
import { BACKING, CHECK, COMPARE, CONFIDENTIAL, EXPLOIT, HOOK, type BridgeCompare } from "./useBridgeCompare";

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
  m: BridgeCompare;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (m.step >= CHECK) return null;
  return (
    <div
      className={`blc${reducedMotion ? " still" : ""}`}
      data-testid="blc-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="blc-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(m)}>
          <Page m={m} />
        </svg>
      </div>
      <Facts m={m} />
    </div>
  );
}

/** A bridge vault seen from the front: a safe with a round door and a dial. Cracked and empty after the exploit. */
function SvgVault({
  x,
  y,
  cracked,
  drained,
  onPick,
  selected,
}: {
  x: number;
  y: number;
  cracked: boolean;
  drained: boolean;
  onPick: () => void;
  selected: boolean;
}) {
  const w = 96;
  const h = 84;
  const top = y - h;
  return (
    <SvgPickable
      label={PICK_LABELS.vault}
      selected={selected}
      onPick={onPick}
      focus={[x - w / 2 - 8, top - 26, w + 16, h + 50]}
    >
      <rect
        x={x - w / 2}
        y={top}
        width={w}
        height={h}
        rx={8}
        fill={cracked ? COLORS.redTint : COLORS.paper}
        stroke={INK}
        strokeWidth={3}
      />
      {drained ? null : (
        <g aria-hidden="true">
          {[0, 1, 2].map((k) => (
            <ellipse
              key={k}
              cx={x + 30}
              cy={y - 12 - k * 7}
              rx={10}
              ry={4}
              fill={ACCENT}
              stroke={INK}
              strokeWidth={1.5}
            />
          ))}
        </g>
      )}
      <g style={{ transform: cracked ? `translate(${-14}px, 0)` : undefined }} className="blc-door">
        <circle
          cx={x - 6}
          cy={top + h / 2}
          r={26}
          fill={cracked ? "none" : COLORS.slab}
          stroke={INK}
          strokeWidth={3}
        />
        <circle cx={x - 6} cy={top + h / 2} r={7} fill={INK} />
      </g>
      {cracked ? (
        <path
          d={`M${x - w / 2 + 6},${top + 10} l18,16 l-10,12 l22,18 l-8,14`}
          fill="none"
          stroke={COLORS.red}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <text x={x} y={top - 8} className="blc-svg-name">
        bridge vault
      </text>
      <text x={x} y={y + 18} className="blc-svg-note mid" data-testid="vault-label">
        {drained ? "$0 left" : `${VAULT_USD} locked`}
      </text>
    </SvgPickable>
  );
}

/** A confidential shield: a heraldic shield with a padlock. */
function SvgShield({
  x,
  y,
  on,
  onPick,
  selected,
}: {
  x: number;
  y: number;
  on: boolean;
  onPick: () => void;
  selected: boolean;
}) {
  const s = 34;
  return (
    <SvgPickable
      label={PICK_LABELS.shield}
      selected={selected}
      onPick={onPick}
      focus={[x - s - 6, y - 2 * s - 8, 2 * s + 12, 2 * s + 30]}
    >
      <path
        d={`M${x},${y} C${x - s},${y - s * 0.6} ${x - s},${y - s * 1.3} ${x - s},${y - 2 * s} L${x + s},${y - 2 * s} C${x + s},${y - s * 1.3} ${x + s},${y - s * 0.6} ${x},${y} z`}
        fill={on ? ACCENT : COLORS.paper}
        stroke={INK}
        strokeWidth={3}
        strokeDasharray={on ? undefined : "6 5"}
      />
      <rect x={x - 9} y={y - s * 1.2} width={18} height={14} rx={2} fill={INK} />
      <path d={`M${x - 6},${y - s * 1.2} v-6 a6,6 0 0 1 12,0 v6`} fill="none" stroke={INK} strokeWidth={3} />
      <text x={x} y={y + 16} className="blc-svg-note mid">
        shield
      </text>
    </SvgPickable>
  );
}

function Page({ m }: { m: BridgeCompare }) {
  const { step } = m;
  const sel = (o: Obj) => m.picked?.what === o;
  // A pick plays the object's own reaction; a "not yet" pick shakes it. Two class names in turn, so a
  // second click plays it again.
  const react = (o: Obj) =>
    m.picked?.what === o
      ? m.picked.result.notYet
        ? ` blc-shake${m.picked.n % 2}`
        : ` blc-pick-${o}${m.picked.n % 2}`
      : "";
  const lit = litSteps(m.played);
  const delivered = step > COMPARE || lit.intent >= 2;
  const coin = delivered ? COIN_AT.delivered : COIN_AT.solver;
  const cracked = m.exploit !== "idle";
  const drained = m.exploit === "drain" || m.exploited;
  const tile = (p: readonly number[], on: boolean, i: number) => (
    <rect
      key={i}
      x={px(p[0]!) - 20}
      y={pz(p[2]!) - 10}
      width={40}
      height={20}
      rx={4}
      className={`blc-tile${on ? " lit" : ""}`}
    />
  );
  return (
    <g>
      {/* ---------- the two tracks ---------- */}
      <text x={px(0.1)} y={pz(TRACK_A_Z) - 30} className="blc-svg-track mid">
        Path A: the old bridge
      </text>
      <line
        x1={8}
        x2={W - 8}
        y1={pz(-0.05)}
        y2={pz(-0.05)}
        stroke={INK}
        strokeWidth={1.5}
        strokeDasharray="8 6"
      />
      <text x={px(0.3)} y={pz(TRACK_B_Z) - 30} className="blc-svg-track mid">
        Path B: the NEAR way
      </text>

      {/* ---------- path A ---------- */}
      <g data-explain={step === COMPARE ? "timelines" : undefined} aria-hidden="true">
        {BRIDGE_TILES.map((p, i) => tile(p, i < lit.bridge, i))}
        {INTENT_TILES.map((p, i) => tile(p, i < lit.intent, i + 10))}
      </g>
      {step >= BACKING && m.inspected ? (
        <path
          d={`M${px(VAULT[0]) + 48},${pz(VAULT[2]) - 40} C${px(0)},${pz(VAULT[2]) - 80} ${px(SLIP[0]) - 80},${pz(SLIP[2]) - 70} ${px(SLIP[0]) - 14},${pz(SLIP[2]) - 30}`}
          fill="none"
          stroke={m.exploited ? COLORS.red : INK}
          strokeWidth={2}
          strokeDasharray="4 4"
          aria-hidden="true"
        />
      ) : null}
      <g
        data-explain={step === HOOK || step === EXPLOIT ? "vault" : undefined}
        className={`blc-obj${react("vault")}`}
      >
        <SvgVault
          x={px(VAULT[0])}
          y={pz(VAULT[2]) + 30}
          cracked={cracked}
          drained={drained}
          onPick={() => m.pick("vault")}
          selected={sel("vault")}
        />
      </g>
      <g data-explain={step === BACKING ? "slip" : undefined} className={`blc-obj${react("slip")}`}>
        <SvgReceiptSlip
          x={px(SLIP[0])}
          y={pz(SLIP[2]) + 24}
          size={56}
          color={ACCENT}
          label={m.exploited ? "wUSDC $0.00" : "wUSDC (IOU)"}
          state={m.exploited ? "failed" : "ok"}
          onPick={() => m.pick("slip")}
          pickLabel={PICK_LABELS.slip}
          selected={sel("slip")}
        />
      </g>

      {/* ---------- path B ---------- */}
      <g className={`blc-obj${react("mailbox")}`}>
        <SvgMailbox
          x={px(MAILBOX[0])}
          y={pz(MAILBOX[2]) + 56}
          size={84}
          name="your account"
          color={ACCENT}
          flag={delivered && m.inspected}
          onPick={() => m.pick("mailbox")}
          pickLabel={PICK_LABELS.mailbox}
          selected={sel("mailbox")}
        />
      </g>
      <g data-explain={step === CONFIDENTIAL ? "shield" : undefined} className={`blc-obj${react("shield")}`}>
        <SvgShield
          x={px(SHIELD[0])}
          y={pz(SHIELD[2]) + 40}
          on={m.shielded}
          onPick={() => m.pick("shield")}
          selected={sel("shield")}
        />
      </g>
      <g className="blc-obj">
        <SvgParcel x={px(PARCEL[0])} y={pz(PARCEL[2]) + 30} size={46} color={ACCENT} to="USDC" stamped />
        {m.shielded ? (
          <circle
            cx={px(PARCEL[0])}
            cy={pz(PARCEL[2]) + 4}
            r={46}
            fill="none"
            stroke={ACCENT}
            strokeWidth={4}
            className="blc-dome"
            aria-hidden="true"
          />
        ) : null}
      </g>
      <g className="blc-move" style={{ transform: `translate(${px(coin[0])}px, ${pz(coin[2])}px)` }}>
        <g className={`blc-obj${react("coin")}`}>
          <SvgPickable
            label={PICK_LABELS.coin}
            selected={sel("coin")}
            onPick={() => m.pick("coin")}
            focus={[-26, -26, 52, 56]}
          >
            <ellipse cx={0} cy={3} rx={20} ry={8} fill={ACCENT} stroke={INK} strokeWidth={2.5} />
            <ellipse cx={0} cy={0} rx={20} ry={8} fill={ACCENT} stroke={INK} strokeWidth={2.5} />
            <text x={0} y={24} className="blc-svg-note mid">
              {m.exploited ? "USDC $1.00" : "USDC"}
            </text>
          </SvgPickable>
        </g>
      </g>
    </g>
  );
}
