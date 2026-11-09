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
    expect(r.table.minZ).toBeLessThanOrEqual(MAT.z - MAT.depth / 2);
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

  it("pushes the desk against the window wall, with the window just above the desk", () => {
    expect(r.walls.back).toBeLessThan(r.table.minZ);
    expect(r.table.minZ - r.walls.back).toBeLessThan(1);
    expect(r.window.y0).toBeGreaterThan(TOP);
    expect(r.window.y0 - TOP).toBeLessThan(3);
    expect(r.window.y1).toBeLessThan(r.walls.ceiling);
    expect(r.window.x0).toBeLessThanOrEqual(r.table.minX);
    expect(r.window.x1).toBeGreaterThanOrEqual(r.table.maxX);
    expect(r.window.x0).toBeGreaterThan(r.walls.left);
    expect(r.window.x1).toBeLessThan(r.walls.right);
  });

  it("paints the landscape far outside the window, big enough to fill it from any allowed view", () => {
    expect(r.landscape.z).toBeLessThan(r.walls.back - 80);
    expect(r.landscape.x0).toBeLessThan(r.walls.left - 100);
    expect(r.landscape.x1).toBeGreaterThan(r.walls.right + 100);
    expect(r.landscape.y0).toBeLessThan(r.floor - 100);
    expect(r.landscape.y1).toBeGreaterThan(r.walls.ceiling + 50);
  });

  it("stands the desk plant in the back corner on the right, on the desk", () => {
    const [x, z] = r.plant;
    expect(x).toBeGreaterThan(MAT.x + MAT.width / 2);
    expect(x).toBeLessThan(r.table.maxX);
    expect(z).toBeGreaterThan(r.table.minZ);
    expect(z).toBeLessThan(MAT.z);
  });

  it("keeps the side and front walls and the ceiling out of reach of the orbiting camera", () => {
    const reach = ROOM.cameraReach + 2;
    expect(r.walls.front).toBeGreaterThan(MAT.z + reach);
    expect(r.walls.left).toBeLessThan(MAT.x - reach);
    expect(r.walls.right).toBeGreaterThan(MAT.x + reach);
    expect(r.walls.ceiling).toBeGreaterThan(TOP + reach);
  });

  it("keeps the room and the landscape's corners inside the camera's far plane", () => {
    // The furthest camera: reach away from the book, on the reader's side, high up.
    const cam = [MAT.x, TOP + ROOM.cameraReach * 0.8, MAT.z + ROOM.cameraReach * 0.6] as const;
    const corners = [r.landscape.x0, r.landscape.x1].flatMap((x) =>
      [r.landscape.y0, r.landscape.y1].map((y) => [x, y, r.landscape.z] as const),
    );
    for (const [x, y, z] of corners)
      expect(Math.hypot(x - cam[0], y - cam[1], z - cam[2])).toBeLessThan(ROOM.far);
    const room = Math.hypot(
      r.walls.right - r.walls.left,
      r.walls.front - r.walls.back,
      r.walls.ceiling - r.floor,
    );
    expect(room).toBeLessThan(ROOM.far);
  });

  it("grows the table with a bigger mat", () => {
    const big = roomFor({ ...MAT, width: 90 }, TOP);
    expect(big.table.maxX - big.table.minX).toBeGreaterThan(r.table.maxX - r.table.minX);
    expect(big.walls.right).toBeGreaterThan(big.table.maxX);
  });
});
