/**
 * Where things stand in the 3D view of lesson 2.1 (world units; y is up), on the right page of the book.
 * One fixed figure box holds every step, so the book's spread never resizes when a transaction loads:
 * the grid's pitch shrinks to fit the trace instead. Rows are shards (each a ribbon), columns are blocks,
 * time running left to right. The signer's mailbox stands left of the grid, in its shard's row.
 * Pure, so it is unit tested and never pulls three.js into the 2D view.
 */
import type { Vec3 } from "../../../scene-kit/motion";
import type { Hop, Trace } from "./trace";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.4, maxX: 4.4, minZ: -3.0, maxZ: 3.0 } as const;

/** Where the chunk cells may go: right of the mailbox column and the ribbon tails. */
const CELLS = { minX: -1.9, maxX: 4.2, minZ: -2.7, maxZ: 2.3 } as const;
/** The comfortable pitch on small grids; bigger grids shrink to fit CELLS. */
const MAX_COL = 1.35;
const MAX_ROW = 0.7;
/** Room left of the cells for a ribbon's tail and its "shard n" label. */
const TAIL = 1.2;
/** Room in front of the cells for the block numbers. */
const FRONT = 0.55;

/** The mailbox column, left of every ribbon tail. */
const MAILBOX_X = -3.75;
/** Step 1, before the grid: the mailbox and the parcel stand in the middle of the page. */
export const MAILBOX_HOME: Vec3 = [-1.8, 0, 0.5];
export const PARCEL_HOME: Vec3 = [1.9, 0, 0.7];

export const cols = (t: Trace) => t.lastBlock - t.firstBlock + 1;

export interface Grid {
  n: number;
  rows: number;
  /** Centre-to-centre distance of columns (x) and rows (z). */
  col: number;
  row: number;
  /** One chunk cell's size (x, z). */
  cell: [number, number];
  /** Left edge of the first column of cells. */
  left: number;
  /** Ground box of the grid with its ribbon tails and block numbers. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function gridOf(t: Trace): Grid {
  const n = cols(t);
  const rows = t.shardIds.length;
  const col = Math.min(MAX_COL, (CELLS.maxX - CELLS.minX) / n);
  const row = Math.min(MAX_ROW, (CELLS.maxZ - CELLS.minZ) / rows);
  const width = n * col;
  const depth = rows * row;
  const left = CELLS.minX;
  const top = (CELLS.minZ + CELLS.maxZ) / 2 - depth / 2;
  return {
    n,
    rows,
    col,
    row,
    cell: [col * 0.82, row * 0.74],
    left,
    minX: left - TAIL,
    maxX: left + width + 0.1,
    minZ: top - 0.05,
    maxZ: top + depth + FRONT,
  };
}

/** z of a shard's row. */
export function rowZ(t: Trace, shardId: number): number {
  const g = gridOf(t);
  const i = Math.max(0, t.shardIds.indexOf(shardId));
  return g.minZ + 0.05 + (i + 0.5) * g.row;
}

/** x of a block's column. */
export function colX(t: Trace, height: number): number {
  const g = gridOf(t);
  return g.left + (height - t.firstBlock + 0.5) * g.col;
}

/** Centre of the cell (shard row, block column), on the page. */
export function cellAt(t: Trace, shardId: number, height: number): Vec3 {
  return [colX(t, height), 0, rowZ(t, shardId)];
}

/** Hops that share one chunk sit side by side inside it. Gives each hop's slot in its cell. */
export function slots(t: Trace): { index: number; of: number }[] {
  const key = (h: Hop) => `${h.shardId}:${h.blockHeight}`;
  const count = new Map<string, number>();
  for (const h of t.hops) count.set(key(h), (count.get(key(h)) ?? 0) + 1);
  const seen = new Map<string, number>();
  return t.hops.map((h) => {
    const i = seen.get(key(h)) ?? 0;
    seen.set(key(h), i + 1);
    return { index: i, of: count.get(key(h))! };
  });
}

/** Where hop `h` rests: its cell, shifted when the chunk holds several hops. */
export function hopAt(t: Trace, h: Hop, slot: { index: number; of: number }): Vec3 {
  const [x, y, z] = cellAt(t, h.shardId, h.blockHeight);
  const w = gridOf(t).cell[0];
  const dx = slot.of > 1 ? (slot.index - (slot.of - 1) / 2) * (w / slot.of) : 0;
  return [x + dx, y, z];
}

/** The signer's mailbox: left of the grid, in the row of the shard it lives on. */
export function mailboxAt(t: Trace): Vec3 {
  return [MAILBOX_X, 0, rowZ(t, t.hops[0]!.shardId)];
}
