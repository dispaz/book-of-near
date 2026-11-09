import { describe as group, expect, it } from "vitest";
import { ACCENT, cellKey, describe, pageModel, TOUCHED } from "./page";
import { RECORDED } from "./recorded";
import { FOLLOW, GRID, TIME } from "./steps";

const base = { reached: 0, last: RECORDED.hops.length - 1, shard: null };

group("pageModel", () => {
  it("lights only the drawn part of the path", () => {
    const m = pageModel(RECORDED, { ...base, step: FOLLOW, drawn: 1, reached: 1 });
    expect(m.count).toBe(2);
    expect([...m.touched]).toEqual([9, 4]);
    expect(m.lit.has(cellKey(4, 275719638))).toBe(true);
    expect(m.lit.has(cellKey(5, 275719639))).toBe(false);
    expect(m.pos).toHaveLength(RECORDED.hops.length);
  });

  it("marks the newest slip only while there is more to follow", () => {
    const m = pageModel(RECORDED, { ...base, step: FOLLOW, drawn: 1, reached: 1 });
    expect(m.isNewest(1)).toBe(true);
    expect(m.isNewest(0)).toBe(false);
    const done = pageModel(RECORDED, { ...base, step: TIME, drawn: 6, reached: 6 });
    expect(done.isNewest(6)).toBe(false);
  });

  it("colours a picked ribbon with the accent, a touched one with the tint", () => {
    const m = pageModel(RECORDED, { ...base, step: FOLLOW, drawn: 0, shard: 4 });
    expect(m.ribbonColor(4)).toBe(ACCENT);
    expect(m.ribbonColor(9)).toBe(TOUCHED);
  });

  it("the traveller carries the newest hop, whatever the learner looks at", () => {
    // Looking back at hop 2 must not move the traveller back: receipts never travel backward.
    const m = pageModel(RECORDED, { ...base, step: FOLLOW, drawn: 4, reached: 4 });
    expect(m.travelling).toBe(4);
    expect(pageModel(RECORDED, { ...base, step: GRID, drawn: -1 }).travelling).toBe(-1);
  });

  it("draws nothing at the grid step", () => {
    expect(pageModel(RECORDED, { ...base, step: GRID, drawn: -1 }).count).toBe(0);
  });
});

group("describe", () => {
  it("says which step the learner is looking at", () => {
    expect(describe({ step: FOLLOW, trace: RECORDED, drawn: 2, at: 2 })).toContain(
      "3 of 7 hops drawn. Looking at step 3: shard 5",
    );
    expect(describe({ step: 0, trace: null, drawn: -1, at: 0 })).toContain("No path is loaded yet");
  });
});
