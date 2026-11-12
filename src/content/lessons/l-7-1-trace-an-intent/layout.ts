/**
 * Where things stand in lesson 7.1 (world units, y up, z toward the reader), on the right page of the
 * book. The intent's trail runs left to right: your mailbox and key (front left), two shard ribbons
 * (back middle: your shard, then the verifier's), the verifier scroll (back right), the signing nodes
 * (front right) and where the USDC lands (far right). The 2D view draws the same plan from above. Pure.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import type { Spot } from "./trail";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.6, maxX: 4.6, minZ: -2.6, maxZ: 2.4 } as const;

export const ACCOUNT: Vec3 = [-3.9, 0, 1.1];
export const KEY: Vec3 = [-2.2, 0, 1.5];

/** The two shard ribbons: yours (front) and the verifier's (back). */
export const RIBBON = { length: 3.6, width: 0.85, x: 0.2 } as const;
export const SHARD_Z = { mine: -0.5, verifier: -1.7 } as const;

export const VERIFIER: Vec3 = [3.0, 0, -1.6];
export const SIGNERS: Vec3[] = [
  [0.9, 0, 1.5],
  [1.9, 0, 0.8],
  [2.9, 0, 1.5],
];
export const SIGNERS_CENTER: Vec3 = [1.9, 0, 1.2];
export const DESTINATION: Vec3 = [4.0, 0, 0.3];

/** The moving piece (the parcel, later the receipt), by spot. */
export const SPOT_AT: Record<Spot, Vec3> = {
  home: [-2.6, 0, 0.0],
  shardA: [0.6, 0, SHARD_Z.mine],
  shardB: [1.3, 0, SHARD_Z.verifier],
  verifier: [2.2, 0, -0.8],
  signers: [1.9, 0, 2.0],
};
