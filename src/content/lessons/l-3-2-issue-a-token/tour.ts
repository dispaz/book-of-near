/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { partsAt, type Part } from "./layout3d";
import { GASLESS, HOOK, MINT, REGISTER, TRAP } from "./steps";

/** What a tour shot looks at: the whole figure or one part of it. */
export type Target = { kind: "all" } | { kind: Part };

const ALL: Shot<Target> = { caption: "The whole page.", target: { kind: "all" } };
const close = (kind: Part, caption: string): Shot<Target> => ({ caption: `Close up: ${caption}`, target: { kind } });

/** The tour for a step: the whole figure first, then close-ups. None at the check and honest take. */
export function tourFor(step: number): Shot<Target>[] {
  switch (step) {
    case HOOK:
      return [ALL, close("stamp", "the minting stamp, ready to make new tokens."), close("me", "your account.")];
    case MINT:
      return [ALL, close("me", "your account holds the whole supply."), close("stamp", "the token's details.")];
    case TRAP:
      return [ALL, close("padlock", "locked: your friend has no balance record."), close("friend", "nothing arrived.")];
    case REGISTER:
      return [ALL, close("padlock", "the storage deposit opens it."), close("friend", "now registered.")];
    case GASLESS:
      return [
        ALL,
        close("relayer", "the relayer pays the gas."),
        close("parcel", "your signed transfer, carried by the relayer."),
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
