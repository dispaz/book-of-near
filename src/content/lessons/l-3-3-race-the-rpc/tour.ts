/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { partsAt, type Part } from "./layout3d";
import { ARCHIVE, CHECK, FAILOVER, HOOK, OUTAGE, RACE } from "./steps";

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
        close("windows", "three counter windows, three RPC providers."),
        close("mailbox", "your app. It talks to the chain only through these windows."),
      ];
    case RACE:
      return [ALL, close("bars", "one bar per provider: the taller, the slower.")];
    case OUTAGE:
      return [ALL, close("windows", "FastNEAR's window, first in your app's list.")];
    case FAILOVER:
      return [
        ALL,
        close("windows", "the client skips the closed window and asks the next one."),
        close("mailbox", "your app still gets its answer."),
      ];
    case ARCHIVE:
      return [ALL, close("archive", "a regular node's shutter is down; the archival node has the block.")];
    default:
      return [];
  }
}

/** True when every shot of the step looks at something the step draws. */
export function shotsDrawn(step: number): boolean {
  const drawn = partsAt(step);
  return tourFor(step).every((s) => s.target.kind === "all" || drawn.includes(s.target.kind));
}
