import { describe, expect, it } from "vitest";
import { COLORS } from "./theme";
import {
  OBJECTS,
  gaugeShare,
  itemSlots,
  lookOf,
  mailboxDims,
  parcelDims,
  ribbonOutline,
  scrollDims,
  slipDims,
} from "./objects";

describe("lookOf", () => {
  it("fills an ok object with its accent, solid outline", () => {
    expect(lookOf("ok", COLORS.orange)).toEqual({
      fill: COLORS.orange,
      dashed: false,
      cross: false,
      struck: false,
    });
  });
  it("draws a pending object as a dashed outline with no fill", () => {
    expect(lookOf("pending", COLORS.orange)).toMatchObject({ fill: null, dashed: true });
  });
  it("fills a failed object red with a cross", () => {
    expect(lookOf("failed", COLORS.orange)).toMatchObject({ fill: COLORS.red, cross: true, dashed: false });
  });
  it("greys a gone object and strikes it out", () => {
    expect(lookOf("gone", COLORS.orange)).toMatchObject({ fill: COLORS.slab, struck: true });
  });
});

describe("gaugeShare", () => {
  it("is left / initial, clamped to 0..1", () => {
    expect(gaugeShare(50n, 100n)).toBe(0.5);
    expect(gaugeShare(150n, 100n)).toBe(1);
    expect(gaugeShare(-1n, 100n)).toBe(0);
  });
  it("is 0 when nothing is known or the initial is zero", () => {
    expect(gaugeShare(null, 100n)).toBe(0);
    expect(gaugeShare(5n, null)).toBe(0);
    expect(gaugeShare(5n, 0n)).toBe(0);
  });
});

describe("itemSlots", () => {
  it("is empty for no items", () => {
    expect(itemSlots(0, 4)).toEqual([]);
  });
  it("puts the first item at the top, each next one lower, all above the box", () => {
    const s = itemSlots(3, 4);
    expect(s).toHaveLength(3);
    expect(s[0]!.y).toBeGreaterThan(s[1]!.y);
    expect(s[1]!.y).toBeGreaterThan(s[2]!.y);
    expect(Math.min(...s.map((p) => p.y))).toBeGreaterThan(0);
  });
  it("shows at most `max` items", () => {
    expect(itemSlots(9, 4)).toHaveLength(4);
  });
});

describe("dimensions", () => {
  it("scale with size, and every object is about `size` tall", () => {
    for (const dims of [mailboxDims, parcelDims, scrollDims]) {
      const a = dims(1);
      const b = dims(2);
      expect(b.height).toBeCloseTo(a.height * 2);
      expect(a.height).toBeGreaterThan(0.6);
      expect(a.height).toBeLessThan(1.4);
    }
  });
  it("puts the mailbox door above its post", () => {
    const m = mailboxDims(1.6);
    expect(m.bodyY).toBeGreaterThan(m.post);
    expect(m.height).toBeCloseTo(m.post + m.body + m.width / 2);
  });
});

describe("OBJECTS", () => {
  it("names one shape per concept, with no shape used twice", () => {
    const shapes = Object.values(OBJECTS).map((o) => o.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(OBJECTS.account.shape).toBe("mailbox");
    expect(OBJECTS.transaction.shape).toBe("parcel");
    expect(OBJECTS.signature.shape).toBe("stamp");
    expect(OBJECTS.contract.shape).toBe("scroll");
    expect(OBJECTS.receipt.shape).toBe("slip");
    expect(OBJECTS.shard.shape).toBe("ribbon");
  });
});

describe("receipt slip and shard ribbon", () => {
  it("a slip is a small landscape card with a folded corner, scaling with size", () => {
    const a = slipDims(1);
    expect(a.width).toBeGreaterThan(a.height);
    expect(a.fold).toBeLessThan(a.height);
    expect(slipDims(2).width).toBeCloseTo(a.width * 2);
  });
  it("a ribbon lies flat along x with a swallowtail notch at its left end", () => {
    const r = ribbonOutline(4, 0.4);
    const xs = r.map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(-2);
    expect(Math.max(...xs)).toBeCloseTo(2);
    // The notch: a point on the left end's middle line that sits right of the end.
    expect(r.some(([x, z]) => z === 0 && x > -2 && x < -1.5)).toBe(true);
  });
});
