/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { DOLLARS, FLOWS, MAP, ORACLE, SWAP } from "./steps";

/** What a tour shot looks at. */
export type Target =
  | { kind: "all" }
  | { kind: "usdc" }
  | { kind: "oracle" }
  | { kind: "pools" }
  | { kind: "lend" }
  | { kind: "intents" };

const ALL: Shot<Target> = { caption: "The whole money map.", target: { kind: "all" } };
const shot = (kind: Exclude<Target["kind"], "all">, caption: string): Shot<Target> => ({
  caption: `Close up: ${caption}`,
  target: { kind },
});

/** The tour for a step: the whole figure first, then close-ups. None at the check and honest take. */
export function tourFor(step: number): Shot<Target>[] {
  switch (step) {
    case MAP:
      return [
        ALL,
        shot("pools", "Rhea's pools, the exchange."),
        shot("lend", "Rhea Lend, where tokens are lent and borrowed."),
      ];
    case DOLLARS:
      return [ALL, shot("usdc", "the USDC mailbox. Native USDC next to the bridged USDC.e.")];
    case ORACLE:
      return [ALL, shot("oracle", "the oracle booth and its stored NEAR price.")];
    case SWAP:
      return [ALL, shot("pools", "the stable pool and the simple pool.")];
    case FLOWS:
      return [ALL, shot("intents", "the NEAR Intents area, where cross-chain trades settle.")];
    default:
      return [];
  }
}
