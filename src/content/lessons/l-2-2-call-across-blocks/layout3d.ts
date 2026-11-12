/**
 * Where things stand in lesson 2.2's figure (world units, y up), on the right page of the book. The 2D
 * view draws the same layout from above, so both views agree. Pure: no three.js, unit tested.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import { FAIL, GAS, HOOK, HOP, ORDER } from "./steps";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -3.8, maxX: 3.8, minZ: -2.4, maxZ: 2.95 } as const;

/** Contract A, the caller (a scroll), and contract B, the called contract. */
export const A: Vec3 = [-2.4, 0, -1.25];
export const B: Vec3 = [2.4, 0, -1.25];
/** Step 2's single action receipt, between the two contracts. */
export const SLIP: Vec3 = [0, 0, -1.0];
/** The block row: one column per block, time running left to right. */
export const COLUMNS = [-2.85, -0.95, 0.95, 2.85] as const;
export const ROW_Z = 0.45;
export const BLOCK_Z = 1.1;
/** Step 4's gas meter: a flat bar across the front of the page. */
export const METER = { center: [0, 0, 2.4] as Vec3, length: 6, depth: 0.4 };

export type Part = "contracts" | "slip" | "blocks" | "meter";

/** Which parts a step draws (only what the step frames, so nothing hangs out under the panels). */
export function partsAt(step: number): Part[] {
  if (step === HOOK) return ["contracts"];
  if (step === HOP) return ["contracts", "slip"];
  if (step === ORDER || step === FAIL) return ["contracts", "blocks"];
  if (step === GAS) return ["contracts", "blocks", "meter"];
  return ["contracts", "blocks"];
}

/** Ground boxes [minX, maxX, minZ, maxZ, height] of each part, for framing and tour shots. */
export function boxOf(part: Part): [number, number, number, number, number] {
  switch (part) {
    case "contracts":
      return [A[0] - 0.9, B[0] + 0.9, A[2] - 0.6, A[2] + 0.8, 2.0];
    case "slip":
      return [SLIP[0] - 0.8, SLIP[0] + 0.8, SLIP[2] - 0.5, SLIP[2] + 0.6, 1.0];
    case "blocks":
      return [COLUMNS[0] - 0.7, COLUMNS[3] + 0.7, ROW_Z - 0.5, BLOCK_Z + 0.4, 1.0];
    case "meter":
      return [
        METER.center[0] - METER.length / 2,
        METER.center[0] + METER.length / 2,
        METER.center[2] - 0.5,
        METER.center[2] + 0.5,
        0.6,
      ];
  }
}
