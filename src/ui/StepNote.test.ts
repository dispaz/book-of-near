import { describe, expect, it } from "vitest";
import { placeNote } from "./StepNote";

const free = { left: 16, top: 120, right: 1424, bottom: 812 };
const size = { w: 380, h: 140 };

describe("placeNote", () => {
  it("puts the note in the page margin, level with an element to its right", () => {
    const margin = { left: 16, top: 120, right: 396, bottom: 700 };
    const g = placeNote({ left: 800, top: 400, right: 840, bottom: 440 }, size, free, [], margin);
    expect(g.x).toBe(16);
    expect(g.y).toBe(420 - 70);
    // The arrow ends next to the element, not inside the note.
    expect(g.tip[0]).toBeGreaterThan(780);
  });

  it("keeps the note inside the margin when the element is near the top", () => {
    const margin = { left: 16, top: 120, right: 396, bottom: 700 };
    const g = placeNote({ left: 800, top: 110, right: 840, bottom: 130 }, size, free, [], margin);
    expect(g.y).toBe(120);
  });

  it("without a margin, sits beside the element and never on top of it", () => {
    const anchor = { left: 600, top: 400, right: 700, bottom: 460 };
    const g = placeNote(anchor, size, free, []);
    const overlaps =
      g.x < anchor.right + 10 &&
      g.x + size.w > anchor.left - 10 &&
      g.y < anchor.bottom + 10 &&
      g.y + size.h > anchor.top - 10;
    expect(overlaps).toBe(false);
  });

  it("falls back to beside the element when the element is in the margin itself", () => {
    const margin = { left: 16, top: 120, right: 396, bottom: 700 };
    const g = placeNote({ left: 100, top: 400, right: 140, bottom: 440 }, size, free, [], margin);
    expect(g.x).toBeGreaterThan(140);
  });
});
