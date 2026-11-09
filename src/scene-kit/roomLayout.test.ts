import { describe, expect, it } from "vitest";
import { ROOM, roomFor } from "./roomLayout";

/** The felt mat lesson 0.1's spread puts on the desk: x, z of its centre and its size. */
const MAT = { x: 2, z: 9, width: 30, depth: 36 };
const TOP = -0.5;

describe("roomFor", () => {
  const r = roomFor(MAT, TOP);

  it("puts a table under the whole felt mat, with wood showing round it", () => {
    expect(r.table.minX).toBeLessThanOrEqual(MAT.x - MAT.width / 2 - 4);
    expect(r.table.maxX).toBeGreaterThanOrEqual(MAT.x + MAT.width / 2 + 4);
    expect(r.table.minZ).toBeLessThanOrEqual(MAT.z - MAT.depth / 2 - 4);
    expect(r.table.maxZ).toBeGreaterThanOrEqual(MAT.z + MAT.depth / 2 + 2);
    expect(r.top).toBe(TOP);
  });

  it("is a real table: never smaller than a desk, standing on four legs inside its top", () => {
    expect(r.table.maxX - r.table.minX).toBeGreaterThanOrEqual(ROOM.minTable[0]);
    expect(r.table.maxZ - r.table.minZ).toBeGreaterThanOrEqual(ROOM.minTable[1]);
    expect(r.legs).toHaveLength(4);
    for (const [x, z] of r.legs) {
      expect(x).toBeGreaterThan(r.table.minX);
      expect(x).toBeLessThan(r.table.maxX);
      expect(z).toBeGreaterThan(r.table.minZ);
      expect(z).toBeLessThan(r.table.maxZ);
    }
  });

  it("stands the table on a floor one table height below the top", () => {
    expect(r.floor).toBeCloseTo(TOP - ROOM.tableHeight);
  });

  it("keeps every wall and the ceiling out of reach of the orbiting camera", () => {
    const reach = ROOM.cameraReach + 2;
    expect(r.walls.back).toBeLessThan(MAT.z - reach);
    expect(r.walls.front).toBeGreaterThan(MAT.z + reach);
    expect(r.walls.left).toBeLessThan(MAT.x - reach);
    expect(r.walls.right).toBeGreaterThan(MAT.x + reach);
    expect(r.walls.ceiling).toBeGreaterThan(TOP + reach);
  });

  it("keeps the far corners inside the camera's far plane", () => {
    const far = Math.hypot(
      Math.max(r.walls.right - MAT.x, MAT.x - r.walls.left) + ROOM.cameraReach,
      Math.max(r.walls.front - MAT.z, MAT.z - r.walls.back) + ROOM.cameraReach,
      r.walls.ceiling - r.floor,
    );
    expect(far).toBeLessThan(ROOM.far);
  });

  it("grows the table with a bigger mat", () => {
    const big = roomFor({ ...MAT, width: 90 }, TOP);
    expect(big.table.maxX - big.table.minX).toBeGreaterThan(r.table.maxX - r.table.minX);
    expect(big.walls.right).toBeGreaterThan(big.table.maxX);
  });
});
