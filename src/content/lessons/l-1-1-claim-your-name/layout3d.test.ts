import { describe, expect, it } from "vitest";
import { mailboxDims } from "../../../scene-kit/objects";
import {
  boxOf,
  coinAt,
  FIGURE,
  ME,
  NEW_ACCOUNT,
  OBJ,
  parcelAt,
  partsAt,
  REGISTRAR,
  type Part,
} from "./layout3d";
import { CHECK, COMPARE, CREATE, HONEST, HOOK, PICK } from "./useClaim";

describe("the figure on the right page", () => {
  it("shows only your account on the hook", () => {
    expect(partsAt(HOOK)).toEqual(["me"]);
  });

  it("shows you, the registrar and the new account while you pick and create", () => {
    for (const step of [PICK, CREATE, CHECK, HONEST])
      expect(partsAt(step)).toEqual(["me", "registrar", "new"]);
  });

  it("shows the named account beside its hex twin on the compare step", () => {
    expect(partsAt(COMPARE)).toEqual(["named", "hex"]);
  });

  it("keeps every part, with its labels, inside the figure box", () => {
    const parts: Part[] = ["me", "registrar", "new", "named", "hex"];
    for (const p of parts) {
      const [minX, maxX, minZ, maxZ] = boxOf(p);
      expect(minX).toBeGreaterThanOrEqual(FIGURE.minX);
      expect(maxX).toBeLessThanOrEqual(FIGURE.maxX);
      expect(minZ).toBeGreaterThanOrEqual(FIGURE.minZ);
      expect(maxZ).toBeLessThanOrEqual(FIGURE.maxZ);
    }
  });
});

describe("the create transaction", () => {
  it("waits as a parcel at your mailbox until you send it", () => {
    expect(Math.abs(parcelAt({ busy: false, created: false })[0] - ME[0])).toBeLessThan(1.5);
  });
  it("is delivered to the registrar while it runs and after", () => {
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
});
