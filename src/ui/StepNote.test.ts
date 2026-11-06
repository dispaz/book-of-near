import { describe, expect, it } from "vitest";
import { arrowFor, fitsMargin, placeNote, type Blocked } from "./StepNote";

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

/** Points along a quadratic path "M sx,sy Q mx,my ex,ey". */
function pointsOf(path: string, n = 40): [number, number][] {
  const [sx, sy, mx, my, ex, ey] = path.match(/-?[\d.]+/g)!.map(Number);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * sx! + 2 * u * t * mx! + t * t * ex!, u * u * sy! + 2 * u * t * my! + t * t * ey!];
  });
}
const inRect = (r: { left: number; top: number; right: number; bottom: number }) => (x: number, y: number) =>
  x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

describe("arrowFor", () => {
  const card = { left: 16, top: 380, right: 396, bottom: 500 };
  const target = { left: 1000, top: 420, right: 1060, bottom: 460 };

  it("draws the usual gentle arc when nothing is in the way", () => {
    const g = arrowFor(target, card);
    // Ends at the element's near (left) side.
    expect(g.tip[0]).toBe(990);
    expect(g.tip[1]).toBeGreaterThan(400);
  });

  it("goes around a card that sits between the note and the element", () => {
    // Another card, level with both, between them: the straight-ish arc would cross it.
    const other = { left: 500, top: 330, right: 900, bottom: 540 };
    const blocked: Blocked = inRect(other);
    expect(pointsOf(arrowFor(target, card).path).some(([x, y]) => blocked(x, y))).toBe(true);
    const g = arrowFor(target, card, blocked);
    expect(pointsOf(g.path).some(([x, y]) => blocked(x, y))).toBe(false);
  });

  it("keeps the default arc when every route is blocked equally", () => {
    const g = arrowFor(target, card, () => true);
    expect(g.path).toBe(arrowFor(target, card).path);
  });
});
