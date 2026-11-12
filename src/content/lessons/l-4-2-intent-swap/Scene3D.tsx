/**
 * Lesson 4.2 in 3D: a pop-up book scene (docs/book-scene.md). On the right page: NEAR on the left (your
 * mailbox and the verifier contract, intents.near, as a scroll), three solvers at their desks in the
 * middle (the winner in front, lit once the quote is back), and Arbitrum on the right (`ChainArea`) with
 * your Arbitrum mailbox. Your intent is a parcel: it goes to the winning solver for the quote, is locked
 * in the verifier while the solver sends USDC coins to Arbitrum, then goes to the solver. Only draws the
 * shared state from useIntentSwap. Loaded lazily from Scene.tsx.
 */
import { useRef, type ReactNode } from "react";
import type { Group } from "three";
import {
  Anchor,
  BookScene,
  ChainArea,
  focusOf,
  inset,
  Label,
  Mailbox,
  Outline,
  Parcel,
  Scroll,
  SignerNode,
  spreadBeside,
  spreadFor,
  textBlock,
  Traveller,
  useAnimatedFrame,
  useFreeFrame,
  useInk,
  useStage,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import stage from "../../stages/4-any-chain/stage";
import {
  ARB_AREA,
  ARB_BLOCKS,
  ARB_CENTER,
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
import { delivered, describe, fillReached, parcelSpot, PICK_LABELS, type Obj } from "./swap";
import { CHECK, FILL, INSPECT } from "./steps";
import { tourFor, type Target } from "./tour";
import type { IntentSwap } from "./useIntentSwap";

const ACCENT = stage.accent;
/** The page needs room in front for the names under the front objects. */
const SPREAD = {
  print: spreadBeside({ ...FIGURE, maxZ: FIGURE.maxZ + 0.4 }),
  docked: spreadFor({ ...FIGURE, maxZ: FIGURE.maxZ + 0.4 }),
};
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 4", "Swap across chains with an intent"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  Two chains and the solvers between them",
  "Fig. 2  Your intent: what you give, what you want",
  "Fig. 3  The winning quote",
  "Fig. 4  The solver fills the order",
  "Fig. 5  Filled: USDC on Arbitrum",
  "Fig. 6  NEAR Intents",
];

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.2]], 46, 0, 0.25);

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target, step: number, fill: IntentSwap["fill"]): Focus {
  const close = (center: Vec3, width: number, depth: number, height = 1.6): Focus => ({
    center,
    width,
    depth,
    height,
    elevation: 28,
    azimuth: -14,
  });
  switch (t.kind) {
    case "origin":
      return close([ORIGIN[0], 0.8, ORIGIN[2]], 2.2, 2.2, 2);
    case "solver":
      return close([WINNER[0], 0.5, WINNER[2] - 0.6], 3.2, 3, 1.4);
    case "verifier":
      return close([VERIFIER[0] + 0.4, 0.6, VERIFIER[2]], 2.6, 2.2, 1.8);
    case "arbitrum":
      return close(
        [ARB_CENTER[0], 0.4, ARB_CENTER[2]],
        ARB_AREA.maxX - ARB_AREA.minX,
        ARB_AREA.maxZ - ARB_AREA.minZ,
        1.4,
      );
    case "parcel": {
      const p = PARCEL_AT[parcelSpot(step, fill)];
      return close([p[0], 0.5, p[2]], 2, 2, 1.6);
    }
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
  m: IntentSwap;
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
  const spot = parcelSpot(step, m.fill);
  return (
    <div
      ref={root}
      className={`book-scene ixs-book${summary ? " summary" : ""}`}
      data-testid="ixs-scene"
      data-scene-state={m.state}
      data-parcel={spot}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Swap across chains with an intent, in 3D"
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
        shotFocus={(t) => shotFocus(t, step, m.fill)}
        flat={flat}
        reducedMotion={reducedMotion}
        state={m.state}
        description={summary ? "The book is open at the intents page." : describe(m)}
        status={
          step === FILL && m.fill !== "idle" && m.fill !== "done"
            ? `the solver is filling: ${m.fill}`
            : undefined
        }
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : <Figure m={m} compact={!print} />}
      </BookScene>
      <div className="book-scene-panel ixs-panel" ref={panel}>
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

/**
 * A USDC coin: a plain token coin in the accent, with no NEAR mark (the kit's `Coin` is a NEAR coin;
 * docs/scene-objects.md: another token gets another face).
 */
function TokenCoin({ y }: { y: number }) {
  const ink = useInk(ACCENT);
  return (
    <mesh position={[0, y, 0]} material={ink}>
      <cylinderGeometry args={[0.42, 0.42, 0.13, 32]} />
      <Outline mode="hull" thickness={0.03} />
      <Outline />
    </mesh>
  );
}

function Figure({ m, compact }: { m: IntentSwap; compact: boolean }) {
  const { step, quote, fill } = m;
  const n = m.picked?.n ?? 0;
  const notYet = (o: Obj) => m.picked?.what === o && !!m.picked.result.notYet;
  const sel = (o: Obj) => m.picked?.what === o;
  const arrived = delivered(fill);
  const locked = step >= FILL && fillReached(fill, "lock") && fill !== "done";
  const coinsTo = step >= FILL && fillReached(fill, "deliver") ? COINS_AT.destination : COINS_AT.solver;
  return (
    <group>
      {/* ---------- NEAR ---------- */}
      <Mailbox
        position={ORIGIN}
        size={1.7}
        name="your account"
        note={compact ? undefined : "NEAR"}
        color={ACCENT}
        onPick={() => m.pick("origin")}
        pickLabel={PICK_LABELS.origin}
        selected={sel("origin")}
      />
      <Anchor name="origin" position={[ORIGIN[0], 1.2, ORIGIN[2]]} />
      <Shake n={n} on={notYet("verifier")}>
        <Scroll
          position={VERIFIER}
          size={1.05}
          name="intents.near"
          note={compact ? undefined : "verifier"}
          running={fill === "settle" || (locked && fill !== "lock")}
          onPick={() => m.pick("verifier")}
          pickLabel={PICK_LABELS.verifier}
          selected={sel("verifier")}
        />
      </Shake>

      {/* ---------- the solvers: three desks, the winner in front ---------- */}
      {SOLVERS.map((s, i) => {
        const winner = i === WINNER_INDEX;
        const node = (
          <SignerNode
            position={s}
            size={winner ? 0.85 : 0.68}
            color={ACCENT}
            lit={winner && !!quote}
            name={winner ? "winning solver" : `solver ${i + 1}`}
            onPick={() => m.pick("solver")}
            pickLabel={winner ? PICK_LABELS.solver : `Solver ${i + 1} (a drawing)`}
            selected={winner && sel("solver")}
          />
        );
        return winner ? (
          <Shake key={i} n={n} on={notYet("solver")}>
            {node}
          </Shake>
        ) : (
          <group key={i}>{node}</group>
        );
      })}
      <Anchor name="solver" position={[WINNER[0], 1.1, WINNER[2]]} />
      {!compact ? (
        <Label position={[WINNER[0], 0.05, SOLVERS[0]![2] - 0.8]} variant="small">
          solvers (a drawing)
        </Label>
      ) : null}

      {/* ---------- Arbitrum: its own area on the page ---------- */}
      <ChainArea
        position={ARB_CENTER}
        width={ARB_AREA.maxX - ARB_AREA.minX}
        depth={ARB_AREA.maxZ - ARB_AREA.minZ}
        name="Arbitrum"
        color={ACCENT}
        blocks={ARB_BLOCKS}
        blockSize={0.85}
        onPick={() => m.pick("arbitrum")}
        pickLabel={PICK_LABELS.arbitrum}
        selected={sel("arbitrum")}
      />
      <Shake n={n} on={notYet("destination")}>
        <Mailbox
          position={DESTINATION}
          size={1.4}
          name="your Arbitrum address"
          color={ACCENT}
          flag={arrived}
          onPick={() => m.pick("destination")}
          pickLabel={PICK_LABELS.destination}
          selected={sel("destination")}
        />
      </Shake>
      <Anchor name="destination" position={[DESTINATION[0], 1.1, DESTINATION[2]]} />

      {/* USDC coins: under the winner's desk until the solver sends them to Arbitrum. */}
      {step >= FILL ? (
        <Traveller to={coinsTo} arc={1.8} duration={1.1} color={ACCENT}>
          {[0, 1, 2].map((k) => (
            <TokenCoin key={k} y={0.07 + k * 0.14} />
          ))}
        </Traveller>
      ) : null}
      {step >= FILL && arrived && !compact ? (
        <Label position={[COINS_AT.destination[0], 0.05, COINS_AT.destination[2] + 0.65]} variant="small">
          {`${quote?.amountOutFormatted ?? ""} USDC`}
        </Label>
      ) : null}

      {/* Your intent: a parcel carrying your NEAR. Dashed until the quote is back, open at step 3. */}
      <Traveller to={PARCEL_AT[parcelSpot(step, fill)]} arc={1.4} duration={0.9} color={ACCENT}>
        <Shake n={n} on={notYet("parcel")}>
          <Parcel
            size={0.8}
            color={ACCENT}
            to={locked ? "intents.near" : "USDC"}
            stamped={!!quote}
            open={step === INSPECT && m.inspected}
            state={quote ? "ok" : "pending"}
            onPick={() => m.pick("parcel")}
            pickLabel={PICK_LABELS.parcel}
            selected={sel("parcel")}
          />
        </Shake>
        {step === INSPECT && m.inspected && quote && !compact ? (
          <Label position={[0, 2.1, 0]} variant="small">
            {`min ${quote.minAmountOutFormatted} USDC · ~${quote.timeEstimate} s`}
          </Label>
        ) : null}
      </Traveller>
      <Anchor name="parcel" position={[PARCEL_AT.home[0], 0.8, PARCEL_AT.home[2]]} />
    </group>
  );
}
