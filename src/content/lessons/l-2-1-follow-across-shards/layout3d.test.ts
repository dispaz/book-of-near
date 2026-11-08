import { describe, expect, it } from "vitest";
import { cellAt, cols, FIGURE, gridOf, hopAt, MAILBOX_HOME, mailboxAt, slots } from "./layout3d";
import { RECORDED } from "./recorded";
import type { Trace } from "./trace";

/** A trace with `shards` rows and `blocks` columns, one hop per block on the first shard. */
function fake(shards: number, blocks: number): Trace {
  const shardIds = Array.from({ length: shards }, (_, i) => i);
  const hops = Array.from({ length: blocks }, (_, i) => ({
    index: i,
    kind: (i === 0 ? "transaction" : "receipt") as "transaction" | "receipt",
    id: `h${i}`,
    accountId: "a.testnet",
    shardId: shardIds[i % shards]!,
    blockHeight: 100 + i,
    blockHash: `b${i}`,
    chunkHash: `c${i}`,
    sinceMs: i * 600,
    gasBurnt: 1n,
  }));
  return {
    txHash: "h0",
    signerId: "a.testnet",
    source: "demo",
    shardIds,
    hops,
    firstBlock: 100,
    lastBlock: 100 + blocks - 1,
    workMs: (blocks - 1) * 600,
  };
}

const inside = ([x, , z]: readonly [number, number, number]) =>
  x >= FIGURE.minX && x <= FIGURE.maxX && z >= FIGURE.minZ && z <= FIGURE.maxZ;

describe("layout3d", () => {
  it("has a column per block and a row per shard, time left to right", () => {
    expect(cols(RECORDED)).toBe(5);
    const a = cellAt(RECORDED, 9, RECORDED.firstBlock);
    const b = cellAt(RECORDED, 9, RECORDED.lastBlock);
    expect(b[0]).toBeGreaterThan(a[0]);
    expect(cellAt(RECORDED, 4, RECORDED.firstBlock)[2]).not.toBe(a[2]);
  });

  it("puts hops that share a chunk side by side", () => {
    const s = slots(RECORDED);
    expect(s.every((x) => x.of >= 1)).toBe(true);
    const pos = RECORDED.hops.map((h, i) => hopAt(RECORDED, h, s[i]!));
    expect(new Set(pos.map((p) => p.join(","))).size).toBe(pos.length);
  });

  it("fits any grid inside the one figure box, so the book never resizes", () => {
    for (const t of [RECORDED, fake(6, 3), fake(1, 1), fake(20, 12)]) {
      const g = gridOf(t);
      expect(inside([g.minX, 0, g.minZ])).toBe(true);
      expect(inside([g.maxX, 0, g.maxZ])).toBe(true);
      for (const h of t.hops) expect(inside(cellAt(t, h.shardId, h.blockHeight))).toBe(true);
      expect(inside(mailboxAt(t))).toBe(true);
    }
  });

  it("keeps cells no bigger than the comfortable size on small grids", () => {
    const small = gridOf(fake(1, 1));
    const big = gridOf(fake(20, 12));
    expect(small.col).toBeLessThanOrEqual(1.4);
    expect(big.row).toBeLessThan(small.row);
  });

  it("stands the signer's mailbox in its shard's row, left of the grid", () => {
    const m = mailboxAt(RECORDED);
    const first = cellAt(RECORDED, 9, RECORDED.firstBlock);
    expect(m[2]).toBeCloseTo(first[2]);
    expect(m[0]).toBeLessThan(gridOf(RECORDED).minX);
    expect(inside(MAILBOX_HOME)).toBe(true);
  });
});
