/**
 * Where things stand in lesson 4.1 (world units, y up, z toward the reader), on the right page of the
 * book. Left: the learner's NEAR mailbox. Middle: the signer contract (a scroll) in a ring of signing
 * nodes. Right: three other chains as rows of block pages, and in front of Ethereum the derived
 * address (a mailbox) with the transaction (a parcel) beside it. The 2D view draws the same plan from
 * above. Pure, so it is unit tested and never pulls three.js into the 2D view.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import { NODES } from "./signing";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.4, maxX: 4.4, minZ: -3.1, maxZ: 2.4 } as const;

export const NEAR_MAILBOX: Vec3 = [-3.5, 0, 0.8];
export const RING_CENTER: Vec3 = [-0.6, 0, -0.1];
export const RING_RADIUS = 1.45;
/** The signer contract stands in the middle of the ring. */
export const SIGNER: Vec3 = RING_CENTER;
/** Where the parcel waits while the nodes sign: in the ring, in front of the scroll. */
export const PARCEL_WAIT: Vec3 = [RING_CENTER[0], 0, RING_CENTER[2] + 0.75];

export type ChainKey = "ethereum" | "bitcoin" | "solana";
export const LEDGERS: Record<ChainKey, Vec3> = {
  solana: [3.1, 0, -2.55],
  bitcoin: [3.1, 0, -1.25],
  ethereum: [3.1, 0, 0.05],
};
export const ETH_MAILBOX: Vec3 = [1.85, 0, 1.55];
/** Where the transaction stands once packed, and comes back to once signed. */
export const PARCEL_HOME: Vec3 = [3.45, 0, 1.65];

/** The ring's nodes, evenly round the signer, the first one at the back. Each faces the middle. */
export function nodeSpots(n = NODES): { position: Vec3; facing: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI + (i / n) * Math.PI * 2;
    const x = RING_CENTER[0] + Math.sin(a) * RING_RADIUS;
    const z = RING_CENTER[2] + Math.cos(a) * RING_RADIUS;
    // Turn the node (its desk faces +z) toward the middle.
    return { position: [x, 0, z] as Vec3, facing: Math.atan2(RING_CENTER[0] - x, RING_CENTER[2] - z) };
  });
}

/** Points of the beam: NEAR mailbox → through the ring's middle → the derived address. */
export function beamPoints(): Vec3[] {
  return [
    [NEAR_MAILBOX[0] + 0.4, 1.0, NEAR_MAILBOX[2]],
    [RING_CENTER[0], 1.5, RING_CENTER[2]],
    [ETH_MAILBOX[0] - 0.4, 1.0, ETH_MAILBOX[2]],
  ];
}
