/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { partsAt, type Part } from "./layout3d";
import { CHECK, FAIL, GAS, HOOK, HOP, ORDER } from "./steps";

export { CHECK };

/** What a tour shot looks at: the whole figure or one part of it. */
export type Target = { kind: "all" } | { kind: Part };

const ALL: Shot<Target> = { caption: "The whole page.", target: { kind: "all" } };
const close = (kind: Part, caption: string): Shot<Target> => ({
  caption: `Close up: ${caption}`,
  target: { kind },
});

/** The tour for a step: the whole figure first, then close-ups. None at the check and honest take. */
export function tourFor(step: number): Shot<Target>[] {
  switch (step) {
    case HOOK:
      return [ALL, close("contracts", "two contracts, two scrolls. Each keeps its own state.")];
    case HOP:
      return [
        ALL,
        close("slip", "the action receipt: the method to run and its gas."),
        close("contracts", "the contract it is addressed to runs it later."),
      ];
    case ORDER:
      return [
        ALL,
        close("blocks", "one block per hop, time running left to right."),
        close("contracts", "the caller and the shop, on different shards."),
      ];
    case GAS:
      return [
        ALL,
        close("meter", "one part per contract: the gas it burnt, all of it burned."),
        close("blocks", "each receipt burnt its own gas."),
      ];
    case FAIL:
      return [
        ALL,
        close("blocks", "the shop's receipt failed; the callback still ran."),
        close("contracts", "contract A undid its reservation itself."),
      ];
    default:
      return [];
  }
}

/** True when every shot of the step looks at something the step draws. */
export function shotsDrawn(step: number): boolean {
  const drawn = partsAt(step);
  return tourFor(step).every((s) => s.target.kind === "all" || drawn.includes(s.target.kind));
}
