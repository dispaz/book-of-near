import { describe, expect, it } from "vitest";
import {
  ETH_MAILBOX,
  FIGURE,
  LEDGERS,
  NEAR_MAILBOX,
  nodeSpots,
  PARCEL_HOME,
  PARCEL_WAIT,
  RING_CENTER,
  RING_RADIUS,
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
    for (const p of [NEAR_MAILBOX, ETH_MAILBOX, PARCEL_HOME, PARCEL_WAIT, ...Object.values(LEDGERS)])
      expect(inside(p), String(p)).toBe(true);
    for (const s of nodeSpots()) expect(inside(s.position, 0.4), String(s.position)).toBe(true);
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

  it("keeps the waiting parcel inside the ring and clear of the other objects", () => {
    expect(dist(PARCEL_WAIT, RING_CENTER)).toBeLessThan(RING_RADIUS - 0.4);
    expect(dist(PARCEL_HOME, ETH_MAILBOX)).toBeGreaterThan(1);
    expect(dist(NEAR_MAILBOX, RING_CENTER)).toBeGreaterThan(RING_RADIUS + 0.8);
    expect(dist(LEDGERS.ethereum, ETH_MAILBOX)).toBeGreaterThan(1.2);
  });
});
