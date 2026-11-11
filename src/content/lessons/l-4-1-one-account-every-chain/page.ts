/**
 * What both views draw at a step, worked out once: where the parcel stands, the chains' names and the
 * one-sentence description for screen readers. Pure (no React, no three.js).
 */
import stage from "../../stages/4-any-chain/stage";
import type { Vec3 } from "../../../scene-kit/motion";
import { isWaiting, NODES, shortHex } from "./signing";
import { PARCEL_HOME, PARCEL_WAIT } from "./layout3d";
import { DERIVE, HOOK, PREPARE, SIGN } from "./steps";
import type { ChainSig } from "./useChainSig";

/** Stage 4's accent: marks the things that matter now (the account, the address, the shares). */
export const ACCENT = stage.accent;

type View = Pick<ChainSig, "step" | "phase">;

/** The parcel waits in the ring while the nodes sign; otherwise it stands beside the address. */
export function parcelAt(cs: View): Vec3 {
  return cs.step === SIGN && isWaiting(cs.phase) ? PARCEL_WAIT : PARCEL_HOME;
}

/** What the figure shows, in one sentence (the 2D group's label and the 3D description). */
export function describe(
  cs: Pick<ChainSig, "step" | "phase" | "account" | "prepared" | "result" | "recovered" | "match" | "lit">,
): string {
  const addr = cs.account
    ? `the Ethereum address ${shortHex(cs.account.address)}`
    : "an Ethereum address not yet derived";
  if (cs.step === HOOK)
    return "Your NEAR mailbox, a ring of signing nodes round the signer contract, and Ethereum, a row of block pages with its own keys.";
  if (cs.step === DERIVE)
    return cs.account
      ? `A line runs from your NEAR mailbox through the ring of signing nodes to ${addr}, standing by Ethereum.`
      : "Your NEAR mailbox, the ring of signing nodes and, by Ethereum, a dashed mailbox: the address to derive.";
  if (cs.step === PREPARE)
    return cs.prepared
      ? `A parcel, the unsigned Sepolia transaction, stands beside ${addr}. It has no stamp yet.`
      : `Beside ${addr} a dashed parcel waits to be packed.`;
  if (cs.step === SIGN) {
    if (isWaiting(cs.phase))
      return `The parcel waits inside the ring. ${cs.lit} of ${NODES} signing nodes have added their key share.`;
    if (cs.result)
      return `Enough nodes have added their shares (the threshold). The parcel is back beside ${addr}, stamped: signed.`;
    return "The unsigned parcel stands beside the address. The ring of signing nodes waits for your request.";
  }
  if (cs.recovered)
    return cs.match
      ? `The stamped parcel points back to ${addr}: the flag is up. Your NEAR account signed for it.`
      : "The signature points to another address.";
  return `The stamped parcel stands beside ${addr}, ready to check who signed it.`;
}
