import { describe, expect, it } from "vitest";
import { ROOM, roomFor } from "./roomLayout";

/** The desk area lesson 0.1's spread asks for: x, z of its centre and its size. */
const MAT = { x: 2, z: 9, width: 30, depth: 36 };
const TOP = -0.5;

describe("roomFor", () => {
  const r = roomFor(MAT, TOP);

  it("puts a desk under the whole desk area, with wood showing round it", () => {
    expect(r.table.minX).toBeLessThanOrEqual(MAT.x - MAT.width / 2 - 4);
    expect(r.table.maxX).toBeGreaterThanOrEqual(MAT.x + MAT.width / 2 + 4);
    expect(r.table.minZ).toBeLessThanOrEqual(MAT.z - MAT.depth / 2);
    expect(r.table.maxZ).toBeGreaterThanOrEqual(MAT.z + MAT.depth / 2 + 2);
    expect(r.top).toBe(TOP);
  });

  it("is a real desk: never smaller than a writing desk, standing on four legs inside its top", () => {
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

  it("stands the desk on a floor one desk height below the top", () => {
    expect(r.floor).toBeCloseTo(TOP - ROOM.tableHeight);
  });

  it("pushes the desk against the back wall, in a nook just wider than the desk", () => {
    expect(r.walls.back).toBeLessThan(r.table.minZ);
    expect(r.table.minZ - r.walls.back).toBeLessThan(1);
    expect(r.walls.left).toBeLessThan(r.table.minX);
    expect(r.walls.right).toBeGreaterThan(r.table.maxX);
    expect(r.table.minX - r.walls.left).toBeLessThan(10);
  });

  it("stands the painting on the desk across the whole back wall, in the picture's proportions", () => {
    const b = r.backdrop;
    expect(b.y0).toBe(TOP);
    expect(b.x0).toBe(r.walls.left);
    expect(b.x1).toBe(r.walls.right);
    expect((b.x1 - b.x0) / (b.y1 - b.y0)).toBeCloseTo(ROOM.backdropAspect);
    expect(b.y1).toBeLessThan(r.walls.ceiling);
  });

  it("keeps the side walls clear of the camera wherever it may turn, and the front wall out of reach", () => {
    const side = ROOM.cameraReach * Math.sin(ROOM.maxTurn);
    expect(r.walls.left).toBeLessThan(MAT.x - side);
    expect(r.walls.right).toBeGreaterThan(MAT.x + side);
    expect(r.walls.front).toBeGreaterThan(MAT.z + ROOM.cameraReach);
    expect(r.walls.ceiling).toBeGreaterThan(TOP + ROOM.cameraReach);
  });

  it("keeps the whole room inside the camera's far plane", () => {
    const room = Math.hypot(
      r.walls.right - r.walls.left,
      r.walls.front - r.walls.back,
      r.walls.ceiling - r.floor,
    );
    expect(room).toBeLessThan(ROOM.far);
  });

  it("grows the desk and the nook with a bigger desk area", () => {
    const big = roomFor({ ...MAT, width: 90 }, TOP);
    expect(big.table.maxX - big.table.minX).toBeGreaterThan(r.table.maxX - r.table.minX);
    expect(big.walls.right).toBeGreaterThan(big.table.maxX);
  });
});
