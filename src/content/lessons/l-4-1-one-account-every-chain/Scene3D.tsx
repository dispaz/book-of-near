/**
 * Lesson 4.1 in 3D: a pop-up book scene (docs/book-scene.md). The figure stands on the right page:
 * your NEAR mailbox, the signer contract (a scroll) in a ring of signing nodes, three other chains as
 * rows of block pages, the derived Ethereum address (a mailbox) and the Ethereum transaction (a parcel)
 * that travels into the ring, waits there while the nodes add their key shares, and comes back stamped.
 * It only draws the shared state from useChainSig. Loaded lazily from Scene.tsx.
 */
import { useRef } from "react";
import { Line } from "@react-three/drei";
import {
  Anchor,
  BookScene,
  COLORS,
  focusOf,
  inset,
  Label,
  Ledger,
  Mailbox,
  Parcel,
  Scroll,
  SignerNode,
  spreadBeside,
  spreadFor,
  textBlock,
  Traveller,
  useFreeFrame,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import {
  beamPoints,
  ETH_MAILBOX,
  FIGURE,
  LEDGERS,
  NEAR_MAILBOX,
  nodeSpots,
  PARCEL_HOME,
  RING_CENTER,
  RING_RADIUS,
  SIGNER,
  type ChainKey,
} from "./layout3d";
import { ACCENT, CHAIN_NAMES, describe, parcelAt } from "./page";
import { Facts, pickLabels } from "./parts";
import { isWaiting, shortHex, shortName } from "./signing";
import { CHECK, DERIVE, PREPARE, SIGN } from "./steps";
import { tourFor, type Target } from "./tour";
import type { ChainSig } from "./useChainSig";

/** The page needs room in front for the names under the front objects. */
const SPREAD = {
  print: spreadBeside({ ...FIGURE, maxZ: FIGURE.maxZ + 0.4 }),
  docked: spreadFor({ ...FIGURE, maxZ: FIGURE.maxZ + 0.4 }),
};
/** Where the step's words are printed on the left page. */
const TEXT = textBlock(SPREAD.print);
/** Running heads, only when the words are docked (the printed step heads the page otherwise). */
const HEADS: [string, string] = ["Stage 4", "One account, every chain"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  One account, many chains",
  "Fig. 2  An address worked out from your name",
  "Fig. 3  An Ethereum transaction, packed",
  "Fig. 4  The signing nodes add their shares",
  "Fig. 5  Who signed it",
  "Fig. 6  Chain Signatures",
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
      return close([NEAR_MAILBOX[0], 0.8, NEAR_MAILBOX[2]], 2.2, 2.2, 2);
    case "ring":
      return close([RING_CENTER[0], 0.5, RING_CENTER[2]], RING_RADIUS * 2.4, RING_RADIUS * 2.4, 1.4);
    case "chains":
      return close([LEDGERS.bitcoin[0], 0.5, LEDGERS.bitcoin[2]], 2.6, 3.4, 1.4);
    case "address":
      return close([ETH_MAILBOX[0], 0.7, ETH_MAILBOX[2]], 2.2, 2.2, 1.8);
    case "parcel":
      return close([PARCEL_HOME[0], 0.4, PARCEL_HOME[2]], 2, 2, 1.2);
    default:
      return { ...WHOLE, elevation: 36, azimuth: -14 };
  }
}

export default function Scene3D({
  cs,
  reducedMotion,
  flat,
  mode,
}: {
  cs: ChainSig;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = cs;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  const sheet = Math.min(step, CHECK);
  return (
    <div
      ref={root}
      className={`book-scene csg-book${summary ? " summary" : ""}`}
      data-testid="csg-scene"
      data-scene-state={cs.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="One account, every chain, in 3D"
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
        state={cs.state}
        description={summary ? "The book is open at the chain signatures page." : describe(cs)}
        status={
          step === SIGN && cs.phase === "waiting"
            ? `waiting for the signing network: ${cs.lit} of ${nodeSpots().length} shares`
            : undefined
        }
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : <Figure cs={cs} compact={!print} />}
      </BookScene>
      <div className="book-scene-panel csg-panel" ref={panel}>
        {summary ? null : <Facts cs={cs} compact />}
      </div>
    </div>
  );
}

function Figure({ cs, compact }: { cs: ChainSig; compact: boolean }) {
  const { step, account } = cs;
  const waiting = isWaiting(cs.phase);
  const spots = nodeSpots();
  return (
    <group>
      {/* Your NEAR account. */}
      <Mailbox
        position={NEAR_MAILBOX}
        size={1.7}
        name={cs.me ? shortName(cs.me) : "your account"}
        note={compact ? undefined : "NEAR"}
        color={ACCENT}
        onPick={() => cs.pick("near")}
        pickLabel={pickLabels.near}
        selected={cs.picked === "near"}
      />
      <Anchor name="mailbox" position={[NEAR_MAILBOX[0], 1.2, NEAR_MAILBOX[2]]} />

      {/* The signer contract in its ring of signing nodes. */}
      <Scroll
        position={SIGNER}
        size={1.05}
        name="signer"
        running={waiting}
        onPick={() => cs.pick("signer")}
        pickLabel={pickLabels.signer}
        selected={cs.picked === "signer"}
      />
      {spots.map((s, i) => (
        <SignerNode
          key={i}
          position={s.position}
          rotation={s.facing}
          size={0.72}
          color={ACCENT}
          lit={i < cs.lit}
          name={`signing node ${i + 1}`}
          onPick={() => cs.pick("ring")}
          pickLabel={`Signing node ${i + 1}${i < cs.lit ? ", share added" : ""}`}
          selected={cs.picked === "ring"}
        />
      ))}
      <Anchor name="ring" position={[RING_CENTER[0], 0.9, RING_CENTER[2] - RING_RADIUS]} />
      {step === SIGN && cs.result ? (
        <Label position={[RING_CENTER[0], 1.9, RING_CENTER[2]]} variant="small">
          threshold reached
        </Label>
      ) : null}

      {/* Three other chains. */}
      {(Object.keys(LEDGERS) as ChainKey[]).map((k) => (
        <Ledger
          key={k}
          position={LEDGERS[k]}
          size={0.75}
          name={CHAIN_NAMES[k]}
          edge={k === "ethereum" ? ACCENT : COLORS.slab}
          onPick={() => cs.pick(k)}
          pickLabel={pickLabels[k]}
          selected={cs.picked === k}
        />
      ))}

      {/* The derived address: dashed until derived; its flag goes up when the signer checks out. */}
      <Mailbox
        position={ETH_MAILBOX}
        size={1.35}
        name={account ? shortHex(account.address, 6, 4) : "address?"}
        color={ACCENT}
        state={account ? "ok" : "pending"}
        flag={cs.match}
        onPick={() => cs.pick("address")}
        pickLabel={pickLabels.address}
        selected={cs.picked === "address"}
      />
      <Anchor name="address" position={[ETH_MAILBOX[0], 1.1, ETH_MAILBOX[2]]} />

      {/* The beam: your name, through the ring's master key, to the address. */}
      {account && step >= DERIVE ? (
        <Line points={beamPoints()} color={ACCENT} lineWidth={3} dashed dashSize={0.18} gapSize={0.1} />
      ) : null}

      {/* The Ethereum transaction. */}
      {step >= PREPARE ? (
        <>
          <Traveller to={parcelAt(cs)} arc={1.4} duration={0.9} color={ACCENT}>
            <Parcel
              size={0.8}
              color={ACCENT}
              to="Sepolia"
              stamped={!!cs.result}
              state={cs.prepared ? "ok" : "pending"}
              onPick={() => cs.pick("parcel")}
              pickLabel={pickLabels.parcel}
              selected={cs.picked === "parcel"}
            />
          </Traveller>
          <Anchor name="parcel" position={[PARCEL_HOME[0], 0.8, PARCEL_HOME[2]]} />
        </>
      ) : null}
    </group>
  );
}
