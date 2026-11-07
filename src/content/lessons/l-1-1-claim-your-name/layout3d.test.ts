import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import { mailboxDims } from "../../../scene-kit/objects";
import { HEX, ME, NAMED, NEW_ACCOUNT, OBJ, REGISTRAR, SIZE, coinAt, parcelAt, shotFor } from "./layout3d";
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

describe("the create transaction", () => {
  it("waits as a parcel at your mailbox until you send it", () => {
    expect(Math.abs(parcelAt({ busy: false, created: false })[0] - ME[0])).toBeLessThan(1.5);
  });
  it("is delivered to the registrar while it runs and after", () => {
    // Beside the registrar (in front of it, so they do not overlap), far from your mailbox.
    for (const s of [
      { busy: true, created: false },
      { busy: false, created: true },
    ]) {
      const [x] = parcelAt(s);
      expect(Math.abs(x - REGISTRAR[0])).toBeLessThan(1.2);
      expect(Math.abs(x - ME[0])).toBeGreaterThan(2);
    }
  });
  it("sends no coin on before the account exists, then lands the coin in the new mailbox", () => {
    expect(coinAt({ busy: false, created: false })).toBeNull();
    expect(coinAt({ busy: true, created: false })![0]).toBe(REGISTRAR[0]);
    expect(Math.abs(coinAt({ busy: false, created: true })![0] - NEW_ACCOUNT[0])).toBeLessThan(1.5);
  });
  it("stands the parcel and the coin on the ground, clear of the objects beside them", () => {
    const half = mailboxDims(OBJ).width / 2 + 0.2;
    const waiting = parcelAt({ busy: false, created: false });
    expect(waiting[1]).toBe(0);
    expect(Math.abs(waiting[0] - ME[0])).toBeGreaterThan(half);
    const coin = coinAt({ busy: false, created: true })!;
    expect(coin[1]).toBeLessThan(0.2);
    expect(Math.abs(coin[0] - NEW_ACCOUNT[0])).toBeGreaterThan(half);
  });
  it("draws the objects bigger than the layout unit, so they fill the frame like the old blocks", () => {
    expect(OBJ).toBeGreaterThan(SIZE);
  });
});
