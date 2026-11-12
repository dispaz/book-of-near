/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { CHECK, DECLARE, FILL, HONEST, HOOK, INSPECT } from "./steps";

export { CHECK, HONEST };

/** What a tour shot looks at. */
export type Target =
  | { kind: "all" }
  | { kind: "origin" }
  | { kind: "solver" }
  | { kind: "arbitrum" }
  | { kind: "verifier" }
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
        shot("origin", "your NEAR account, where the trade starts."),
        shot("arbitrum", "Arbitrum, another chain with its own gas."),
      ];
    case DECLARE:
      return [ALL, shot("parcel", "your intent: what you give and what you want back.")];
    case INSPECT:
      return [
        ALL,
        shot("solver", "the winning solver. The other two are a drawing."),
        shot("parcel", "the quote slip: the guaranteed minimum."),
      ];
    case FILL:
      return [
        ALL,
        shot("arbitrum", "USDC arrives on Arbitrum, from the solver's own funds."),
        shot("verifier", "the verifier, intents.near, holds your NEAR until the proof."),
      ];
    default:
      return [ALL, shot("arbitrum", "your Arbitrum mailbox, flag up.")];
  }
}
