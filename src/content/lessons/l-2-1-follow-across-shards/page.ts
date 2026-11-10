/**
 * What both views draw on the shard page, worked out once: where each slip stands, which shards and
 * chunks the path has lit so far, which slip is the newest. Pure (no React, no three.js), so the 2D and
 * the 3D view cannot drift apart.
 */
import { COLORS } from "../../../scene-kit/theme";
import type { Vec3 } from "../../../scene-kit/motion";
import { hopAt, slots } from "./layout3d";
import { FOLLOW, PICK } from "./steps";
import type { Trace } from "./trace";

/** The stage accent: the shards, chunks and slips that matter now. */
export const ACCENT = COLORS.pink;
/** A light tint of the accent: shards the path has touched. */
export const TOUCHED = "#ffc4dc";

/** One chunk: a shard in a block. */
export const cellKey = (shardId: number, blockHeight: number) => `${shardId}:${blockHeight}`;

/** The part of the lesson state the page needs. */
export interface PageState {
  step: number;
  drawn: number;
  reached: number;
  last: number;
  shard: number | null;
}

export interface PageModel {
  /** Where each hop's slip stands (every hop, drawn or not). */
  pos: Vec3[];
  /** How many hops are drawn (0 when none). */
  count: number;
  /** Shards the drawn path touches. */
  touched: Set<number>;
  /** Chunks the drawn path passes through (`cellKey`). */
  lit: Set<string>;
  /**
   * The hop the 3D traveller carries: the newest drawn one (-1 when none). It only ever moves forward,
   * on a follow; looking back at an earlier hop highlights that hop where it stands.
   */
  travelling: number;
  /** The newest slip at the follow step, still waiting to be followed on. */
  isNewest: (i: number) => boolean;
  /** A shard ribbon's colour: picked, touched or plain. */
  ribbonColor: (shardId: number) => string;
}

export function pageModel(trace: Trace, s: PageState): PageModel {
  const sl = slots(trace);
  const count = Math.max(0, s.drawn + 1);
  const shown = trace.hops.slice(0, count);
  const touched = new Set(shown.map((h) => h.shardId));
  return {
    pos: trace.hops.map((h, i) => hopAt(trace, h, sl[i]!)),
    count,
    travelling: count - 1,
    touched,
    lit: new Set(shown.map((h) => cellKey(h.shardId, h.blockHeight))),
    isNewest: (i) => s.step === FOLLOW && i === s.reached && s.reached < s.last,
    ribbonColor: (id) => (s.shard === id ? ACCENT : touched.has(id) ? TOUCHED : COLORS.slab),
  };
}

/** Cuts a long account name for a label. */
export const shortName = (id: string) => (id.length > 24 ? `${id.slice(0, 21)}…` : id);

/** One sentence on what the figure shows at this step (2D aria-label, 3D description). */
export function describe(s: { step: number; trace: Trace | null; drawn: number; at: number }): string {
  const { trace, step, drawn } = s;
  if (step === PICK || !trace)
    return trace
      ? "Your account's mailbox and the transaction's parcel. Its path is loaded."
      : "Your account's mailbox and a parcel: the transaction to open. No path is loaded yet.";
  const base = `${trace.shardIds.length} shard ribbons by ${trace.lastBlock - trace.firstBlock + 1} blocks, one chunk per shard per block.`;
  if (drawn < 0) return `${base} No path is drawn yet.`;
  const hop = trace.hops[s.at]!;
  return `${base} ${drawn + 1} of ${trace.hops.length} hops drawn. Looking at step ${s.at + 1}: shard ${hop.shardId}, block ${hop.blockHeight}.`;
}
