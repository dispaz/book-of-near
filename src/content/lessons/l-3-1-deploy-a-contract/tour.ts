/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { partsAt, type Part } from "./layout3d";
import { CALL, CHECK, CLEAR, DEPLOY, FAIL, HOOK, WASM } from "./steps";

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
      return [
        ALL,
        close("sub", "the sub-account, dashed because it does not exist yet."),
        close("scroll", "the contract, a scroll of rules with a gear: code that runs."),
      ];
    case WASM:
      return [
        ALL,
        close("scroll", "the Wasm file. Every one starts with the bytes 00 61 73 6d."),
        close("parent", "your account, the parent of the sub-account."),
      ];
    case DEPLOY:
      return [
        ALL,
        close("sub", "the contract's own account, made in the same batch."),
        close("gauge", "its balance: locked for storage, and available."),
      ];
    case CALL:
      return [
        ALL,
        close("scroll", "the count, stored in the contract's account."),
        close("gauge", "a new record locks a few more bytes."),
      ];
    case FAIL:
      return [
        ALL,
        close("slips", "three receipts: the call, the failed fail, the callback."),
        close("scroll", "the count did not change."),
      ];
    case CLEAR:
      return [
        ALL,
        close("gauge", "freed bytes go back to available."),
        close("scroll", "the code stays, so its deposit stays locked."),
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
