/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { partsAt, type Part } from "./layout3d";
import { COMPARE, CONCEPT, CREATE, HOOK, PICK } from "./useClaim";

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
      return [ALL, close("me", "your practice account. Its id is 64 hex characters.")];
    case CONCEPT:
      return [
        ALL,
        close("registrar", "the registrar, a contract named testnet. It makes .testnet names."),
        close("new", "a dashed mailbox: your new account, not created yet."),
      ];
    case PICK:
      return [ALL, close("new", "the name you type goes on this mailbox.")];
    case CREATE:
      return [
        ALL,
        close("registrar", "one transaction asks the registrar to create your name."),
        close("new", "the new account gets 0.1 NEAR and your key."),
      ];
    case COMPARE:
      return [
        ALL,
        close("named", "the named account. The registrar made it, so it exists."),
        close("hex", "the hex id of the same key. It exists only once someone sends it NEAR."),
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
