/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { CHECK, HALL, INSPECT, LOCK, STAKE, VOTE } from "./steps";

export { CHECK };

/** What a tour shot looks at. */
export type Target =
  { kind: "all" } | { kind: "pool" } | { kind: "gauge" } | { kind: "scroll" } | { kind: "stamps" };

const ALL: Shot<Target> = { caption: "The whole town hall.", target: { kind: "all" } };
const shot = (kind: Exclude<Target["kind"], "all">, caption: string): Shot<Target> => ({
  caption: `Close up: ${caption}`,
  target: { kind },
});

/** The tour for a step: the whole figure first, then close-ups. None at the check and honest take. */
export function tourFor(step: number): Shot<Target>[] {
  switch (step) {
    case HALL:
      return [
        ALL,
        shot("pool", "a staking pool, where delegators put their NEAR."),
        shot("scroll", "a proposal the community votes on."),
      ];
    case STAKE:
      return [ALL, shot("pool", "the staking pool's mailbox. Your NEAR stays yours.")];
    case LOCK:
      return [ALL, shot("gauge", "the veNEAR gauge. A longer lock fills it higher.")];
    case INSPECT:
      return [ALL, shot("scroll", "Proposal #42, an example, and its quorum bar.")];
    case VOTE:
      return [ALL, shot("stamps", "the YES and NO ballot stamps.")];
    default:
      return [];
  }
}
