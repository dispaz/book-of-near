/**
 * Where things stand in lesson 3.1's figure (world units, y up), on the right page of the book. The 2D
 * view draws the same layout from above, so both views agree. Pure: no three.js, unit tested.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import { CALL, CLEAR, DEPLOY, FAIL, HOOK, WASM } from "./steps";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -3.6, maxX: 3.6, minZ: -2.3, maxZ: 2.5 } as const;

/** The learner's account (the parent). */
export const PARENT: Vec3 = [-2.6, 0, 0.1];
/** The contract's sub-account, beside the parent on the same post line. */
export const SUB: Vec3 = [-0.6, 0, 0.4];
/** The contract: a scroll with a gear. */
export const SCROLL: Vec3 = [0.8, 0, -0.5];
/** The balance gauge: a flat bar across the front of the page. */
export const GAUGE = { center: [0, 0, 1.85] as Vec3, length: 5.2, depth: 0.42 };
/** Step 5's receipts: one slip per receipt, top to bottom, right of the scroll. */
export const SLIPS: Vec3[] = [
  [2.8, 0, -1.6],
  [2.8, 0, -0.5],
  [2.8, 0, 0.6],
];

export type Part = "parent" | "sub" | "scroll" | "gauge" | "slips";

/** Which parts a step draws (only what the step frames, so nothing hangs out under the panels). */
export function partsAt(step: number): Part[] {
  if (step === HOOK || step === WASM) return ["parent", "sub", "scroll"];
  if (step === DEPLOY || step === CALL || step === CLEAR) return ["parent", "sub", "scroll", "gauge"];
  if (step === FAIL) return ["parent", "sub", "scroll", "gauge", "slips"];
  return ["parent", "sub", "scroll", "gauge"];
}

/** Ground boxes [minX, maxX, minZ, maxZ, height] of each part, for framing and tour shots. */
export function boxOf(part: Part): [number, number, number, number, number] {
  switch (part) {
    case "parent":
      return [PARENT[0] - 0.7, PARENT[0] + 0.7, PARENT[2] - 0.6, PARENT[2] + 0.6, 2.2];
    case "sub":
      return [SUB[0] - 0.6, SUB[0] + 0.6, SUB[2] - 0.5, SUB[2] + 0.5, 1.8];
    case "scroll":
      return [SCROLL[0] - 0.8, SCROLL[0] + 0.8, SCROLL[2] - 0.5, SCROLL[2] + 0.5, 2.0];
    case "gauge":
      return [
        GAUGE.center[0] - GAUGE.length / 2,
        GAUGE.center[0] + GAUGE.length / 2,
        GAUGE.center[2] - 0.5,
        GAUGE.center[2] + 0.6,
        0.6,
      ];
    case "slips":
      return [SLIPS[0]![0] - 0.7, SLIPS[0]![0] + 0.7, SLIPS[0]![2] - 0.5, SLIPS[2]![2] + 0.5, 1.0];
  }
}
