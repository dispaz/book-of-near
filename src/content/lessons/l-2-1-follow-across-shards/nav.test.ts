import { describe, expect, it } from "vitest";
import { hopNav } from "./nav";

describe("hopNav (step 4: back and forward through the hops)", () => {
  it("cannot go back from the first hop", () => {
    expect(hopNav({ reached: 0, looking: 0, last: 6 })).toEqual({
      at: 0,
      canPrev: false,
      canNext: true,
      nextFollows: true,
    });
  });

  it("steps forward through hops already reached without following on", () => {
    const n = hopNav({ reached: 4, looking: 1, last: 6 });
    expect(n).toMatchObject({ at: 1, canPrev: true, canNext: true, nextFollows: false });
  });

  it("follows on from the newest hop", () => {
    expect(hopNav({ reached: 4, looking: 4, last: 6 }).nextFollows).toBe(true);
  });

  it("stops at the last hop", () => {
    expect(hopNav({ reached: 6, looking: 6, last: 6 })).toMatchObject({ canNext: false, nextFollows: false });
  });

  it("never looks past what is reached", () => {
    expect(hopNav({ reached: 2, looking: 5, last: 6 }).at).toBe(2);
  });
});
