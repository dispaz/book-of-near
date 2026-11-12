/**
 * Where things stand in lesson 4.3 (world units, y up, z toward the reader), on the right page of the
 * book. Two tracks, left to right. Behind, path A, the old bridge: the vault, six step tiles, the wUSDC
 * slip. In front, path B, the NEAR way: your intent (a parcel, with the confidential shield beside it),
 * two step tiles, the native USDC coin and your mailbox on the other chain. The 2D view draws the same
 * plan from above. Pure.
 */
import type { Vec3 } from "../../../scene-kit/motion";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.6, maxX: 4.6, minZ: -2.7, maxZ: 2.5 } as const;

export const TRACK_A_Z = -1.15;
export const TRACK_B_Z = 1.35;

// ---------- path A: the old bridge ----------
export const VAULT: Vec3 = [-3.3, 0, TRACK_A_Z];
export const SLIP: Vec3 = [3.4, 0, TRACK_A_Z];
/** The six step tiles between the vault and the slip. */
export const BRIDGE_TILES: Vec3[] = Array.from(
  { length: 6 },
  (_, i) => [-2.05 + i * 0.85, 0, TRACK_A_Z + 0.35] as Vec3,
);

// ---------- path B: the NEAR way ----------
export const PARCEL: Vec3 = [-3.4, 0, TRACK_B_Z];
export const SHIELD: Vec3 = [-2.2, 0, TRACK_B_Z - 0.35];
export const MAILBOX: Vec3 = [3.3, 0, TRACK_B_Z];
/** The two step tiles: sign the intent, the solver delivers. */
export const INTENT_TILES: Vec3[] = [
  [-1.2, 0, TRACK_B_Z + 0.35],
  [0.1, 0, TRACK_B_Z + 0.35],
];
/** The native USDC coin: with the solver, then beside your mailbox. */
export const COIN_AT = {
  solver: [1.25, 0, TRACK_B_Z] as Vec3,
  delivered: [2.35, 0, TRACK_B_Z + 0.55] as Vec3,
};
