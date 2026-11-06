import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import { AGENT, HOME, OTHER, THIEF, keyAt, shot } from "./layout3d";

const inside = (f: Focus, [x, , z]: readonly number[]) =>
  Math.abs(x! - f.center[0]) <= f.width / 2 + 1e-9 && Math.abs(z! - f.center[2]) <= f.depth / 2 + 1e-9;

describe("3D shot", () => {
  it("keeps all four places in view, on wide screens and phones", () => {
    for (const phone of [false, true])
      for (const p of [AGENT, HOME, THIEF, OTHER]) expect(inside(shot(phone), p)).toBe(true);
  });

  it("looks down more steeply on phones", () => {
    expect(shot(true).elevation!).toBeGreaterThan(shot(false).elevation!);
  });

  it("keeps the key in view wherever it goes", () => {
    for (const aim of [null, "count", "send", "other", "addkey"] as const)
      expect(inside(shot(false), keyAt(aim))).toBe(true);
  });

  it("rests the key at the thing it tried to reach", () => {
    expect(keyAt("send")[0]).toBe(THIEF[0]);
    expect(keyAt("other")[0]).toBe(OTHER[0]);
    expect(keyAt(null)[0]).toBeLessThan(HOME[0]);
  });
});
