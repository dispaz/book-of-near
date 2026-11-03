import { describe, expect, it } from "vitest";
import { BOOK, pageHeight, spreadFor } from "./book";

describe("pageHeight", () => {
  it("is flat (y = 0) across the middle of a page, where objects stand", () => {
    for (const d of [1.2, 2, 4, 6]) expect(Math.abs(pageHeight(d, 7.6))).toBeLessThan(1e-9);
  });

  it("dips into the gutter at the spine", () => {
    expect(pageHeight(0, 7.6)).toBeCloseTo(-BOOK.valley);
    expect(pageHeight(0.3, 7.6)).toBeLessThan(0);
    expect(pageHeight(0.3, 7.6)).toBeGreaterThan(pageHeight(0, 7.6));
  });

  it("droops a little at the outer edge", () => {
    expect(pageHeight(7.6, 7.6)).toBeLessThan(0);
    expect(pageHeight(7.6, 7.6)).toBeGreaterThan(-0.1);
  });
});

describe("spreadFor", () => {
  it("makes an open spread that holds the given box with a margin", () => {
    const s = spreadFor({ minX: -6, maxX: 6, minZ: -3.5, maxZ: 4.5 });
    expect(s.pageWidth).toBeGreaterThanOrEqual(6 + 1);
    expect(s.pageWidth).toBeLessThan(6 + 2);
    expect(s.center[2] - s.pageDepth / 2).toBeLessThanOrEqual(-3.5 - 0.5);
    expect(s.center[2] + s.pageDepth / 2).toBeGreaterThanOrEqual(4.5 + 0.5);
  });

  it("keeps the spine at x = 0, so both pages are the same width", () => {
    const s = spreadFor({ minX: -2, maxX: 6, minZ: 0, maxZ: 1 });
    expect(s.center[0]).toBe(0);
    expect(s.pageWidth).toBeGreaterThanOrEqual(7);
  });
});
