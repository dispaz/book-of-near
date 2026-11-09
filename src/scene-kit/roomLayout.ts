/**
 * The room the book lies in: a desk in a window nook at sunset. The back wall is a painting (the window,
 * the bookshelf and the view, see Room.tsx) standing on the back of the desk; the side walls close the nook.
 * Pure numbers, no three.js, so it can be unit tested. One world unit is about 2.2 cm (a page is about
 * ten units wide), so a 75 cm desk is 33 units tall.
 */
import { BOOK, type Spread } from "./book";
import { ORBIT, type Vec3 } from "./motion";

/** The painting on the back wall (assets/sunset-window.jpg), in its own pixels. */
export const PICTURE = { width: 1672, height: 604 } as const;

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
  /**
   * How far from the book the room keeps clear for the camera. Book scenes frame the figure from about
   * 15 to 30 units away and the learner may zoom out 1.3 times that (ORBIT in motion.ts).
   */
  cameraReach: 40,
  /** The camera's far plane (InkStage uses it): the whole room must be nearer than this. */
  far: 400,
  /** Height of the ceiling above the desk top. */
  ceiling: 70,
} as const;

/** The part of the desk the book and its figure need: its centre (x, z) and size. */
export interface DeskArea {
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
  /** The painting on the back wall: it spans the wall from side to side, from the desk top (y0) up to y1. */
  backdrop: { y0: number; y1: number };
}

/** The desk that holds `mat` (top surface at y = `top`), in a window nook, and the room round it. */
export function roomFor(mat: DeskArea, top: number): RoomLayout {
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
  const side = ROOM.cameraReach * Math.sin(ORBIT.azimuth) + 4;
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
    backdrop: { y0: top, y1: top + ((right - left) * PICTURE.height) / PICTURE.width },
  };
}

/**
 * The desk under an open book (BookBackdrop draws it): its top's y, the centre (x, z) of the area the book
 * needs, and that area's size. A little past the book at the sides and the back (the window is just
 * behind it), and well past it towards the reader, so low camera shots see desk in front of the book.
 */
export function deskFor(spread: Spread): { y: number; at: [number, number]; size: [number, number] } {
  const { pageWidth: W, pageDepth: D, center } = spread;
  const [cx, , cz] = center;
  return {
    y: -BOOK.stack - BOOK.cover - 0.001,
    at: [cx, cz + 10],
    size: [2 * (W + BOOK.overhang) + 9, D + 2 * BOOK.overhang + 26],
  };
}

/** The desk top's y above the floor of the desk's own drawing (Desk in BookBackdrop). */
const DESK_TOP = -0.06;

/** The room round an open book: the one the backdrop draws and the camera must stay inside. */
export function roomForSpread(spread: Spread): RoomLayout {
  const d = deskFor(spread);
  return roomFor({ x: d.at[0], z: d.at[1], width: d.size[0], depth: d.size[1] }, d.y + DESK_TOP);
}

/** A box the camera must stay inside. */
export interface CameraBox {
  min: Vec3;
  max: Vec3;
}

/** How far the camera keeps from the room's walls, ceiling and desk (world units). */
export const WALL_GAP = 2;

/**
 * Where the camera may be in a room: inside the walls and under the ceiling, `gap` clear of each, and
 * above the desk top. (The camera never looks from behind the book, so the back wall is a bound too.)
 */
export function cameraRoom(room: RoomLayout, gap = WALL_GAP): CameraBox {
  const w = room.walls;
  return {
    min: [w.left + gap, room.top + gap, w.back + gap],
    max: [w.right - gap, w.ceiling - gap, w.front - gap],
  };
}

/** `b` made `g` larger on every side (from the camera's room back out to the walls). */
export function growBox(b: CameraBox, g: number): CameraBox {
  return {
    min: [b.min[0] - g, b.min[1] - g, b.min[2] - g],
    max: [b.max[0] + g, b.max[1] + g, b.max[2] + g],
  };
}

/** Whether `p` is inside `b`. */
export const isInside = (p: Vec3, b: CameraBox) =>
  p[0] >= b.min[0] &&
  p[0] <= b.max[0] &&
  p[1] >= b.min[1] &&
  p[1] <= b.max[1] &&
  p[2] >= b.min[2] &&
  p[2] <= b.max[2];

/**
 * The camera held inside `box`: if it is outside, it moves along its line of sight towards `target` (so
 * it never turns or slides, it only comes nearer) to the furthest point still inside. `target` must be
 * inside the box. Pure, unit tested.
 */
export function keepInside(camera: Vec3, target: Vec3, box: CameraBox): [number, number, number] {
  if (isInside(camera, box)) return [camera[0], camera[1], camera[2]];
  // The largest t in 0..1 with target + t (camera - target) inside, axis by axis.
  let t = 1;
  for (let i = 0; i < 3; i++) {
    const d = camera[i]! - target[i]!;
    if (d > 0 && camera[i]! > box.max[i]!) t = Math.min(t, (box.max[i]! - target[i]!) / d);
    if (d < 0 && camera[i]! < box.min[i]!) t = Math.min(t, (box.min[i]! - target[i]!) / d);
  }
  t = Math.max(0, t);
  return [
    target[0] + t * (camera[0] - target[0]),
    target[1] + t * (camera[1] - target[1]),
    target[2] + t * (camera[2] - target[2]),
  ];
}
