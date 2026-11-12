/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { BACKING, CHECK, COMPARE, CONFIDENTIAL, EXPLOIT, HONEST, HOOK } from "./steps";

export { CHECK, HONEST };

/** What a tour shot looks at. */
export type Target =
  | { kind: "all" }
  | { kind: "vault" }
  | { kind: "slip" }
  | { kind: "trackA" }
  | { kind: "trackB" }
  | { kind: "mailbox" }
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
        shot("vault", "the bridge vault, full of locked coins."),
        shot("trackB", "the NEAR way, in front."),
      ];
    case COMPARE:
      return [
        ALL,
        shot("trackA", "six steps on the old bridge."),
        shot("trackB", "two steps for an intent."),
      ];
    case BACKING:
      return [
        ALL,
        shot("slip", "wUSDC, an IOU tied to the vault."),
        shot("mailbox", "native USDC in your mailbox."),
      ];
    case EXPLOIT:
      return [
        ALL,
        shot("vault", "the vault after the simulated exploit."),
        shot("slip", "the IOU without backing."),
      ];
    case CONFIDENTIAL:
    default:
      return [ALL, shot("parcel", "your intent behind its shield.")];
  }
}
