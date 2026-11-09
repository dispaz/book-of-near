/**
 * The room the book lies in: a desk in a window nook at sunset. The back wall is a painting (the window,
 * the bookshelf and the view, see Room.tsx) standing on the back of the desk; the side walls close the nook.
 * Pure numbers, no three.js, so it can be unit tested. One world unit is about 2.2 cm (a page is about
 * ten units wide), so a 75 cm desk is 33 units tall.
 */
export const ROOM = {
  /** Height of the desk top above the floor. */
  tableHeight: 33,
  /** Thickness of the desk top. */
  tableThick: 1.6,
  /** The smallest desk (x, z), even for a small book. */
  minTable: [56, 40] as [number, number],
  /** Wood showing round the desk area: sides, back and front. */
  tableMargin: { side: 8, back: 2, front: 4 },
  /** Side of the square legs and how far in from the corners they stand. */
  leg: 2.2,
  legInset: 3.5,
  /** How far the nook's side walls stand from the desk's ends. */
  nook: 2,
  /** Space between the desk and the wall behind the reader. */
  front: 44,
  /** Furthest the camera orbits from what it looks at (CameraRig `maxDistance`). */
  cameraReach: 40,
  /** Furthest the camera can turn to either side (CameraRig keeps it within 45° of the step's view). */
  maxTurn: Math.PI / 4,
  /** The camera's far plane (InkStage uses it): the whole room must be nearer than this. */
  far: 400,
  /** Height of the ceiling above the desk top. */
  ceiling: 70,
  /** The painting on the back wall: width / height of the picture (assets/sunset-window.jpg). */
  backdropAspect: 1672 / 604,
} as const;

/** The desk area the book needs: its centre (x, z) and size. */
export interface Mat {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface RoomLayout {
  /** y of the desk top. */
  top: number;
  /** The desk top, in x and z. */
  table: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Centres (x, z) of the four legs. */
  legs: [number, number][];
  /** y of the floor. */
  floor: number;
  /** Where the walls stand (x for left and right, z for back and front) and the ceiling's y. */
  walls: { back: number; front: number; left: number; right: number; ceiling: number };
  /** The painting on the back wall: it spans the wall from left to right, from the desk top up to y1. */
  backdrop: { x0: number; x1: number; y0: number; y1: number };
}

/** The desk that holds `mat` (top surface at y = `top`), in a window nook, and the room round it. */
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
  // The camera never goes behind the book, so the back wall can touch the desk; the side walls and
  // the wall behind the reader stay clear of it wherever it may turn.
  const side = ROOM.cameraReach * Math.sin(ROOM.maxTurn) + 4;
  const wallBack = table.minZ - 0.4;
  const left = Math.min(table.minX - ROOM.nook, mat.x - side);
  const right = Math.max(table.maxX + ROOM.nook, mat.x + side);
  return {
    top,
    table,
    legs,
    floor: top - ROOM.tableHeight,
    walls: {
      back: wallBack,
      front: Math.max(table.maxZ + ROOM.front, mat.z + ROOM.cameraReach + 6),
      left,
      right,
      ceiling: top + ROOM.ceiling,
    },
    backdrop: { x0: left, x1: right, y0: top, y1: top + (right - left) / ROOM.backdropAspect },
  };
}
