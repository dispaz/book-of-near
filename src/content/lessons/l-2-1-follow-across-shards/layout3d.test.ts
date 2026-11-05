import { describe, expect, it } from "vitest";
import { cellAt, cols, gridBox, hopAt, shotFor, slots } from "./layout3d";
import { RECORDED } from "./recorded";

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
    // Hops 2 and 3 are in different shards of one block; hops 3 and 4 share nothing. Two refunds never share.
    expect(s.every((x) => x.of >= 1)).toBe(true);
    const pos = RECORDED.hops.map((h, i) => hopAt(RECORDED, h, s[i]!));
    expect(new Set(pos.map((p) => p.join(","))).size).toBe(pos.length);
  });

  it("frames the whole grid", () => {
    const f = shotFor(RECORDED, false);
    const b = gridBox(RECORDED);
    expect(f.width).toBeCloseTo(b.maxX - b.minX);
  });
});
