import { describe as group, expect, it } from "vitest";
import { RECORDED_QUOTE } from "../../../chain/intents";
import { CHECK, DECLARE, FILL, FINISH, HOOK, INSPECT } from "./steps";
import { delivered, describe, parcelSpot, pickResult, type FillPhase, type Obj } from "./swap";

const at = (step: number, more: Partial<Parameters<typeof pickResult>[1]> = {}) => ({
  step,
  quote: null,
  inspected: false,
  fill: "idle" as FillPhase,
  ...more,
});

group("picks (script, Reactions)", () => {
  it("the parcel and your account fetch the quote at step 2", () => {
    expect(pickResult("parcel", at(DECLARE)).act).toBe("quote");
    expect(pickResult("origin", at(DECLARE)).act).toBe("quote");
  });

  it("objects used too early say 'not yet' with the script's hint", () => {
    expect(pickResult("parcel", at(HOOK))).toMatchObject({
      notYet: true,
      note: "Declare your intent first.",
    });
    expect(pickResult("solver", at(HOOK))).toMatchObject({
      notYet: true,
      note: "Fetch an intent quote first.",
    });
    const q = { quote: RECORDED_QUOTE };
    expect(pickResult("destination", at(FILL, q))).toMatchObject({ notYet: true });
    expect(pickResult("verifier", at(INSPECT, q))).toMatchObject({
      notYet: true,
      note: "Simulate the solver first.",
    });
  });

  it("the parcel opens at step 3, the solver or the verifier fill at step 4", () => {
    const q = { quote: RECORDED_QUOTE };
    expect(pickResult("parcel", at(INSPECT, q)).act).toBe("inspect");
    expect(pickResult("solver", at(FILL, q)).act).toBe("fill");
    expect(pickResult("verifier", at(FILL, q)).act).toBe("fill");
  });

  it("after the step, every object shows a detail and acts no more", () => {
    const s = at(FINISH, { quote: RECORDED_QUOTE, inspected: true, fill: "done" });
    for (const o of ["origin", "parcel", "solver", "destination", "verifier", "arbitrum"] as Obj[]) {
      const r = pickResult(o, s);
      expect(r.act, o).toBeUndefined();
      expect(r.notYet, o).toBeFalsy();
      expect(r.note.length, o).toBeGreaterThan(10);
    }
    expect(pickResult("parcel", s).note).toContain("20.0673 USDC");
    expect(pickResult("destination", s).note).toContain("20.27 USDC");
  });
});

group("the fill", () => {
  it("the USDC counts as delivered from the settle phase", () => {
    expect(delivered("deliver")).toBe(false);
    expect(delivered("settle")).toBe(true);
    expect(delivered("done")).toBe(true);
  });

  it("the parcel goes home → solver → verifier (locked) → solver (released)", () => {
    expect(parcelSpot(DECLARE, "idle")).toBe("home");
    expect(parcelSpot(INSPECT, "idle")).toBe("solver");
    expect(parcelSpot(FILL, "lock")).toBe("verifier");
    expect(parcelSpot(FILL, "settle")).toBe("verifier");
    expect(parcelSpot(FILL, "done")).toBe("solver");
    expect(parcelSpot(FINISH, "done")).toBe("solver");
  });

  it("every step has a description", () => {
    for (let s = HOOK; s <= CHECK; s++) expect(describe(at(s)).length).toBeGreaterThan(20);
  });
});
