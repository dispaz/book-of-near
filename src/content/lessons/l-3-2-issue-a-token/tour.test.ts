import { describe, expect, it } from "vitest";
import { figureHolds } from "./layout3d";
import { CHECK, HONEST } from "./steps";
import { shotsDrawn, tourFor } from "./tour";

describe("lesson 3.2 tour and layout", () => {
  it("every step's shots look at drawn parts, and the parts fit the figure", () => {
    for (let s = 0; s < CHECK; s++) {
      expect(tourFor(s).length).toBeGreaterThanOrEqual(2);
      expect(shotsDrawn(s)).toBe(true);
      expect(figureHolds(s)).toBe(true);
    }
  });

  it("has no tour at the check and the honest take", () => {
    expect(tourFor(CHECK)).toEqual([]);
    expect(tourFor(HONEST)).toEqual([]);
  });
});
