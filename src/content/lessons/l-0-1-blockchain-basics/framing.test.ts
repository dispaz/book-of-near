import { describe, expect, it } from "vitest";
import { fovFor, frameCamera, inset, pullBackFor, viewOffset, type Focus } from "./framing";

const focus: Focus = { center: [0, 0, 0], width: 10, depth: 0, height: 0, elevation: 0 };
const dist = (p: readonly number[], t: readonly number[]) =>
  Math.hypot(p[0]! - t[0]!, p[1]! - t[1]!, p[2]! - t[2]!);

describe("frameCamera", () => {
  it("looks at the centre of the focus box", () => {
    const v = frameCamera(
      { ...focus, center: [2, 1, -3] },
      { left: 0, top: 0, right: 1280, bottom: 800 },
      1280,
      800,
    );
    expect(v.target).toEqual([2, 1, -3]);
  });

  it("puts a box exactly across the free width (margin 1)", () => {
    const frame = { left: 448, top: 0, right: 1248, bottom: 800 };
    const v = frameCamera(focus, frame, 1280, 800, 1);
    const d = dist(v.position, v.target);
    const pxPerUnit = 800 / (2 * d * Math.tan(((fovFor(1.6) / 2) * Math.PI) / 180));
    expect(10 * pxPerUnit).toBeCloseTo(800, 3);
  });

  it("moves back when the free area shrinks", () => {
    const wide = frameCamera(focus, { left: 0, top: 0, right: 800, bottom: 800 }, 1280, 800);
    const narrow = frameCamera(focus, { left: 0, top: 0, right: 400, bottom: 800 }, 1280, 800);
    expect(dist(narrow.position, narrow.target)).toBeCloseTo(2 * dist(wide.position, wide.target), 5);
  });

  it("undoes the camera rig's pull-back on phones", () => {
    const frame = { left: 0, top: 0, right: 390, bottom: 300 };
    const v = frameCamera(focus, frame, 390, 760, 1);
    const d = dist(v.position, v.target) * pullBackFor(390 / 760);
    const pxPerUnit = 760 / (2 * d * Math.tan(((fovFor(390 / 760) / 2) * Math.PI) / 180));
    expect(10 * pxPerUnit).toBeCloseTo(390, 3);
  });

  it("raises the camera by the elevation", () => {
    const v = frameCamera(
      { ...focus, elevation: 90 },
      { left: 0, top: 0, right: 800, bottom: 800 },
      800,
      800,
    );
    expect(v.position[0]).toBeCloseTo(0);
    expect(v.position[2]).toBeCloseTo(0);
    expect(v.position[1]).toBeGreaterThan(0);
  });
});

describe("inset", () => {
  it("takes the reserved margins off the frame", () => {
    expect(
      inset({ left: 0, top: 100, right: 400, bottom: 500 }, { left: 90, right: 90, bottom: 60 }),
    ).toEqual({
      left: 90,
      top: 100,
      right: 310,
      bottom: 440,
    });
  });
  it("never leaves less than 80 px", () => {
    expect(inset({ left: 0, top: 0, right: 100, bottom: 100 }, { left: 60, right: 60 }).right).toBe(140);
  });
});

describe("viewOffset", () => {
  it("is zero when the frame is centred", () => {
    expect(viewOffset({ left: 0, top: 0, right: 1280, bottom: 800 }, 1280, 800)).toEqual({ x: 0, y: 0 });
  });
  it("shifts the picture right and up to the free area's centre", () => {
    // Free area right of a 448 px card: centre at x 864, so the picture shifts by -224.
    expect(viewOffset({ left: 448, top: 100, right: 1280, bottom: 700 }, 1280, 800)).toEqual({
      x: -224,
      y: 0,
    });
  });
});
