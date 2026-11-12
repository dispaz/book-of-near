/**
 * Lesson 4.1 in 3D: a pop-up book scene (docs/book-scene.md). The right page is split in two. The NEAR
 * side: your mailbox and the signer contract (a scroll) in a ring of signing nodes. The Ethereum side: a
 * marked area (`ChainArea`) with a chain of blocks along its back edge, where the derived address grows
 * and the signed transaction (a parcel) is delivered. On step 4 the parcel goes to the signer, the nodes
 * pick up the request and combine their shares between them, and the finished signature drops onto the
 * parcel (SigningFx). It only draws the shared state from useChainSig. Loaded
 * lazily from Scene.tsx.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Line } from "@react-three/drei";
import type { Group } from "three";
import {
  Anchor,
  BookScene,
  ChainArea,
  focusOf,
  inset,
  Label,
  Mailbox,
  Parcel,
  parcelDims,
  Scroll,
  SignerNode,
  spreadBeside,
  spreadFor,
  textBlock,
  Traveller,
  useFreeFrame,
  useStage,
  type Focus,
  type Vec3,
  useAnimatedFrame,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import {
  beamPoints,
  ETH_AREA,
  ETH_AREA_CENTER,
  ETH_BLOCKS,
  ETH_MAILBOX,
  FIGURE,
  NEAR_MAILBOX,
  nodeSpots,
  PARCEL_AT,
  PARCEL_ETH,
  PARCEL_HOME,
  PARCEL_WAIT,
  RING_CENTER,
  RING_RADIUS,
  SHARE_MEET,
  SIGNER,
} from "./layout3d";
import { ACCENT, canDeliver, describe, ETH_AREA_NAME, parcelAt } from "./page";
import { Facts, pickLabels } from "./parts";
import { isWaiting, shortHex, shortName, slipsShown } from "./signing";
import { NodeWork, RsvSlips, SigningFx } from "./SigningFx";
import { CHECK, DERIVE, PREPARE, SIGN, VERIFY } from "./steps";
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
  "Fig. 1  One account, two chains",
  "Fig. 2  An address worked out from your name",
  "Fig. 3  An Ethereum transaction, packed",
  "Fig. 4  The signing nodes add their shares",
  "Fig. 5  Delivered to Ethereum: who signed it",
  "Fig. 6  Chain Signatures",
];
const PARCEL_SIZE = 0.8;
const PARCEL_TOP = parcelDims(PARCEL_SIZE).height + 0.03;
/** The meeting spot of the shares, seen from the waiting parcel: where the r, s and v slips drop from. */
const SIGNATURE_FROM: Vec3 = [SHARE_MEET[0] - PARCEL_WAIT[0], SHARE_MEET[1], SHARE_MEET[2] - PARCEL_WAIT[2]];
/** How long the parcel waits after the page turns to step 5 before it moves into the Ethereum area. */
const DELIVER_DELAY_MS = 1600;

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.2]], 46, 0, 0.25);

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target, step: number): Focus {
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
    case "ethereum":
      return close(
        [ETH_AREA_CENTER[0], 0.4, ETH_AREA_CENTER[2]],
        ETH_AREA.maxX - ETH_AREA.minX,
        ETH_AREA.maxZ - ETH_AREA.minZ,
        1.4,
      );
    case "address":
      return close([ETH_MAILBOX[0], 0.7, ETH_MAILBOX[2]], 2.2, 2.2, 1.8);
    case "parcel": {
      const p = step >= VERIFY ? PARCEL_ETH : PARCEL_HOME;
      return close([p[0], 0.5, p[2]], 2, 2, 1.6);
    }
    default:
      return { ...WHOLE, elevation: 36, azimuth: -14 };
  }
}

/**
 * Step 5: the signed parcel moves into the Ethereum area once the page has turned, so the learner sees it
 * go. Opened straight at step 5 (or from 2D), it is already there.
 */
function useDelivered(cs: ChainSig, reducedMotion: boolean) {
  const can = canDeliver(cs);
  const [delivered, setDelivered] = useState(can);
  useEffect(() => {
    if (!can) return setDelivered(false);
    const id = window.setTimeout(() => setDelivered(true), reducedMotion ? 0 : DELIVER_DELAY_MS);
    return () => clearTimeout(id);
  }, [can, reducedMotion]);
  return can && delivered;
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
  const delivered = useDelivered(cs, reducedMotion);
  const spot = parcelAt(cs, delivered);
  return (
    <div
      ref={root}
      className={`book-scene csg-book${summary ? " summary" : ""}`}
      data-testid="csg-scene"
      data-scene-state={cs.state}
      data-sign-anim={cs.anim}
      data-parcel={step >= PREPARE ? spot : undefined}
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
        shotFocus={(t) => shotFocus(t, step)}
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
        {summary && !wide ? null : <Figure cs={cs} compact={!print} parcel={PARCEL_AT[spot]} />}
      </BookScene>
      <div className="book-scene-panel csg-panel" ref={panel}>
        {summary ? null : <Facts cs={cs} compact />}
      </div>
    </div>
  );
}

/** Grows its children up from the page when they first appear (not when the figure opens with them). */
function GrowIn({ at, children }: { at: Vec3; children: ReactNode }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  const t0 = useRef<number | null>(reducedMotion ? -1 : null);
  useAnimatedFrame(({ clock }) => {
    const n = g.current;
    if (!n || t0.current === -1) return false;
    t0.current ??= clock.elapsedTime;
    const u = Math.min(1, (clock.elapsedTime - t0.current) / 0.7);
    // Ease out with a little overshoot, like paper popping up.
    const s = u >= 1 ? 1 : 1 + 1.4 * Math.pow(u - 1, 3) + 0.4 * Math.pow(u - 1, 2);
    n.scale.set(Math.max(0.05, s), Math.max(0.05, s), Math.max(0.05, s));
    if (u >= 1) t0.current = -1;
    return u < 1;
  });
  return (
    // Scaled about `at` (where the child stands on the page), so it grows in place.
    <group position={at}>
      <group ref={g} scale={reducedMotion ? 1 : 0.05}>
        <group position={[-at[0], -at[1], -at[2]]}>{children}</group>
      </group>
    </group>
  );
}

function Figure({ cs, compact, parcel }: { cs: ChainSig; compact: boolean; parcel: Vec3 }) {
  const { step, account, result } = cs;
  const waiting = isWaiting(cs.phase);
  const spots = nodeSpots();
  // The address only grows when it is derived while this figure is open, not when it opens with one.
  const openedWith = useRef(account?.address ?? null);
  const working = cs.anim === "work";
  const slips = slipsShown(cs.anim) && !!result;
  // After the check, the address's name says whether it is the recovered signer.
  const verdict = cs.match ? "= signer ✓" : "≠ signer ✗";
  const checked = step === VERIFY && cs.recovered ? (compact ? ` ${verdict.slice(-1)}` : ` ${verdict}`) : "";
  const short = account ? (compact ? shortHex(account.address, 4, 3) : shortHex(account.address, 6, 4)) : "";
  const address = (state: "ok" | "pending") => (
    <Mailbox
      position={ETH_MAILBOX}
      size={1.35}
      name={account ? `${short}${checked}` : "address?"}
      color={ACCENT}
      state={state}
      flag={cs.match}
      onPick={() => cs.pick("address")}
      pickLabel={pickLabels.address}
      selected={cs.picked === "address"}
    />
  );
  return (
    <group>
      {/* ---------- the NEAR side ---------- */}
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
        running={waiting || cs.anim === "shares"}
        onPick={() => cs.pick("signer")}
        pickLabel={pickLabels.signer}
        selected={cs.picked === "signer"}
      />
      {spots.map((s, i) => (
        <group key={i} position={s.position}>
          <NodeWork i={i} busy={working && i >= cs.lit}>
            <SignerNode
              rotation={s.facing}
              size={0.72}
              color={ACCENT}
              lit={i < cs.lit}
              name={`signing node ${i + 1}`}
              onPick={() => cs.pick("ring")}
              pickLabel={`Signing node ${i + 1}${i < cs.lit ? ", share added" : ""}`}
              selected={cs.picked === "ring"}
            />
          </NodeWork>
        </group>
      ))}
      <Anchor name="ring" position={[RING_CENTER[0], 0.9, RING_CENTER[2] - RING_RADIUS]} />
      {step === SIGN ? <SigningFx anim={cs.anim} lit={cs.lit} color={ACCENT} /> : null}
      {step === SIGN && result && (cs.anim === "sealed" || cs.anim === "done") && !compact ? (
        <Label position={[RING_CENTER[0], 0.05, RING_CENTER[2] + RING_RADIUS + 0.5]} variant="small">
          threshold reached
        </Label>
      ) : null}

      {/* ---------- the Ethereum side: its own area on the page ---------- */}
      <ChainArea
        position={ETH_AREA_CENTER}
        width={ETH_AREA.maxX - ETH_AREA.minX}
        depth={ETH_AREA.maxZ - ETH_AREA.minZ}
        name={ETH_AREA_NAME}
        color={ACCENT}
        blocks={ETH_BLOCKS}
        blockSize={0.85}
        onPick={() => cs.pick("ethereum")}
        pickLabel={pickLabels.ethereum}
        selected={cs.picked === "ethereum"}
      />

      {/* The derived address: dashed until derived, then it grows inside the area. */}
      {account ? (
        account.address === openedWith.current ? (
          address("ok")
        ) : (
          <GrowIn key={account.address} at={ETH_MAILBOX}>
            {address("ok")}
          </GrowIn>
        )
      ) : (
        address("pending")
      )}
      <Anchor name="address" position={[ETH_MAILBOX[0], 1.1, ETH_MAILBOX[2]]} />

      {/* Step 5: the check of who signed (in the address's name) and the note that nothing was sent. */}
      {/* Too small to read docked (the facts panel says it there). */}
      {step === VERIFY && cs.recovered && !compact ? (
        <Label position={[PARCEL_ETH[0] - 0.2, 0.05, PARCEL_ETH[2] + 0.95]} variant="hint">
          Not sent to Sepolia: 0 ETH
        </Label>
      ) : null}

      {/* The beam: your name, through the ring's master key, into the area to the address. */}
      {account && step >= DERIVE ? (
        <Line points={beamPoints()} color={ACCENT} lineWidth={3} dashed dashSize={0.18} gapSize={0.1} />
      ) : null}

      {/* The Ethereum transaction: packed by your mailbox, signed in the ring, delivered to Ethereum. */}
      {step >= PREPARE ? (
        <>
          <Traveller to={parcel} arc={1.4} duration={0.9} color={ACCENT}>
            <Parcel
              size={PARCEL_SIZE}
              color={ACCENT}
              to="Sepolia"
              stamped={slips}
              state={cs.prepared ? "ok" : "pending"}
              onPick={() => cs.pick("parcel")}
              pickLabel={pickLabels.parcel}
              selected={cs.picked === "parcel"}
            />
            {slips && result ? (
              <RsvSlips
                parcelTop={PARCEL_TOP}
                v={result.signature.yParity}
                // Sealed: the finished signature drops from where the nodes put it together.
                dropFrom={cs.anim === "sealed" ? SIGNATURE_FROM : undefined}
              />
            ) : null}
          </Traveller>
          <Anchor name="parcel" position={[PARCEL_HOME[0], 0.8, PARCEL_HOME[2]]} />
        </>
      ) : null}
    </group>
  );
}
