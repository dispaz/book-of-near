/**
 * Where things stand in the 3D view of lesson 2.1 (world units; y is up). The grid has one row per
 * shard and one column per block, time running left to right. Pure, so it is unit tested and never
 * pulls three.js into the 2D view.
 */
import { focusOf, type Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import type { Hop, Trace } from "./trace";

export const COL = 1.35;
export const ROW = 0.62;
export const CELL: [number, number] = [1.1, 0.46];
export const SLAB_H = 0.2;

export const cols = (t: Trace) => t.lastBlock - t.firstBlock + 1;

/** Centre of the cell (shard row, block column), on top of the slab. */
export function cellAt(t: Trace, shardId: number, height: number): Vec3 {
  const row = t.shardIds.indexOf(shardId);
  const x = (height - t.firstBlock - (cols(t) - 1) / 2) * COL;
  const z = (row - (t.shardIds.length - 1) / 2) * ROW;
  return [x, SLAB_H, z];
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
  const dx = slot.of > 1 ? (slot.index - (slot.of - 1) / 2) * 0.42 : 0;
  return [x + dx, y, z];
}

/** Half-width of the grid, with room for the shard names on the left and the block numbers in front. */
export function gridBox(t: Trace) {
  const w = cols(t) * COL;
  const d = t.shardIds.length * ROW;
  return { minX: -w / 2 - 1.6, maxX: w / 2 + 0.5, minZ: -d / 2 - 0.5, maxZ: d / 2 + 0.7 };
}

/** The part of the world every step keeps in view: the whole grid, seen from the front and above. */
export function shotFor(t: Trace, phone: boolean): Focus {
  const b = gridBox(t);
  return focusOf([[b.minX, b.maxX, b.minZ, b.maxZ, 1.6]], phone ? 74 : 72, 0, 0.1);
}
