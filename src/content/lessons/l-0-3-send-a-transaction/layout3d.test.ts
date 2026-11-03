import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import { DESK, NEW_BLOCK, NODE, RECEIVER, SENDER, shotFor } from "./layout3d";
import { ACCOUNT, BUILD, EXPLORER, FEE, FINAL, INCLUDED, SEND, SIGN } from "./useTransaction";

const inside = (f: Focus, [x, , z]: readonly number[]) =>
  Math.abs(x! - f.center[0]) <= f.width / 2 + 1e-9 && Math.abs(z! - f.center[2]) <= f.depth / 2 + 1e-9;

describe("3D shots", () => {
  it("shows the whole desk while you build, see the fee and sign (with your account on wide screens)", () => {
    for (const step of [BUILD, FEE, SIGN])
      for (const phone of [false, true]) {
        const f = shotFor(step, phone);
        expect(inside(f, DESK)).toBe(true);
        expect(inside(f, SENDER)).toBe(!phone);
        expect(inside(f, RECEIVER)).toBe(false);
      }
  });

  it("shows the node and the chain when you send", () => {
    for (const phone of [false, true]) {
      const f = shotFor(SEND, phone);
      expect(inside(f, NODE)).toBe(true);
      expect(inside(f, NEW_BLOCK)).toBe(true);
    }
  });

  it("shows both accounts and the new block in the overview steps", () => {
    for (const step of [ACCOUNT, INCLUDED, FINAL, EXPLORER]) {
      const f = shotFor(step, false);
      for (const p of [SENDER, RECEIVER, NODE, NEW_BLOCK]) expect(inside(f, p)).toBe(true);
    }
  });

  it("looks down more steeply on phones' short windows", () => {
    expect(shotFor(ACCOUNT, true).elevation!).toBeGreaterThan(shotFor(ACCOUNT, false).elevation!);
  });
});
