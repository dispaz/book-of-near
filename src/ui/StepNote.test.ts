import { describe, expect, it } from "vitest";
import { fitsMargin, placeNote } from "./StepNote";

const size = { w: 380, h: 140 };
const margin = { left: 16, top: 120, right: 396, bottom: 700 };

describe("placeNote", () => {
  it("puts the note in the page margin, level with an element to its right", () => {
    const g = placeNote({ left: 800, top: 400, right: 840, bottom: 440 }, size, margin);
    expect(g.x).toBe(16);
    expect(g.y).toBe(420 - 70);
    // The arrow ends next to the element, not inside the note.
    expect(g.tip[0]).toBeGreaterThan(780);
  });

  it("keeps the note inside the margin when the element is near the top", () => {
    const g = placeNote({ left: 800, top: 110, right: 840, bottom: 130 }, size, margin);
    expect(g.y).toBe(120);
  });

  it("floats only when the element is right of the margin and the note fits in it", () => {
    expect(fitsMargin({ left: 800, top: 400, right: 840, bottom: 440 }, size, margin)).toBe(true);
    // The element is in the margin itself, or the margin is shorter than the note: dock instead.
    expect(fitsMargin({ left: 100, top: 400, right: 140, bottom: 440 }, size, margin)).toBe(false);
    expect(
      fitsMargin({ left: 800, top: 400, right: 840, bottom: 440 }, size, { ...margin, bottom: 200 }),
    ).toBe(false);
  });
});
