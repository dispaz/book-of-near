import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import { MADE, MAX_SLABS, RECEIVER, SIGNER, slabY, stackAt, shot } from "./layout3d";

const inside = (f: Focus, [x, , z]: readonly number[]) =>
  Math.abs(x! - f.center[0]) <= f.width / 2 + 1e-9 && Math.abs(z! - f.center[2]) <= f.depth / 2 + 1e-9;

describe("3D shot", () => {
  it("keeps the three accounts and the stack in view, on wide screens and phones", () => {
    for (const phone of [false, true])
      for (const p of [SIGNER, RECEIVER, MADE, stackAt(false), stackAt(true)])
        expect(inside(shot(phone), p)).toBe(true);
  });

  it("looks down more steeply on phones", () => {
    expect(shot(true).elevation!).toBeGreaterThan(shot(false).elevation!);
  });
});

describe("the stack", () => {
  it("moves toward the receiver once sent", () => {
    expect(stackAt(true)[0]).toBeGreaterThan(stackAt(false)[0]);
  });

  it("puts the first action on top", () => {
    expect(slabY(0, 3)).toBeGreaterThan(slabY(1, 3));
    expect(slabY(1, 3)).toBeGreaterThan(slabY(2, 3));
    expect(slabY(2, 3)).toBeGreaterThan(0);
  });

  it("stays within its box when the batch is long", () => {
    expect(slabY(0, MAX_SLABS + 3)).toBe(slabY(0, MAX_SLABS));
  });
});
