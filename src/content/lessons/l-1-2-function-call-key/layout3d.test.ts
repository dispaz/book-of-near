import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import { layout, layoutFor } from "./layout3d";

const inside = (f: Focus, [x, , z]: readonly number[]) =>
  Math.abs(x! - f.center[0]) <= f.width / 2 + 1e-9 && Math.abs(z! - f.center[2]) <= f.depth / 2 + 1e-9;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

for (const tall of [false, true]) {
  const L = layout(tall);
  const places = [L.APP, L.HOME, L.COUNTER, L.THIEF, L.OTHER];

  describe(`3D shot (${tall ? "two rows" : "one row"})`, () => {
    it("keeps the app, your account, its counter, the attacker, the registrar, both keys and the hint in view", () => {
      for (const p of [...places, L.MY_KEY, L.APP_KEY]) expect(inside(L.shot, p)).toBe(true);
      // One row leaves room below the shot for the hint; two rows frame it in.
      if (tall) expect(inside(L.shot, L.HINT)).toBe(true);
    });
  });

  describe(`the transaction parcel (${tall ? "two rows" : "one row"})`, () => {
    it("stays in view wherever it goes", () => {
      for (const aim of [null, "count", "send", "other", "addkey"] as const)
        expect(inside(L.shot, L.parcelAt(aim))).toBe(true);
    });

    it("goes to what the transaction aims at", () => {
      const at = { count: L.COUNTER, send: L.THIEF, other: L.OTHER, addkey: L.HOME } as const;
      for (const [aim, target] of Object.entries(at)) {
        const p = L.parcelAt(aim as keyof typeof at);
        for (const other of places)
          if (other !== target) expect(dist(p, target)).toBeLessThan(dist(p, other));
      }
    });

    it("waits by the app before anything is sent", () => {
      const p = L.parcelAt(null);
      for (const other of places) if (other !== L.APP) expect(dist(p, L.APP)).toBeLessThan(dist(p, other));
    });
  });

  describe(`the two keys (${tall ? "two rows" : "one row"})`, () => {
    it("hangs your key by your mailbox and the app's key by the app", () => {
      expect(dist(L.MY_KEY, L.HOME)).toBeLessThan(dist(L.MY_KEY, L.APP));
      expect(dist(L.APP_KEY, L.APP)).toBeLessThan(dist(L.APP_KEY, L.HOME));
    });
  });

  describe(`nothing stands on anything else (${tall ? "two rows" : "one row"})`, () => {
    it("keeps the five places apart", () => {
      for (const a of places) for (const b of places) if (a !== b) expect(dist(a, b)).toBeGreaterThan(1.8);
    });
  });
}

describe("which arrangement a 3D window gets", () => {
  it("puts the five places in two rows in a tall or square window (phones), so the picture is larger", () => {
    expect(layoutFor(340, 380).tall).toBe(true);
    expect(layoutFor(760, 480).tall).toBe(false);
    expect(layoutFor(520, 270).tall).toBe(false);
  });

  it("in two rows the scene is far narrower, so a narrow window draws it larger", () => {
    const one = layout(false).shot;
    const two = layout(true).shot;
    expect(two.width).toBeLessThan(one.width * 0.75);
  });

  it("looks down more steeply in two rows", () => {
    expect(layout(true).shot.elevation!).toBeGreaterThan(layout(false).shot.elevation!);
  });

  it("uses short labels in a narrow window, where long ones would touch", () => {
    expect(layoutFor(340, 380).shortLabels).toBe(true);
    expect(layoutFor(520, 270).shortLabels).toBe(true);
    expect(layoutFor(750, 500).shortLabels).toBe(true);
    expect(layoutFor(930, 500).shortLabels).toBe(false);
  });

  it("uses short names in a narrow window, where the names of neighbours would touch", () => {
    expect(layoutFor(520, 270).shortNames).toBe(true);
    expect(layoutFor(340, 380).shortNames).toBe(true);
    expect(layoutFor(750, 500).shortNames).toBe(false);
  });
});
