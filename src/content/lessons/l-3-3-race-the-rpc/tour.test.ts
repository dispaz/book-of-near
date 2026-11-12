import { describe, expect, it } from "vitest";
import { boxOf, FIGURE, windowsAt, type Part } from "./layout3d";
import { ARCHIVE, HONEST } from "./steps";
import { CHECK, shotsDrawn, tourFor } from "./tour";

describe("tourFor", () => {
  it("gives every step before the check a short tour that starts with the whole figure", () => {
    for (let step = 0; step < CHECK; step++) {
      const shots = tourFor(step);
      expect(shots.length).toBeGreaterThanOrEqual(2);
      expect(shots[0]!.target).toEqual({ kind: "all" });
      for (const s of shots.slice(1)) expect(s.caption).toMatch(/^Close up:/);
    }
  });

  it("only looks at objects the step draws", () => {
    for (let step = 0; step < CHECK; step++) expect(shotsDrawn(step)).toBe(true);
  });

  it("has no tour at the check and the honest take", () => {
    expect(tourFor(CHECK)).toEqual([]);
    expect(tourFor(HONEST)).toEqual([]);
  });
});

describe("layout", () => {
  it("keeps every part inside the figure box", () => {
    const parts: Part[] = ["windows", "bars", "archive", "mailbox"];
    for (const p of parts) {
      const [minX, maxX, minZ, maxZ] = boxOf(p);
      expect(minX).toBeGreaterThanOrEqual(FIGURE.minX);
      expect(maxX).toBeLessThanOrEqual(FIGURE.maxX);
      expect(minZ).toBeGreaterThanOrEqual(FIGURE.minZ);
      expect(maxZ).toBeLessThanOrEqual(FIGURE.maxZ);
    }
  });

  it("draws the archival window at the archive step only", () => {
    for (let step = 0; step <= HONEST; step++)
      expect(windowsAt(step).includes("archival")).toBe(step === ARCHIVE);
  });
});
