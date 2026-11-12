/**
 * Lesson 7.1, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout.ts) and the same scene objects. Your mailbox and key, two shard ribbons, the verifier scroll,
 * the signing nodes and where the USDC lands. The parcel (later a receipt) walks the trail. Every object
 * is a pick, as in 3D. Only draws the shared state from useCapstone.
 */
import type { SceneProps } from "../../../app/types";
import {
  SvgMailbox,
  SvgParcel,
  SvgReceiptSlip,
  SvgScroll,
  SvgShardRibbon,
  SvgSignerNode,
  SvgTaggedKey,
} from "../../../scene-kit/svg/objects";
import { VERIFIER_CONTRACT } from "../../../chain/intents";
import stage from "../../stages/7-book-of-near/stage";
import {
  ACCOUNT,
  DESTINATION,
  FIGURE,
  KEY,
  RIBBON,
  SHARD_RIBBONS,
  SHARD_Z,
  SIGNERS,
  SPOT_AT,
  VERIFIER,
} from "./layout";
import { Facts } from "./parts";
import { describe, PICK_LABELS, settleReached, type Obj } from "./trail";
import { AUTHORIZE, CHECK, CONTRACT, MAP, SETTLE, SHARDS, type Capstone } from "./useCapstone";

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
  m: Capstone;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (m.step >= CHECK) return null;
  const s = { ...m, name: m.trail.name, intent: m.trail.intent };
  return (
    <div
      className={`cap${reducedMotion ? " still" : ""}`}
      data-testid="cap-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="cap-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(s)}>
          <Page m={m} />
        </svg>
      </div>
      <Facts m={m} />
    </div>
  );
}

function Page({ m }: { m: Capstone }) {
  const { step, authorized, settle } = m;
  const sel = m.isPicked;
  // A "not yet" pick shakes the object. Two class names in turn, so a second click shakes it again.
  const shake = (o: Obj) => (m.notYet(o) ? ` cap-shake${(m.picked?.n ?? 0) % 2}` : "");
  const at = SPOT_AT[m.spot];
  const done = settleReached(settle, "done");
  const receipt = step >= SHARDS;
  return (
    <g>
      {/* ---------- the shards: yours (front), the verifier's (back) ---------- */}
      <g className={shake("shards")} data-explain={step === SHARDS ? "shards" : undefined}>
        {SHARD_RIBBONS.map(([k, name, label]) => (
          <SvgShardRibbon
            key={k}
            x={px(RIBBON.x)}
            y={pz(SHARD_Z[k])}
            length={RIBBON.length * SCALE}
            width={RIBBON.width * SCALE}
            name={name}
            color={step === SHARDS || (k === "mine" && step === AUTHORIZE && authorized) ? ACCENT : undefined}
            onPick={() => m.pick("shards")}
            pickLabel={label}
            selected={sel("shards")}
          />
        ))}
      </g>

      {/* ---------- the verifier contract ---------- */}
      <g className={shake("verifier")} data-explain={step === CONTRACT ? "verifier" : undefined}>
        <SvgScroll
          x={px(VERIFIER[0])}
          y={pz(VERIFIER[2]) + 30}
          size={78}
          name={VERIFIER_CONTRACT}
          note="Wasm"
          running={m.running}
          onPick={() => m.pick("verifier")}
          pickLabel={PICK_LABELS.verifier}
          selected={sel("verifier")}
        />
      </g>

      {/* ---------- where the USDC lands ---------- */}
      <g
        className={`${step === SETTLE && settle === "solver" ? "cap-busy" : ""}${shake("destination")}`}
        data-explain={step === SETTLE ? "destination" : undefined}
      >
        <SvgMailbox
          x={px(DESTINATION[0])}
          y={pz(DESTINATION[2]) + 36}
          size={74}
          name="your USDC"
          color={ACCENT}
          flag={done}
          onPick={() => m.pick("destination")}
          pickLabel={PICK_LABELS.destination}
          selected={sel("destination")}
        />
      </g>

      {/* ---------- the signing nodes: a side note, this replay does not use them ---------- */}
      <g>
        {SIGNERS.map((n, i) => (
          <SvgSignerNode
            key={i}
            x={px(n[0])}
            y={pz(n[2]) + 18}
            size={44}
            color={ACCENT}
            lit={false}
            name={`node ${i + 1}`}
            onPick={() => m.pick("signers")}
            pickLabel={i === 0 ? PICK_LABELS.signers : `Signing node ${i + 1}`}
            selected={sel("signers")}
          />
        ))}
      </g>

      {/* ---------- your account and its key ---------- */}
      <g data-explain={step === MAP || step === AUTHORIZE ? "account" : undefined}>
        <SvgMailbox
          x={px(ACCOUNT[0])}
          y={pz(ACCOUNT[2]) + 30}
          size={88}
          name={m.trail.name}
          color={ACCENT}
          onPick={() => m.pick("account")}
          pickLabel={PICK_LABELS.account}
          selected={sel("account")}
        />
      </g>
      <SvgTaggedKey
        x={px(KEY[0])}
        y={pz(KEY[2])}
        tag={VERIFIER_CONTRACT}
        share={authorized ? 0.8 : 1}
        color={ACCENT}
        name="function-call key"
        onPick={() => m.pick("key")}
        pickLabel={PICK_LABELS.key}
        selected={sel("key")}
      />

      {/* The intent: a parcel by your mailbox, then a receipt walking the trail. */}
      <g
        className="cap-move"
        style={{ transform: `translate(${px(at[0])}px, ${pz(at[2]) + 18}px)` }}
        aria-hidden="true"
      >
        {receipt ? (
          <SvgReceiptSlip x={0} y={0} size={40} color={ACCENT} fate={done ? "done" : "idle"} label="intent" />
        ) : (
          <SvgParcel
            x={0}
            y={0}
            size={42}
            color={ACCENT}
            to={VERIFIER_CONTRACT}
            stamped={authorized}
            state={authorized ? "ok" : "pending"}
          />
        )}
      </g>
    </g>
  );
}
