/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { AUTHORIZE, CHECK, CONTRACT, HONEST, MAP, SETTLE, SHARDS } from "./steps";

export { CHECK, HONEST };

export type Target =
  | { kind: "all" }
  | { kind: "account" }
  | { kind: "shards" }
  | { kind: "verifier" }
  | { kind: "signers" }
  | { kind: "destination" };

const ALL: Shot<Target> = { caption: "The whole page.", target: { kind: "all" } };
const shot = (kind: Target["kind"], caption: string): Shot<Target> =>
  ({ caption: `Close up: ${caption}`, target: { kind } }) as Shot<Target>;

export function tourFor(step: number): Shot<Target>[] {
  switch (step) {
    case MAP:
      return [
        ALL,
        shot("account", "your named account and its function-call key."),
        shot("signers", "the signing nodes at the end of the trail."),
      ];
    case AUTHORIZE:
      return [ALL, shot("account", "your mailbox, where the signed intent starts.")];
    case SHARDS:
      return [ALL, shot("shards", "two shards: yours, and the verifier's.")];
    case CONTRACT:
      return [ALL, shot("verifier", "the verifier contract, running as Wasm.")];
    case SETTLE:
      return [
        ALL,
        shot("destination", "where the USDC lands, paid out by the solver."),
        shot("signers", "the signing nodes. They sign only when a payout must leave NEAR."),
      ];
    default:
      return [];
  }
}
