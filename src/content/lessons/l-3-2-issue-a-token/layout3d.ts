/**
 * Where things stand in lesson 3.2's figure (world units, y up), on the right page of the book. The 2D
 * view draws the same layout from above, so both views agree. Pure: no three.js, unit tested.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import { GASLESS, HOOK, MINT, REGISTER, TRAP } from "./steps";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -3.2, maxX: 3.2, minZ: -2.0, maxZ: 2.3 } as const;

/** Your account. */
export const ME: Vec3 = [-2.2, 0, 0];
/** The minting stamp, pressing new tokens into existence. */
export const STAMP: Vec3 = [-0.2, 0, -1.0];
/** The friend's account. */
export const FRIEND: Vec3 = [2.2, 0, 0];
/** The storage padlock on the friend's mailbox. */
export const PADLOCK: Vec3 = [2.2, 0, 1.3];
/** The relayer's account (step 5). */
export const RELAYER: Vec3 = [0, 0, 1.4];
/** A token stack stands in front of its mailbox, a little to the side. */
export const stackBy = (p: Vec3, side: 1 | -1): Vec3 => [p[0] + 0.85 * side, 0, p[2] + 0.55];
/** The signed parcel: behind the relayer before it is sent, at the friend's side after delivery. */
export const PARCEL_START: Vec3 = [-0.6, 0, -0.8];
export const PARCEL_END: Vec3 = [1.0, 0, -0.8];

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
      return [ME[0] - 0.8, ME[0] + 1.2, ME[2] - 0.6, ME[2] + 0.9, 2.2];
    case "stamp":
      return around(STAMP, 0.6, 0.6, 1.4);
    case "friend":
      return [FRIEND[0] - 1.2, FRIEND[0] + 0.8, FRIEND[2] - 0.6, FRIEND[2] + 0.9, 2.0];
    case "padlock":
      return around(PADLOCK, 0.5, 0.4, 0.9);
    case "relayer":
      return around(RELAYER, 0.7, 0.6, 1.8);
    case "parcel":
      return [PARCEL_START[0] - 0.6, PARCEL_END[0] + 0.6, PARCEL_START[2] - 0.5, PARCEL_START[2] + 0.5, 1.0];
  }
}

/** True when every part of every step stays inside FIGURE. */
export function figureHolds(step: number): boolean {
  return partsAt(step).every((p) => {
    const [a, b, c, d] = boxOf(p);
    return a >= FIGURE.minX && b <= FIGURE.maxX && c >= FIGURE.minZ && d <= FIGURE.maxZ;
  });
}
