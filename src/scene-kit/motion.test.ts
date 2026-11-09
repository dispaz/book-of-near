import { describe, expect, it } from "vitest";
import { arcPoint, easeInOut, fitView, isClick, ORBIT, orbitLimits, toFlat } from "./motion";

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

describe("orbitLimits", () => {
  const deg = (r: number) => (r * 180) / Math.PI;
  const front = { target: [0, 0, 0], position: [0, 12, 16] } as const; // 20 away, straight in front

  it("lets the learner turn 45° either way of the step's view: a 90° wedge, not all the way round", () => {
    const l = orbitLimits(front, 3, 140);
    expect(deg(l.minAzimuth)).toBeCloseTo(-45);
    expect(deg(l.maxAzimuth)).toBeCloseTo(45);
  });

  it("centres the wedge on a view seen from the side", () => {
    const a = (-18 * Math.PI) / 180;
    const side = { target: [0, 0, 0], position: [Math.sin(a) * 10, 5, Math.cos(a) * 10] } as const;
    const l = orbitLimits(side, 3, 140);
    expect(deg(l.minAzimuth)).toBeCloseTo(-18 - 45);
    expect(deg(l.maxAzimuth)).toBeCloseTo(-18 + 45);
  });

  it("wraps round when the view looks from behind", () => {
    const behind = { target: [0, 0, 0], position: [0.001, 5, -10] } as const;
    const l = orbitLimits(behind, 3, 140);
    expect(l.minAzimuth).toBeGreaterThan(l.maxAzimuth); // OrbitControls reads min > max as a wrapped range
    expect(Math.abs(l.minAzimuth)).toBeLessThanOrEqual(Math.PI);
    expect(Math.abs(l.maxAzimuth)).toBeLessThanOrEqual(Math.PI);
  });

  it("lets the learner zoom out only a little past the step's view", () => {
    expect(orbitLimits(front, 3, 140).maxDistance).toBeCloseTo(20 * ORBIT.zoomOut);
  });

  it("keeps the lesson's own ceiling, but never below the step's view", () => {
    expect(orbitLimits(front, 3, 22).maxDistance).toBe(22);
    expect(orbitLimits(front, 3, 15).maxDistance).toBeCloseTo(20);
  });
});
