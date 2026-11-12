/**
 * Where things stand in lesson 3.2's figure (world units, y up), on the right page of the book. The 2D
 * view draws the same layout from above, so both views agree. Pure: no three.js, unit tested.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import { GASLESS, HOOK, MINT, REGISTER, TRAP } from "./steps";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -3.6, maxX: 3.6, minZ: -2.3, maxZ: 2.5 } as const;

/** Your account, with your token coins beside it. */
export const ME: Vec3 = [-2.5, 0, 0.1];
/** The minting stamp, pressing new tokens into existence. */
export const STAMP: Vec3 = [-0.6, 0, -1.2];
/** The friend's account. */
export const FRIEND: Vec3 = [2.5, 0, 0.1];
/** The storage padlock on the friend's mailbox. */
export const PADLOCK: Vec3 = [2.5, 0, 1.45];
/** The relayer's account (step 5). */
export const RELAYER: Vec3 = [0, 0, 1.4];
/** The signed parcel: beside you before the relayer takes it, at the friend's after delivery. */
export const PARCEL_START: Vec3 = [-1.2, 0, 0.9];
export const PARCEL_END: Vec3 = [1.2, 0, -0.2];

export type Part = "me" | "stamp" | "friend" | "padlock" | "relayer" | "parcel";

/** Which parts a step draws. */
export function partsAt(step: number): Part[] {
  if (step === HOOK || step === MINT) return ["me", "stamp"];
  if (step === TRAP || step === REGISTER) return ["me", "stamp", "friend", "padlock"];
  if (step === GASLESS) return ["me", "friend", "padlock", "relayer", "parcel"];
  return ["me", "stamp", "friend", "padlock"];
}

/** Ground boxes [minX, maxX, minZ, maxZ, height] of each part, for framing and tour shots. */
export function boxOf(part: Part): [number, number, number, number, number] {
  const around = (p: Vec3, w: number, d: number, h: number): [number, number, number, number, number] => [
    p[0] - w,
    p[0] + w,
    p[2] - d,
    p[2] + d,
    h,
  ];
  switch (part) {
    case "me":
      return around(ME, 0.9, 0.7, 2.2);
    case "stamp":
      return around(STAMP, 0.6, 0.6, 1.4);
    case "friend":
      return around(FRIEND, 0.8, 0.6, 2.0);
    case "padlock":
      return around(PADLOCK, 0.5, 0.4, 0.9);
    case "relayer":
      return around(RELAYER, 0.7, 0.6, 1.8);
    case "parcel":
      return [PARCEL_START[0] - 0.6, PARCEL_END[0] + 0.6, PARCEL_END[2] - 0.5, PARCEL_START[2] + 0.5, 1.0];
  }
}

/** True when every part of every step stays inside FIGURE. */
export function figureHolds(step: number): boolean {
  return partsAt(step).every((p) => {
    const [a, b, c, d] = boxOf(p);
    return a >= FIGURE.minX && b <= FIGURE.maxX && c >= FIGURE.minZ && d <= FIGURE.maxZ;
  });
}
