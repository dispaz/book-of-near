/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { CHECK, DERIVE, HONEST, HOOK, PREPARE, SIGN } from "./steps";

export { CHECK, HONEST };

/** What a tour shot looks at. */
export type Target =
  | { kind: "all" }
  | { kind: "account" }
  | { kind: "ring" }
  | { kind: "chains" }
  | { kind: "address" }
  | { kind: "parcel" };

const ALL: Shot<Target> = { caption: "The whole page.", target: { kind: "all" } };
const shot = (kind: Target["kind"], caption: string): Shot<Target> =>
  ({ caption: `Close up: ${caption}`, target: { kind } }) as Shot<Target>;

export function tourFor(step: number): Shot<Target>[] {
  if (step >= CHECK) return [];
  switch (step) {
    case HOOK:
      return [
        ALL,
        shot("account", "your NEAR account, the one mailbox you need."),
        shot("chains", "Ethereum, Bitcoin and Solana, each a chain of its own."),
      ];
    case DERIVE:
      return [
        ALL,
        shot("account", "your NEAR name, the first input."),
        shot("address", "the Ethereum address the math gives."),
      ];
    case PREPARE:
      return [
        ALL,
        shot("parcel", "the Ethereum transaction, packed but not signed."),
        shot("address", "the new address. It starts with 0 ETH."),
      ];
    case SIGN:
      return [
        ALL,
        shot("ring", "the signing nodes. Each adds its key share."),
        shot("parcel", "the transaction, waiting for its signature."),
      ];
    default:
      return [
        ALL,
        shot("parcel", "the signed transaction, stamped."),
        shot("address", "the address the signature points back to."),
      ];
  }
}
