import { describe, expect, it } from "vitest";
import { CHECK, HONEST, tourFor, type Target } from "./tour";
import { DERIVE, HOOK, PREPARE, SIGN, VERIFY } from "./steps";

/** Objects drawn at each step (Scene3D and Scene2D draw the same ones). */
const drawn = (t: Target, step: number) => {
  switch (t.kind) {
    case "parcel":
      return step >= PREPARE;
    case "address":
      return step >= HOOK;
    default:
      return true;
  }
};

describe("tourFor", () => {
  it("gives every step before the check a short tour that starts with the whole figure", () => {
    for (let step = 0; step < CHECK; step++) {
      const shots = tourFor(step);
      expect(shots.length).toBeGreaterThanOrEqual(2);
      expect(shots.length).toBeLessThanOrEqual(3);
      expect(shots[0]!.target).toEqual({ kind: "all" });
      for (const s of shots.slice(1)) expect(s.caption).toMatch(/^Close up:/);
    }
  });

  it("only looks at objects drawn at that step", () => {
    for (let step = 0; step < CHECK; step++)
      for (const s of tourFor(step)) expect(drawn(s.target, step), `${step} ${s.target.kind}`).toBe(true);
  });

  it("looks at the ring while the signature is made, and at the address when it is checked", () => {
    expect(tourFor(SIGN).map((s) => s.target.kind)).toContain("ring");
    expect(tourFor(VERIFY).map((s) => s.target.kind)).toContain("address");
    expect(tourFor(DERIVE).map((s) => s.target.kind)).toContain("address");
  });

  it("has no tour at the check and the honest take", () => {
    expect(tourFor(CHECK)).toEqual([]);
    expect(tourFor(HONEST)).toEqual([]);
  });
});
