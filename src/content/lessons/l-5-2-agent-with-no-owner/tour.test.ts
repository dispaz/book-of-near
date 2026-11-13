import { describe, expect, it } from "vitest";
import { CHECK, tourFor } from "./tour";

describe("tourFor", () => {
  it("gives every step before the check a short tour that starts with the whole figure", () => {
    for (let step = 0; step < CHECK; step++) {
      const shots = tourFor(step);
      expect(shots.length).toBeGreaterThanOrEqual(2);
      expect(shots[0]!.target).toEqual({ kind: "all" });
      for (const s of shots.slice(1)) expect(s.caption).toMatch(/^Close up:/);
    }
  });

  it("has no tour at the check and the honest take", () => {
    expect(tourFor(CHECK)).toEqual([]);
    expect(tourFor(CHECK + 1)).toEqual([]);
  });
});
