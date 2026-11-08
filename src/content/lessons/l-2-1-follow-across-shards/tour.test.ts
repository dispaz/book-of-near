import { describe, expect, it } from "vitest";
import { RECORDED } from "./recorded";
import { CHECK, tourFor, type Target } from "./tour";

const exists = (t: Target, step: number, at: number) => {
  switch (t.kind) {
    case "hop":
      // Only hops already drawn at this step: the first one until the follow step, all of them after it.
      return t.index >= 0 && t.index <= (step <= 2 ? 0 : step === 3 ? at : RECORDED.hops.length - 1);
    case "row":
      return RECORDED.shardIds.includes(t.shardId);
    case "column":
      return t.height >= RECORDED.firstBlock && t.height <= RECORDED.lastBlock;
    default:
      return true;
  }
};

describe("tourFor", () => {
  it("gives every step before the check a short tour that starts with the whole figure", () => {
    for (let step = 0; step < CHECK; step++)
      for (const trace of [null, RECORDED]) {
        const shots = tourFor(step, trace, 2);
        expect(shots.length).toBeGreaterThanOrEqual(2);
        expect(shots.length).toBeLessThanOrEqual(3);
        expect(shots[0]!.target).toEqual({ kind: "all" });
        for (const s of shots.slice(1)) expect(s.caption).toMatch(/^Close up:/);
      }
  });

  it("only looks at objects drawn at that step", () => {
    for (let step = 0; step < CHECK; step++)
      for (const at of [0, 3, 6])
        for (const s of tourFor(step, RECORDED, at)) expect(exists(s.target, step, at)).toBe(true);
  });

  it("names the learner's own shard and block in its captions", () => {
    const start = tourFor(2, RECORDED, 0)
      .map((s) => s.caption)
      .join(" ");
    expect(start).toContain("shard 9");
    expect(start).toContain("275719637");
  });

  it("has no tour at the check and the honest take", () => {
    expect(tourFor(CHECK, RECORDED, 0)).toEqual([]);
    expect(tourFor(CHECK + 1, RECORDED, 0)).toEqual([]);
  });
});
