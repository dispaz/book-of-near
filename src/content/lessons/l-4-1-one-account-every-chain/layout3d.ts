/**
 * Where things stand in lesson 4.1 (world units, y up, z toward the reader), on the right page of the
 * book. The page is split in two. Left, the NEAR side: the learner's mailbox and the signer contract (a
 * scroll) in a ring of signing nodes. Right, the Ethereum side: a marked area on the paper with a short
 * chain of blocks along its back edge; the derived address (a mailbox) grows inside it, and the signed
 * transaction (a parcel) is delivered into it. The 2D view draws the same plan from above. Pure, so it is
 * unit tested and never pulls three.js into the 2D view.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import { NODES, type ParcelSpot } from "./signing";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.6, maxX: 4.6, minZ: -2.6, maxZ: 2.4 } as const;

// ---------- the NEAR side ----------

/** In front of the ring's left side, so its name stays clear of the nodes. */
export const NEAR_MAILBOX: Vec3 = [-3.75, 0, 1.3];
export const RING_CENTER: Vec3 = [-1.25, 0, -0.2];
export const RING_RADIUS = 1.35;
/** The signer contract stands in the middle of the ring. */
export const SIGNER: Vec3 = RING_CENTER;
/** Where the parcel waits while the nodes sign: in the ring, in front of the scroll. */
export const PARCEL_WAIT: Vec3 = [RING_CENTER[0], 0, RING_CENTER[2] + 0.75];
/** Where the transaction is packed (step 3) and comes back to once signed (step 4): by your mailbox. */
export const PARCEL_HOME: Vec3 = [-2.5, 0, 1.9];

// ---------- the Ethereum side ----------

/** The Ethereum (Sepolia) area on the paper: the right part of the page. */
export const ETH_AREA = { minX: 0.55, maxX: 4.5, minZ: -2.5, maxZ: 2.3 } as const;
export const ETH_AREA_CENTER: Vec3 = [
  (ETH_AREA.minX + ETH_AREA.maxX) / 2,
  0,
  (ETH_AREA.minZ + ETH_AREA.maxZ) / 2,
];
/** The chain of blocks along the area's back edge. */
export const ETH_CHAIN: Vec3 = [ETH_AREA_CENTER[0], 0, ETH_AREA.minZ + 0.55];
/** Blocks in that chain. */
export const ETH_BLOCKS = 3;
/** The derived address, inside the area. */
export const ETH_MAILBOX: Vec3 = [1.7, 0, 0.35];
/** Where the signed transaction is delivered (step 5): inside the area, beside the address. */
export const PARCEL_ETH: Vec3 = [3.35, 0, 0.45];

/** Where the parcel stands, by spot. */
export const PARCEL_AT: Record<ParcelSpot, Vec3> = {
  near: PARCEL_HOME,
  signer: PARCEL_WAIT,
  ethereum: PARCEL_ETH,
};

/** Is a point (x, z) inside the Ethereum area, `margin` clear of its border? */
export const inEthArea = ([x, , z]: Vec3, margin = 0) =>
  x - margin >= ETH_AREA.minX &&
  x + margin <= ETH_AREA.maxX &&
  z - margin >= ETH_AREA.minZ &&
  z + margin <= ETH_AREA.maxZ;

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

/**
 * Where the nodes combine their shares: a spot in the ring, between the nodes and clear of the signer
 * contract. The nodes work together off chain; the contract only gets the finished signature, which drops
 * from here to the parcel. In plan (x, z) for 2D; `y` is its height in 3D.
 */
export const SHARE_MEET: Vec3 = [RING_CENTER[0] + 0.78, 1.0, RING_CENTER[2] + 0.2];

/** Where share `i` lands while the signature comes together: a small stack at the meeting spot. */
export function shareSpot(i: number): Vec3 {
  return [SHARE_MEET[0] + ((i % 2) - 0.5) * 0.3, SHARE_MEET[1] + Math.floor(i / 2) * 0.1, SHARE_MEET[2]];
}

/** Points of the beam: NEAR mailbox → through the ring's middle → into the area, to the address. */
export function beamPoints(): Vec3[] {
  return [
    [NEAR_MAILBOX[0] + 0.4, 1.0, NEAR_MAILBOX[2]],
    [RING_CENTER[0], 1.5, RING_CENTER[2]],
    [ETH_AREA.minX + 0.1, 1.2, ETH_MAILBOX[2] - 0.1],
    [ETH_MAILBOX[0] - 0.35, 1.0, ETH_MAILBOX[2]],
  ];
}
