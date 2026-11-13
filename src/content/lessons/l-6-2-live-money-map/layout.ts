/**
 * Where things stand in lesson 6.2 (world units, y up, z toward the reader), on the right page of the
 * book: the oracle booth (back left), the NEAR Intents area (back middle), the Rhea Lend ledger (back
 * right), the USDC mailbox (front left) and the two Rhea pools, stable and simple (front middle and
 * right). The 2D view draws the same plan from above. Pure.
 */
import type { Vec3 } from "../../../scene-kit/motion";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.2, maxX: 4.2, minZ: -2.5, maxZ: 2.3 } as const;

export const ORACLE_AT: Vec3 = [-3.0, 0, -1.3];
export const INTENTS_AT = { x: 0.1, z: -1.45, width: 2.8, depth: 1.8 } as const;
export const LEND_AT: Vec3 = [3.1, 0, -1.3];
export const USDC_AT: Vec3 = [-2.75, 0, 1.3];
export const STABLE_AT: Vec3 = [-0.4, 0, 1.3];
export const SIMPLE_AT: Vec3 = [2.3, 0, 1.3];
/** A pool basin's radius. */
export const POOL_R = 0.75;
