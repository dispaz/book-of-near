import { describe, expect, it } from "vitest";
import { arcPoint, clampLength, easeInOut, fitView, isClick, smoothDamp, toFlat } from "./motion";

describe("easeInOut", () => {
  it("starts at 0, ends at 1 and is symmetric", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.25) + easeInOut(0.75)).toBeCloseTo(1);
  });
  it("clamps values outside 0..1", () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
  });
});

describe("arcPoint", () => {
  const a = [0, 1, 0] as const;
  const b = [4, 1, 2] as const;
  it("starts at from and ends at to", () => {
    expect(arcPoint(a, b, 3, 0)).toEqual([0, 1, 0]);
    const end = arcPoint(a, b, 3, 1);
    expect(end[0]).toBeCloseTo(4);
    expect(end[1]).toBeCloseTo(1);
    expect(end[2]).toBeCloseTo(2);
  });
  it("lifts by the arc height in the middle", () => {
    const mid = arcPoint(a, b, 3, 0.5);
    expect(mid).toEqual([2, 4, 1]);
  });
});

describe("toFlat", () => {
  it("puts the camera straight above the target at the same distance or more", () => {
    const flat = toFlat({ position: [0, 6, 8], target: [1, 0, 0] });
    expect(flat.target).toEqual([1, 0, 0]);
    expect(flat.position[0]).toBe(1);
    expect(flat.position[2]).toBeCloseTo(0, 2);
    expect(flat.position[1]).toBeGreaterThanOrEqual(Math.hypot(1, 6, 8));
  });
});

describe("fitView", () => {
  const view = { position: [0, 4, 10] as const, target: [0, 0, 0] as const };
  it("keeps wide screens as they are", () => {
    expect(fitView(view, 1.6).position).toEqual([0, 4, 10]);
  });
  it("pulls the camera back on tall, narrow screens", () => {
    const narrow = fitView(view, 0.5).position;
    expect(narrow[2]).toBeGreaterThan(10);
    expect(narrow[1] / narrow[2]).toBeCloseTo(0.4);
  });
});

describe("isClick", () => {
  it("treats a move under 6 px as a click and anything more as a drag", () => {
    expect(isClick(0)).toBe(true);
    expect(isClick(5.9)).toBe(true);
    expect(isClick(6)).toBe(false);
    expect(isClick(40)).toBe(false);
  });
});

describe("smoothDamp", () => {
  const run = (fps: number, seconds: number) => {
    let x = 0;
    let v = 0;
    for (let i = 0; i < fps * seconds; i++) [x, v] = smoothDamp(x, 10, v, 0.5, 1 / fps);
    return x;
  };
  it("starts gently: the first frame moves only a little", () => {
    const [x] = smoothDamp(0, 10, 0, 0.5, 1 / 60);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(0.1);
  });
  it("gets most of the way in about two smooth times and never overshoots", () => {
    let x = 0;
    let v = 0;
    for (let i = 0; i < 300; i++) {
      [x, v] = smoothDamp(x, 10, v, 0.5, 1 / 60);
      expect(x).toBeLessThanOrEqual(10);
    }
    expect(run(60, 1)).toBeGreaterThan(9);
    expect(run(60, 3)).toBeCloseTo(10, 2);
  });
  it("moves the same at 30, 60 and 120 frames a second", () => {
    expect(run(30, 0.5)).toBeCloseTo(run(120, 0.5), 0);
    expect(Math.abs(run(60, 0.5) - run(120, 0.5))).toBeLessThan(0.15);
  });
  it("stands still when no time passes", () => {
    expect(smoothDamp(3, 10, 2, 0.5, 0)).toEqual([3, 2]);
  });
});

describe("clampLength", () => {
  it("leaves short offsets alone", () => {
    expect(clampLength([1, 0, 1], 5)).toEqual([1, 0, 1]);
  });
  it("shortens long offsets to the limit, same direction", () => {
    const [x, y, z] = clampLength([3, 0, 4], 2.5);
    expect(Math.hypot(x, y, z)).toBeCloseTo(2.5);
    expect(x / z).toBeCloseTo(3 / 4);
  });
});
