import { describe, expect, it } from "vitest";
import { markTransform, NEAR_MARK } from "./nearMark";

describe("NEAR_MARK", () => {
  it("is one closed path inside its 24 x 24 box", () => {
    expect(NEAR_MARK.path.startsWith("M")).toBe(true);
    expect(NEAR_MARK.path.trim().endsWith("z")).toBe(true);
    const [x, y, w, h] = NEAR_MARK.box;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(24);
    expect(y + h).toBeLessThanOrEqual(24);
  });
});

describe("markTransform", () => {
  it("centres the mark on the point and scales its longer side to the size", () => {
    const t = markTransform(100, 50, 28.8);
    expect(t).toBe("translate(100 50) scale(2 2) translate(-11.2 -10.7)");
  });

  it("squashes the height for a coin seen from above", () => {
    expect(markTransform(0, 0, 14.4, 0.4)).toContain("scale(1 0.4)");
  });
});
