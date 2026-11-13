/**
 * Where things stand in lesson 6.1 (world units, y up, z toward the reader), on the right page of the
 * book: the staking pool's mailbox (front left), the veNEAR gauge (back left), the proposal scroll (back
 * right) with its quorum bar in front of it, and the two ballot stamps (front right). The 2D view draws
 * the same plan from above. Pure.
 */
import type { Vec3 } from "../../../scene-kit/motion";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.2, maxX: 4.2, minZ: -2.4, maxZ: 2.2 } as const;

export const POOL: Vec3 = [-3.2, 0, 1.3];
export const GAUGE: Vec3 = [-1.5, 0, -1.3];
export const SCROLL: Vec3 = [1.4, 0, -1.5];
/** The quorum bar: a strip on the page in front of the scroll. */
export const QUORUM = { x: 1.4, z: 0.05, length: 3.6, width: 0.32 } as const;
export const STAMPS = { yes: [0.7, 0, 1.6] as Vec3, no: [2.6, 0, 1.6] as Vec3 } as const;
export const STAMPS_CENTER: Vec3 = [1.65, 0, 1.6];

/** The gauge: how tall its column stands per 1× of voting power. */
export const GAUGE_UNIT = 0.45;
