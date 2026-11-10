import { describe, expect, it } from "vitest";
import { bookFootprint, spreadBeside, spreadFor } from "./book";
import { ORBIT } from "./motion";
import {
  cameraRoom,
  growBox,
  isInside,
  keepInside,
  PICTURE,
  ROOM,
  roomFor,
  roomForSpread,
  WALL_GAP,
} from "./roomLayout";

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
    expect((r.walls.right - r.walls.left) / (b.y1 - b.y0)).toBeCloseTo(PICTURE.width / PICTURE.height);
    expect(b.y1).toBeLessThan(r.walls.ceiling);
  });

  it("keeps the side walls clear of the camera wherever it may turn, and the front wall out of reach", () => {
    const side = ROOM.cameraReach * Math.sin(ORBIT.azimuth);
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

describe("the camera stays inside the room (keepInside)", () => {
  // Book-scene layouts: lesson 0.1's two spreads, a small figure and a wide one.
  const layouts = {
    "0.1 row": spreadBeside(
      { minX: -6.2, maxX: 6.2, minZ: -3.6, maxZ: 3.1 },
      { side: 1.1, back: 1.2, front: 2.4 },
    ),
    "0.1 loop": spreadFor({ minX: -3.7, maxX: 3.7, minZ: -3.6, maxZ: 4.4 }),
    small: spreadBeside({ minX: -2, maxX: 2, minZ: -2, maxZ: 2 }),
    wide: spreadBeside({ minX: -9, maxX: 9, minZ: -5, maxZ: 5 }),
  };
  const deg = Math.PI / 180;
  /** Where the camera would be: looking at `t` from `dist` away, turned `az` and raised `el`. */
  const from = (t: [number, number, number], az: number, el: number, dist: number) =>
    [
      t[0] + dist * Math.cos(el) * Math.sin(az),
      t[1] + dist * Math.sin(el),
      t[2] + dist * Math.cos(el) * Math.cos(az),
    ] as [number, number, number];

  for (const [name, spread] of Object.entries(layouts)) {
    it(`${name}: every pan corner, turn, tilt and zoom ends inside the walls, on the same line of sight`, () => {
      const room = roomForSpread(spread);
      const box = cameraRoom(room);
      const walls = growBox(box, WALL_GAP);
      const pan = bookFootprint(spread);
      const corners: [number, number, number][] = [];
      for (const x of [pan.minX, (pan.minX + pan.maxX) / 2, pan.maxX])
        for (const z of [pan.minZ, (pan.minZ + pan.maxZ) / 2, pan.maxZ]) corners.push([x, 0.7, z]);
      // Step views look from the front, from the side or (a tour shot) from behind; ±ORBIT.azimuth round
      // them, at the polar limits (elevations 11° to 79°), out to lesson 0.1's ceiling (140).
      for (const t of corners)
        for (const centre of [0, -30 * deg, 30 * deg, 180 * deg])
          for (const turn of [-ORBIT.azimuth, 0, ORBIT.azimuth])
            for (const el of [11 * deg, 35 * deg, 79 * deg])
              for (const dist of [6, 30, 40 * ORBIT.zoomOut, 140]) {
                const raw = from(t, centre + turn, el, dist);
                const held = keepInside(raw, t, box);
                expect(isInside(held, walls)).toBe(true);
                // Only nearer, along the line of sight: no turn, no slide.
                const k = Math.hypot(held[0] - t[0], held[1] - t[1], held[2] - t[2]) / dist;
                expect(k).toBeLessThanOrEqual(1 + 1e-9);
                for (let i = 0; i < 3; i++) expect(held[i]!).toBeCloseTo(t[i]! + k * (raw[i]! - t[i]!), 6);
              }
    });
  }

  it("leaves a camera that is already inside alone", () => {
    const box = cameraRoom(roomForSpread(layouts["0.1 row"]));
    expect(keepInside([0, 20, 15], [0, 0.7, 0], box)).toEqual([0, 20, 15]);
  });
});
