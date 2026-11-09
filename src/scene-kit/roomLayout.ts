/**
 * The room the book lies in: a table under the felt mat, a floor, four walls and a ceiling.
 * Pure numbers, no three.js, so it can be unit tested. One world unit is about 2.2 cm (a page is about
 * ten units wide), so a 75 cm table is 33 units tall.
 */
export const ROOM = {
  /** Height of the table top above the floor. */
  tableHeight: 33,
  /** Thickness of the table top. */
  tableThick: 1.6,
  /** The smallest table (x, z): a writing desk, even for a small book. */
  minTable: [72, 44] as [number, number],
  /** Wood showing round the felt mat: sides, back and front. */
  tableMargin: { side: 8, back: 6, front: 4 },
  /** Side of the square legs and how far in from the corners they stand. */
  leg: 2.2,
  legInset: 3.5,
  /** Space between the table and the walls: the room is a sitting room, not a box round the desk. */
  clearance: { side: 52, back: 72, front: 44 },
  /** Furthest the camera orbits from what it looks at (CameraRig `maxDistance`). */
  cameraReach: 40,
  /** The camera's far plane (InkStage uses it): the whole room must be nearer than this. */
  far: 400,
  /** Height of the ceiling above the table top. */
  ceiling: 82,
} as const;

/** The felt mat on the table: its centre (x, z) and size. */
export interface Mat {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface RoomLayout {
  /** y of the table top, where the mat lies. */
  top: number;
  /** The table top, in x and z. */
  table: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Centres (x, z) of the four legs. */
  legs: [number, number][];
  /** y of the floor. */
  floor: number;
  /** Where the walls stand (x for left and right, z for back and front) and the ceiling's y. */
  walls: { back: number; front: number; left: number; right: number; ceiling: number };
}

/** The table that holds `mat` (top surface at y = `top`) and the room round it. */
export function roomFor(mat: Mat, top: number): RoomLayout {
  const m = ROOM.tableMargin;
  const width = Math.max(mat.width + 2 * m.side, ROOM.minTable[0]);
  const back = mat.z - mat.depth / 2 - m.back;
  const front = mat.z + mat.depth / 2 + m.front;
  // A small mat is centred front to back on the smallest table.
  const grow = Math.max(0, ROOM.minTable[1] - (front - back)) / 2;
  const table = {
    minX: mat.x - width / 2,
    maxX: mat.x + width / 2,
    minZ: back - grow,
    maxZ: front + grow,
  };
  const i = ROOM.legInset;
  const legs: [number, number][] = [
    [table.minX + i, table.minZ + i],
    [table.maxX - i, table.minZ + i],
    [table.minX + i, table.maxZ - i],
    [table.maxX - i, table.maxZ - i],
  ];
  // Walls clear the table, and the camera wherever it orbits round the book.
  const reach = ROOM.cameraReach + 6;
  return {
    top,
    table,
    legs,
    floor: top - ROOM.tableHeight,
    walls: {
      back: Math.min(table.minZ - ROOM.clearance.back, mat.z - reach),
      front: Math.max(table.maxZ + ROOM.clearance.front, mat.z + reach),
      left: Math.min(table.minX - ROOM.clearance.side, mat.x - reach),
      right: Math.max(table.maxX + ROOM.clearance.side, mat.x + reach),
      ceiling: top + ROOM.ceiling,
    },
  };
}
