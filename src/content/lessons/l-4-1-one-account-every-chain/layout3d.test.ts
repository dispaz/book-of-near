import { describe, expect, it } from "vitest";
import {
  beamPoints,
  ETH_AREA,
  ETH_CHAIN,
  ETH_MAILBOX,
  FIGURE,
  inEthArea,
  NEAR_MAILBOX,
  nodeSpots,
  PARCEL_AT,
  PARCEL_ETH,
  PARCEL_HOME,
  PARCEL_WAIT,
  RING_CENTER,
  RING_RADIUS,
  shareSpot,
  SIGNER,
} from "./layout3d";
import { NODES } from "./signing";
import type { Vec3 } from "../../../scene-kit/motion";

const inside = ([x, , z]: Vec3, margin = 0.5) =>
  x - margin >= FIGURE.minX &&
  x + margin <= FIGURE.maxX &&
  z - margin >= FIGURE.minZ &&
  z + margin <= FIGURE.maxZ;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

describe("lesson 4.1 layout", () => {
  it("keeps every object inside the figure box, with room for its size", () => {
    for (const p of [NEAR_MAILBOX, ETH_MAILBOX, PARCEL_HOME, PARCEL_WAIT, PARCEL_ETH, ETH_CHAIN])
      expect(inside(p), String(p)).toBe(true);
    for (const s of nodeSpots()) expect(inside(s.position, 0.4), String(s.position)).toBe(true);
    expect(ETH_AREA.minX).toBeGreaterThanOrEqual(FIGURE.minX);
    expect(ETH_AREA.maxX).toBeLessThanOrEqual(FIGURE.maxX);
    expect(ETH_AREA.minZ).toBeGreaterThanOrEqual(FIGURE.minZ);
    expect(ETH_AREA.maxZ).toBeLessThanOrEqual(FIGURE.maxZ);
  });

  it("splits the page: the NEAR side stays out of the Ethereum area, the Ethereum things stand in it", () => {
    for (const p of [NEAR_MAILBOX, PARCEL_HOME, PARCEL_WAIT, RING_CENTER])
      expect(inEthArea(p), String(p)).toBe(false);
    // The ring's nodes (and their desks) stay clear of the area's border.
    for (const s of nodeSpots()) expect(s.position[0] + 0.4).toBeLessThan(ETH_AREA.minX);
    // The address, the delivered parcel and the chain stand inside, clear of the dashed border.
    expect(inEthArea(ETH_MAILBOX, 0.5)).toBe(true);
    expect(inEthArea(PARCEL_ETH, 0.5)).toBe(true);
    expect(inEthArea(ETH_CHAIN, 0.4)).toBe(true);
    // The chain stands along the back edge, behind the address and the parcel.
    expect(ETH_CHAIN[2]).toBeLessThan(ETH_MAILBOX[2] - 1);
    expect(ETH_CHAIN[2]).toBeLessThan(PARCEL_ETH[2] - 1);
  });

  it("the parcel's spots: by the NEAR mailbox, in the ring, inside the area", () => {
    expect(PARCEL_AT.near).toBe(PARCEL_HOME);
    expect(PARCEL_AT.signer).toBe(PARCEL_WAIT);
    expect(PARCEL_AT.ethereum).toBe(PARCEL_ETH);
    expect(dist(PARCEL_HOME, NEAR_MAILBOX)).toBeLessThan(1.6);
    expect(dist(PARCEL_ETH, ETH_MAILBOX)).toBeGreaterThan(1.2);
  });

  it("puts the nodes evenly on a ring round the signer, each facing the middle", () => {
    const spots = nodeSpots();
    expect(spots).toHaveLength(NODES);
    for (const s of spots) {
      expect(dist(s.position, RING_CENTER)).toBeCloseTo(RING_RADIUS, 5);
      // A node at the back (smaller z) faces +z, toward the middle.
      const toMiddle = Math.atan2(RING_CENTER[0] - s.position[0], RING_CENTER[2] - s.position[2]);
      expect(s.facing).toBeCloseTo(toMiddle, 5);
    }
    // Neighbours are far enough apart for their desks.
    expect(dist(spots[0]!.position, spots[1]!.position)).toBeGreaterThan(0.9);
  });

  it("keeps the waiting parcel inside the ring and gathers the shares between the nodes, off the contract", () => {
    expect(dist(PARCEL_WAIT, RING_CENTER)).toBeLessThan(RING_RADIUS - 0.4);
    expect(dist(NEAR_MAILBOX, RING_CENTER)).toBeGreaterThan(RING_RADIUS + 0.8);
    const spots = nodeSpots();
    for (let i = 0; i < 6; i++) {
      const s = shareSpot(i);
      // Inside the ring, clear of the signer contract and of the waiting parcel...
      expect(dist(s, RING_CENTER)).toBeLessThan(RING_RADIUS - 0.3);
      expect(dist(s, SIGNER)).toBeGreaterThan(0.5);
      expect(dist(s, PARCEL_WAIT)).toBeGreaterThan(0.5);
      // ...and not on top of a node.
      for (const n of spots) expect(dist(s, n.position)).toBeGreaterThan(0.4);
    }
  });

  it("runs the beam from the NEAR mailbox, through the ring, into the area to the address", () => {
    const pts = beamPoints();
    expect(pts[0]![0]).toBeLessThan(RING_CENTER[0]);
    expect(dist(pts[1]!, RING_CENTER)).toBeLessThan(0.01);
    expect(inEthArea(pts[pts.length - 1]!)).toBe(true);
    expect(dist(pts[pts.length - 1]!, ETH_MAILBOX)).toBeLessThan(0.5);
  });
});
