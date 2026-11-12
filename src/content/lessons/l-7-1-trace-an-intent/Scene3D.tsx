/**
 * Lesson 7.1 in 3D: a pop-up book scene (docs/book-scene.md). On the right page, the intent's trail from
 * left to right: your mailbox and function-call key, two shard ribbons (yours and the verifier's), the
 * verifier scroll (intents.near), three signing nodes (a side note: this replay does not use them) and
 * the mailbox where the USDC lands. The intent is a
 * parcel by your mailbox, then a receipt slip that walks the trail. Only draws the shared state from
 * useCapstone. Loaded lazily from Scene.tsx.
 */
import { useRef, type ReactNode } from "react";
import type { Group } from "three";
import {
  Anchor,
  BookScene,
  focusOf,
  inset,
  Mailbox,
  Parcel,
  ReceiptSlip,
  Scroll,
  ShardRibbon,
  SignerNode,
  spreadBeside,
  spreadFor,
  TaggedKey,
  textBlock,
  Traveller,
  useAnimatedFrame,
  useFreeFrame,
  useStage,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
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
  SIGNERS_CENTER,
  SPOT_AT,
  VERIFIER,
} from "./layout";
import { Facts } from "./parts";
import { describe, PICK_LABELS, settleReached } from "./trail";
import { tourFor, type Target } from "./tour";
import { AUTHORIZE, CHECK, SETTLE, SHARDS, type Capstone } from "./useCapstone";

const ACCENT = stage.accent;
/** The page needs room in front for the names under the front objects. */
const SPREAD = {
  print: spreadBeside({ ...FIGURE, maxZ: FIGURE.maxZ + 0.4 }),
  docked: spreadFor({ ...FIGURE, maxZ: FIGURE.maxZ + 0.4 }),
};
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 7", "Trace one intent end to end"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  One intent, every layer",
  "Fig. 2  Your account signs with a scoped key",
  "Fig. 3  A receipt crosses shards",
  "Fig. 4  The verifier runs as Wasm",
  "Fig. 5  The solver settles the trade",
  "Fig. 6  The whole stack",
];

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.2]], 46, 0, 0.25);

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target): Focus {
  const close = (center: Vec3, width: number, depth: number, height = 1.6): Focus => ({
    center,
    width,
    depth,
    height,
    elevation: 28,
    azimuth: -14,
  });
  switch (t.kind) {
    case "account":
      return close([(ACCOUNT[0] + KEY[0]) / 2, 0.8, ACCOUNT[2]], 3, 2.4, 2);
    case "shards":
      return close([RIBBON.x, 0.3, (SHARD_Z.mine + SHARD_Z.verifier) / 2], RIBBON.length + 0.6, 2.6, 1);
    case "verifier":
      return close([VERIFIER[0], 0.8, VERIFIER[2]], 2.4, 2.2, 1.8);
    case "signers":
      return close([SIGNERS_CENTER[0], 0.6, SIGNERS_CENTER[2]], 3.4, 2.4, 1.4);
    case "destination":
      return close([DESTINATION[0], 0.8, DESTINATION[2]], 2, 2, 1.8);
    default:
      return { ...WHOLE, elevation: 36, azimuth: -14 };
  }
}

export default function Scene3D({
  m,
  reducedMotion,
  flat,
  mode,
}: {
  m: Capstone;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = m;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  const sheet = Math.min(step, CHECK);
  return (
    <div
      ref={root}
      className={`book-scene cap-book${summary ? " summary" : ""}`}
      data-testid="cap-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Trace one intent end to end, in 3D"
    >
      <BookScene
        page={step}
        sheet={sheet}
        spread={print ? SPREAD.print : SPREAD.docked}
        heads={print ? undefined : HEADS}
        caption={FIGURES[sheet]}
        text={print ? TEXT : null}
        focus={WHOLE}
        frame={inset(frame, { top: 24, bottom: 16 })}
        size={size}
        shots={tourFor(step)}
        shotFocus={shotFocus}
        flat={flat}
        reducedMotion={reducedMotion}
        state={m.state}
        description={describe({ ...m, name: m.trail.name, intent: m.trail.intent })}
        status={
          step === SETTLE && m.settle !== "idle" && m.settle !== "done" ? `settling: ${m.settle}` : undefined
        }
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : <Figure m={m} compact={!print} />}
      </BookScene>
      <div className="book-scene-panel cap-panel" ref={panel}>
        {summary ? null : <Facts m={m} compact />}
      </div>
    </div>
  );
}

/**
 * A "not yet" pick: a short side-to-side shake that settles (render on demand). `n` is the pick's
 * number, so each early click shakes again. Reduced motion: no shake (the hint still shows).
 */
function Shake({ n, on, children }: { n: number; on: boolean; children: ReactNode }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  const seen = useRef(n);
  const t0 = useRef<number | null>(null);
  useAnimatedFrame(({ clock }) => {
    const node = g.current;
    if (!node) return false;
    if (seen.current !== n) {
      seen.current = n;
      t0.current = on && !reducedMotion ? clock.elapsedTime : null;
    }
    if (t0.current === null) {
      node.position.x = 0;
      return false;
    }
    const u = Math.min(1, (clock.elapsedTime - t0.current) / 0.45);
    node.position.x = Math.sin(u * Math.PI * 6) * 0.09 * (1 - u);
    if (u >= 1) t0.current = null;
    return u < 1;
  });
  return <group ref={g}>{children}</group>;
}

function Figure({ m, compact }: { m: Capstone; compact: boolean }) {
  const { step, authorized, settle } = m;
  const n = m.picked?.n ?? 0;
  const { notYet, isPicked: sel } = m;
  const done = settleReached(settle, "done");
  return (
    <group>
      {/* ---------- your account and its key ---------- */}
      <Mailbox
        position={ACCOUNT}
        size={1.6}
        name={m.trail.name}
        note={compact ? undefined : "your account"}
        color={ACCENT}
        onPick={() => m.pick("account")}
        pickLabel={PICK_LABELS.account}
        selected={sel("account")}
      />
      <Anchor name="account" position={[ACCOUNT[0], 1.2, ACCOUNT[2]]} />
      <TaggedKey
        position={[KEY[0], 0.5, KEY[2]]}
        tag={VERIFIER_CONTRACT}
        share={authorized ? 0.8 : 1}
        color={ACCENT}
        name="function-call key"
        onPick={() => m.pick("key")}
        pickLabel={PICK_LABELS.key}
        selected={sel("key")}
      />

      {/* ---------- the shards: yours (front), the verifier's (back) ---------- */}
      <Shake n={n} on={notYet("shards")}>
        {SHARD_RIBBONS.map(([k, name, label]) => (
          <ShardRibbon
            key={k}
            position={[RIBBON.x, 0.01, SHARD_Z[k]]}
            length={RIBBON.length}
            width={RIBBON.width}
            name={name}
            color={step === SHARDS || (k === "mine" && step === AUTHORIZE && authorized) ? ACCENT : undefined}
            onPick={() => m.pick("shards")}
            pickLabel={label}
            selected={sel("shards")}
          />
        ))}
      </Shake>
      <Anchor name="shards" position={[RIBBON.x, 0.6, SHARD_Z.verifier]} />

      {/* ---------- the verifier contract ---------- */}
      <Shake n={n} on={notYet("verifier")}>
        <Scroll
          position={VERIFIER}
          size={1.2}
          name={VERIFIER_CONTRACT}
          note={compact ? undefined : "Wasm"}
          running={m.running}
          onPick={() => m.pick("verifier")}
          pickLabel={PICK_LABELS.verifier}
          selected={sel("verifier")}
        />
      </Shake>
      <Anchor name="verifier" position={[VERIFIER[0], 1.3, VERIFIER[2]]} />

      {/* ---------- the signing nodes: a side note, this replay does not use them ---------- */}
      <Shake n={n} on={notYet("signers")}>
        {SIGNERS.map((p, i) => (
          <SignerNode
            key={i}
            position={p}
            size={0.72}
            color={ACCENT}
            lit={false}
            name={`node ${i + 1}`}
            onPick={() => m.pick("signers")}
            pickLabel={i === 0 ? PICK_LABELS.signers : `Signing node ${i + 1}`}
            selected={sel("signers")}
          />
        ))}
      </Shake>
      <Anchor name="signers" position={[SIGNERS_CENTER[0], 1.1, SIGNERS_CENTER[2]]} />

      {/* ---------- where the USDC lands ---------- */}
      <Shake n={n} on={notYet("destination")}>
        <Mailbox
          position={DESTINATION}
          size={1.3}
          name="your USDC"
          color={ACCENT}
          flag={done}
          onPick={() => m.pick("destination")}
          pickLabel={PICK_LABELS.destination}
          selected={sel("destination")}
        />
      </Shake>
      <Anchor name="destination" position={[DESTINATION[0], 1.2, DESTINATION[2]]} />

      {/* The intent: a parcel by your mailbox, then a receipt slip that walks the trail. */}
      <Traveller to={SPOT_AT[m.spot]} arc={1.2} duration={0.7} color={ACCENT}>
        {step >= SHARDS ? (
          <ReceiptSlip size={0.75} color={ACCENT} fate={done ? "done" : "idle"} label="intent" />
        ) : (
          <Parcel
            size={0.7}
            color={ACCENT}
            to={VERIFIER_CONTRACT}
            stamped={authorized}
            state={authorized ? "ok" : "pending"}
          />
        )}
      </Traveller>
    </group>
  );
}
