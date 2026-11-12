/**
 * Where things stand in lesson 4.2 (world units, y up, z toward the reader), on the right page of the
 * book. Left, NEAR: your mailbox and the verifier contract (a scroll, intents.near). Middle: three
 * solvers at their desks, the winner in front. Right, Arbitrum: a marked area with its chain along the
 * back edge and your Arbitrum mailbox. The 2D view draws the same plan from above. Pure.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import type { ParcelSpot } from "./swap";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.6, maxX: 4.6, minZ: -2.6, maxZ: 2.4 } as const;

// ---------- NEAR ----------
export const ORIGIN: Vec3 = [-3.75, 0, 1.2];
export const VERIFIER: Vec3 = [-3.5, 0, -1.4];

// ---------- the solvers ----------
/** The winning solver, in front of the other two. */
export const WINNER: Vec3 = [-0.75, 0, -0.35];
export const SOLVERS: Vec3[] = [[-1.6, 0, -1.8], [0.1, 0, -1.8], WINNER];
export const WINNER_INDEX = 2;

// ---------- Arbitrum ----------
export const ARB_AREA = { minX: 0.85, maxX: 4.5, minZ: -2.5, maxZ: 2.3 } as const;
export const ARB_CENTER: Vec3 = [(ARB_AREA.minX + ARB_AREA.maxX) / 2, 0, (ARB_AREA.minZ + ARB_AREA.maxZ) / 2];
export const ARB_BLOCKS = 3;
export const DESTINATION: Vec3 = [2.55, 0, 0.45];

// ---------- what moves ----------
/** Your intent (a parcel carrying your NEAR), by spot. */
export const PARCEL_AT: Record<ParcelSpot, Vec3> = {
  home: [-2.45, 0, 1.75],
  solver: [-1.75, 0, 0.35],
  verifier: [-2.45, 0, -1.0],
};
/** The USDC coins: under the winner's desk, then beside your Arbitrum mailbox. */
export const COINS_AT = { solver: [-0.2, 0, -0.1] as Vec3, destination: [3.55, 0, 0.55] as Vec3 };
