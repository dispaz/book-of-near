/**
 * The room the book lies in: a desk pushed against a wide window, a floor, four walls and a ceiling, and
 * the sunset landscape far outside the window.
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
  /** Wood showing round the desk area: sides, back and front. */
  tableMargin: { side: 8, back: 2, front: 4 },
  /** Side of the square legs and how far in from the corners they stand. */
  leg: 2.2,
  legInset: 3.5,
  /** Space between the table and the side and front walls. The back of the desk touches the window wall. */
  clearance: { side: 26, front: 44 },
  /** The window above the desk: its sill just above the desk top, its top this high above the desk. */
  sill: 1.2,
  windowTop: 66,
  /**
   * The landscape outside: how far behind the window wall, how wide, and how far it reaches below and
   * above its horizon. Room.tsx keeps the horizon at the camera's eye level, like a far landscape's.
   */
  landscape: { behind: 130, width: 700, below: 200, above: 400 },
  /** Height above the desk of a typical eye, where the landscape's horizon starts. */
  eye: 20,
  /** Furthest the camera orbits from what it looks at (CameraRig `maxDistance`). */
  cameraReach: 40,
  /** The camera's far plane (InkStage uses it): the room and the landscape must be nearer than this. */
  far: 800,
  /** Height of the ceiling above the table top. */
  ceiling: 82,
} as const;

/** The desk area the book needs: its centre (x, z) and size. */
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
  /** The window in the back wall, in world x and y. */
  window: { x0: number; x1: number; y0: number; y1: number };
  /** The painted landscape outside: a plane at z, spanning x0..x1 and y0..y1. */
  landscape: { z: number; x0: number; x1: number; y0: number; y1: number };
  /** Where the potted plant stands on the desk (x, z): the back corner on the right, clear of the book. */
  plant: [number, number];
}

/** The desk that holds `mat` (top surface at y = `top`), against a window, and the room round it. */
export function roomFor(mat: Mat, top: number): RoomLayout {
  const m = ROOM.tableMargin;
  const width = Math.max(mat.width + 2 * m.side, ROOM.minTable[0]);
  const back = mat.z - mat.depth / 2 - m.back;
  const front = mat.z + mat.depth / 2 + m.front;
  // A small desk area grows towards the reader: the back of the desk stays against the window.
  const grow = Math.max(0, ROOM.minTable[1] - (front - back));
  const table = {
    minX: mat.x - width / 2,
    maxX: mat.x + width / 2,
    minZ: back,
    maxZ: front + grow,
  };
  const i = ROOM.legInset;
  const legs: [number, number][] = [
    [table.minX + i, table.minZ + i],
    [table.maxX - i, table.minZ + i],
    [table.minX + i, table.maxZ - i],
    [table.maxX - i, table.maxZ - i],
  ];
  // The side and front walls clear the camera wherever it orbits; it never goes behind the book
  // (CameraRig keeps it within 45° of the step's view), so the window wall can touch the desk.
  const reach = ROOM.cameraReach + 6;
  const wallBack = table.minZ - 0.4;
  const L = ROOM.landscape;
  return {
    top,
    table,
    legs,
    floor: top - ROOM.tableHeight,
    walls: {
      back: wallBack,
      front: Math.max(table.maxZ + ROOM.clearance.front, mat.z + reach),
      left: Math.min(table.minX - ROOM.clearance.side, mat.x - reach),
      right: Math.max(table.maxX + ROOM.clearance.side, mat.x + reach),
      ceiling: top + ROOM.ceiling,
    },
    window: { x0: table.minX - 2, x1: table.maxX + 2, y0: top + ROOM.sill, y1: top + ROOM.windowTop },
    landscape: {
      z: wallBack - L.behind,
      x0: mat.x - L.width / 2,
      x1: mat.x + L.width / 2,
      y0: top + ROOM.eye - L.below,
      y1: top + ROOM.eye + L.above,
    },
    plant: [table.maxX - 6, table.minZ + 5],
  };
}
