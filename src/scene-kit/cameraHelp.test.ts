import { describe, expect, it } from "vitest";
import { helpFor, KEEP_NOTE, KEYS, MOUSE, TOUCH } from "./cameraHelp";

describe("helpFor", () => {
  it("lists the learner's own device first and always shows both pointers and the keyboard", () => {
    expect(helpFor(true).map((g) => g.kind)).toEqual(["touch", "mouse", "keys"]);
    expect(helpFor(false).map((g) => g.kind)).toEqual(["mouse", "touch", "keys"]);
  });
  it("names turn, zoom and slide for both pointers", () => {
    for (const g of [MOUSE, TOUCH]) expect(g.lines.map((l) => l.what)).toEqual(["Turn", "Zoom", "Slide"]);
  });
  it("keeps lines short (plain English, readable at phone width)", () => {
    for (const g of [MOUSE, TOUCH, KEYS])
      for (const l of g.lines) expect(l.how.length).toBeLessThanOrEqual(60);
    expect(KEEP_NOTE).toMatch(/Reset view/);
  });
});
