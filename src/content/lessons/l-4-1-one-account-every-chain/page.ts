/**
 * What both views draw at a step, worked out once: where the parcel stands and the one-sentence
 * description for screen readers. Pure (no React, no three.js).
 */
import stage from "../../stages/4-any-chain/stage";
import { NODES, parcelSpot, shortHex, THRESHOLD, type ParcelSpot } from "./signing";
import { DERIVE, HOOK, PREPARE, SIGN, VERIFY } from "./steps";
import type { ChainSig } from "./useChainSig";

/** Stage 4's accent: marks the things that matter now (the account, the address, the shares). */
export const ACCENT = stage.accent;

/** The printed name of the Ethereum area. */
export const ETH_AREA_NAME = "Ethereum (Sepolia)";

/**
 * Where the parcel stands: by your NEAR mailbox (packed, and back once signed), in the ring while the
 * nodes sign, and inside the Ethereum area from step 5. `delivered` lets the 3D view hold the parcel
 * back until the page has turned, so the learner sees it move in.
 */
export function parcelAt(
  cs: Pick<ChainSig, "step" | "anim" | "result">,
  delivered = canDeliver(cs),
): ParcelSpot {
  return parcelSpot(cs.anim, cs.step === SIGN, delivered);
}

/** From step 5 the signed parcel goes into the Ethereum area. Unsigned, it stays by your mailbox. */
export const canDeliver = (cs: Pick<ChainSig, "step" | "result">) => cs.step >= VERIFY && !!cs.result;

/** What the figure shows, in one sentence (the 2D group's label and the 3D description). */
export function describe(
  cs: Pick<
    ChainSig,
    "step" | "phase" | "anim" | "account" | "prepared" | "result" | "recovered" | "match" | "lit"
  >,
): string {
  const addr = cs.account
    ? `the Ethereum address ${shortHex(cs.account.address)}`
    : "an Ethereum address not yet derived";
  if (cs.step === HOOK)
    return "The page is split in two. On the NEAR side, your mailbox and a ring of signing nodes round the signer contract. On the other, the Ethereum (Sepolia) area, a chain of blocks with its own keys.";
  if (cs.step === DERIVE)
    return cs.account
      ? `A line runs from your NEAR mailbox through the ring of signing nodes into the Ethereum area, where ${addr} has grown.`
      : "Your NEAR mailbox, the ring of signing nodes and, in the Ethereum area, a dashed mailbox: the address to derive.";
  if (cs.step === PREPARE)
    return cs.prepared
      ? `A parcel, the unsigned Sepolia transaction from ${addr}, stands by your NEAR mailbox. It has no stamp yet.`
      : "By your NEAR mailbox a dashed parcel waits to be packed.";
  if (cs.step === SIGN) {
    switch (cs.anim) {
      case "travel":
        return "The parcel, carrying the payload hash, travels to the signer contract.";
      case "work":
        return `The signing nodes pick up the request. ${cs.lit} of ${NODES} signing nodes have added their key share.`;
      case "shares":
        return `The nodes combine their shares between them: ${THRESHOLD} of ${NODES}, the threshold.`;
      case "sealed":
        return "The threshold is reached. The finished signature drops onto the parcel as r, s and v.";
      default:
        return cs.result
          ? `Enough nodes have added their shares (the threshold). The parcel is back by your NEAR mailbox, stamped and carrying r, s and v.`
          : "The unsigned parcel stands by your NEAR mailbox. The ring of signing nodes waits for your request.";
    }
  }
  if (!cs.result)
    return `The unsigned parcel stands by your NEAR mailbox, and ${addr} waits in the Ethereum area. No signature yet.`;
  if (cs.recovered)
    return cs.match
      ? `The stamped parcel, carrying r, s and v, is inside the Ethereum area. The recovered signer is ${addr}: the flag is up. Not sent to Sepolia.`
      : "The signature points to another address.";
  return `The stamped parcel, carrying r, s and v, is delivered into the Ethereum area beside ${addr}, ready to check who signed it.`;
}
