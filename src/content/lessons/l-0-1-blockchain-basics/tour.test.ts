import { describe, expect, it } from "vitest";
import { tourFor } from "./tour";
import { CHECK, HONEST, NOTEBOOK } from "./useLedgerLesson";

describe("tourFor", () => {
  it("gives every step except the quiz a short camera tour", () => {
    for (let step = NOTEBOOK; step <= HONEST; step++) {
      const shots = tourFor(step, 4);
      if (step === CHECK) expect(shots).toEqual([]);
      else expect(shots.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("writes each caption as one short plain sentence", () => {
    for (let step = NOTEBOOK; step <= HONEST; step++)
      for (const s of tourFor(step, 4)) {
        expect(s.caption.length).toBeLessThanOrEqual(80);
        expect(s.caption).toMatch(/^[A-Z].*\.$/);
      }
  });

  it("only visits blocks that are on the chain", () => {
    for (let step = NOTEBOOK; step <= HONEST; step++)
      for (const blocks of [1, 2, 3, 4])
        for (const { target } of tourFor(step, blocks))
          if (target.kind === "block" || target.kind === "link") {
            expect(target.i).toBeLessThan(blocks);
            if (target.kind === "link") expect(target.i).toBeGreaterThan(0);
          }
  });

  it("starts with the whole figure", () => {
    expect(tourFor(NOTEBOOK, 1)[0]!.target).toEqual({ kind: "all" });
    expect(tourFor(HONEST, 4)[0]!.target).toEqual({ kind: "all" });
  });
});
