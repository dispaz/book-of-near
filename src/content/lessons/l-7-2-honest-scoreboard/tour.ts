/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { dimForStep, dimOf } from "./board";
import { CHECK, MYTH } from "./steps";

export { CHECK };

export type Target = { kind: "all" } | { kind: "pillars" } | { kind: "cards" } | { kind: "near" };

const ALL: Shot<Target> = { caption: "The whole board.", target: { kind: "all" } };

export function tourFor(step: number): Shot<Target>[] {
  if (step >= CHECK) return [];
  if (step === MYTH)
    return [
      ALL,
      {
        caption: "Close up: four pillars, all the same height. No chain wins at everything.",
        target: { kind: "pillars" },
      },
      { caption: "Close up: NEAR's pillar, one design among four.", target: { kind: "near" } },
    ];
  const dim = dimOf(dimForStep(step)!);
  return [
    ALL,
    {
      caption: `Close up: the ${dim.title} card, the dimension this step compares.`,
      target: { kind: "cards" },
    },
    { caption: `Close up: the pillars rise or sink on ${dim.short}.`, target: { kind: "pillars" } },
  ];
}
