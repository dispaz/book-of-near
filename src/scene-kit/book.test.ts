import { describe, expect, it } from "vitest";
import {
  BOOK,
  bookFootprint,
  clampToBox,
  curlProfile,
  pageHeight,
  spreadBeside,
  spreadFor,
  textBlock,
} from "./book";

describe("bookFootprint", () => {
  const s = spreadBeside({ minX: -4.4, maxX: 4.4, minZ: -3, maxZ: 3 });
  it("covers both pages plus a small margin (5 % of the spread, at least 0.5)", () => {
    const b = bookFootprint(s);
    const m = Math.max(0.5, 0.1 * s.pageWidth);
    expect(b.minX).toBeCloseTo(s.center[0] - s.pageWidth - m);
    expect(b.maxX).toBeCloseTo(s.center[0] + s.pageWidth + m);
    expect(b.maxZ - b.minZ).toBeCloseTo(s.pageDepth + 2 * m);
    expect(bookFootprint(s, 0).maxX).toBeCloseTo(s.center[0] + s.pageWidth);
  });
  it("reaches the middle of the right page, where the figure stands", () => {
    const b = bookFootprint(s);
    const rightMiddle = s.center[0] + s.pageWidth / 2;
    expect(clampToBox(rightMiddle, s.center[2], b)).toEqual([rightMiddle, s.center[2]]);
  });
  it("holds each axis on its own: far right stays at the right edge whatever the depth", () => {
    const b = bookFootprint(s);
    expect(clampToBox(99, 0, b)).toEqual([b.maxX, 0]);
    expect(clampToBox(99, 99, b)).toEqual([b.maxX, b.maxZ]);
    expect(clampToBox(-99, -99, b)).toEqual([b.minX, b.minZ]);
  });
});

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

describe("spreadBeside", () => {
  it("puts the whole box on the right page, with the spine just left of it", () => {
    const s = spreadBeside({ minX: -6, maxX: 6, minZ: -3, maxZ: 3 });
    const spine = s.center[0];
    expect(spine).toBeLessThan(-6);
    expect(spine).toBeGreaterThan(-8);
    expect(spine + s.pageWidth).toBeGreaterThan(6);
    expect(s.center[2] - s.pageDepth / 2).toBeLessThan(-3);
    expect(s.center[2] + s.pageDepth / 2).toBeGreaterThan(3);
  });
});

describe("textBlock", () => {
  it("lies on the flat part of the left page, clear of the gutter", () => {
    const s = spreadBeside({ minX: -6, maxX: 6, minZ: -3, maxZ: 3 });
    const t = textBlock(s);
    const spine = s.center[0];
    expect(t.x1).toBeLessThanOrEqual(spine - BOOK.gutter);
    expect(t.x0).toBeGreaterThan(spine - s.pageWidth);
    expect(t.x1 - t.x0).toBeGreaterThan(4);
    expect(t.z0).toBeGreaterThan(s.center[2] - s.pageDepth / 2);
    expect(t.z1).toBeLessThan(s.center[2] + s.pageDepth / 2);
    // Flat there: the page's height is 0 across the whole block.
    expect(pageHeight(spine - t.x1, s.pageWidth)).toBeCloseTo(0, 6);
    expect(pageHeight(spine - t.x0, s.pageWidth)).toBeCloseTo(0, 6);
  });
});

describe("curlProfile", () => {
  const W = 8;
  const length = (pts: [number, number][]) =>
    pts.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]), 0);

  it("lies on the right page before the turn and on the left page after it", () => {
    const start = curlProfile(0, W, 24);
    const end = curlProfile(Math.PI, W, 24);
    expect(start.at(-1)![0]).toBeCloseTo(W, 1);
    expect(end.at(-1)![0]).toBeCloseTo(-W, 1);
    for (const [, y] of [...start, ...end]) expect(Math.abs(y)).toBeLessThan(0.25);
  });

  it("keeps the page's length while it bends", () => {
    for (const t of [0.4, 1.2, Math.PI / 2, 2.5]) expect(length(curlProfile(t, W, 32))).toBeCloseTo(W, 0);
  });

  it("is lifted off the book half way through", () => {
    const mid = curlProfile(Math.PI / 2, W, 24);
    expect(Math.min(...mid.slice(4).map((p) => p[1]))).toBeGreaterThan(0.5);
  });
});
