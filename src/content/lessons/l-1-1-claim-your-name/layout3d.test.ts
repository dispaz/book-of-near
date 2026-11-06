import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import { HEX, ME, NAMED, NEW_ACCOUNT, REGISTRAR, shotFor } from "./layout3d";
import { COMPARE, CREATE, HOOK, PICK } from "./useClaim";

const inside = (f: Focus, [x, , z]: readonly number[]) =>
  Math.abs(x! - f.center[0]) <= f.width / 2 + 1e-9 && Math.abs(z! - f.center[2]) <= f.depth / 2 + 1e-9;

describe("3D shots", () => {
  it("shows only your account on the hook", () => {
    const f = shotFor(HOOK, false);
    expect(inside(f, ME)).toBe(true);
    expect(inside(f, NEW_ACCOUNT)).toBe(false);
  });

  it("shows you, the registrar and the new account while you pick and create", () => {
    for (const step of [PICK, CREATE])
      for (const phone of [false, true]) {
        const f = shotFor(step, phone);
        for (const p of [ME, REGISTRAR, NEW_ACCOUNT]) expect(inside(f, p)).toBe(true);
      }
  });

  it("shows the named account beside its hex twin on the compare step", () => {
    const f = shotFor(COMPARE, false);
    expect(inside(f, NAMED)).toBe(true);
    expect(inside(f, HEX)).toBe(true);
  });

  it("looks down more steeply on phones' short windows", () => {
    expect(shotFor(PICK, true).elevation!).toBeGreaterThan(shotFor(PICK, false).elevation!);
  });
});
