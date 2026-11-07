import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import { APP, APP_KEY, COUNTER, HOME, MY_KEY, OTHER, THIEF, parcelAt, shot } from "./layout3d";

const inside = (f: Focus, [x, , z]: readonly number[]) =>
  Math.abs(x! - f.center[0]) <= f.width / 2 + 1e-9 && Math.abs(z! - f.center[2]) <= f.depth / 2 + 1e-9;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

describe("3D shot", () => {
  it("keeps the app, your account, its counter, the attacker and the registrar in view", () => {
    for (const phone of [false, true])
      for (const p of [APP, HOME, COUNTER, THIEF, OTHER, MY_KEY, APP_KEY])
        expect(inside(shot(phone), p)).toBe(true);
  });

  it("looks down more steeply on phones", () => {
    expect(shot(true).elevation!).toBeGreaterThan(shot(false).elevation!);
  });
});

describe("the transaction parcel", () => {
  it("stays in view wherever it goes", () => {
    for (const aim of [null, "count", "send", "other", "addkey"] as const)
      expect(inside(shot(false), parcelAt(aim))).toBe(true);
  });

  it("goes to what the transaction aims at", () => {
    const places = { count: COUNTER, send: THIEF, other: OTHER, addkey: HOME } as const;
    for (const [aim, target] of Object.entries(places)) {
      const p = parcelAt(aim as keyof typeof places);
      for (const other of [APP, HOME, COUNTER, THIEF, OTHER])
        if (other !== target) expect(dist(p, target)).toBeLessThan(dist(p, other));
    }
  });

  it("waits by the app before anything is sent", () => {
    const p = parcelAt(null);
    for (const other of [HOME, COUNTER, THIEF, OTHER]) expect(dist(p, APP)).toBeLessThan(dist(p, other));
  });
});

describe("the two keys", () => {
  it("hangs your key by your mailbox and the app's key by the app", () => {
    expect(dist(MY_KEY, HOME)).toBeLessThan(dist(MY_KEY, APP));
    expect(dist(APP_KEY, APP)).toBeLessThan(dist(APP_KEY, HOME));
  });
});
