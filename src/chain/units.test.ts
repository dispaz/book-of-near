import { describe, expect, it } from "vitest";
import { formatNear, formatTgas, GAS_PER_TGAS, parseNear, tgas, YOCTO_PER_NEAR } from "./units";

describe("units", () => {
  it("parses NEAR decimals exactly into yoctoNEAR", () => {
    expect(parseNear("1")).toBe(YOCTO_PER_NEAR);
    expect(parseNear("0.01")).toBe(10_000_000_000_000_000_000_000n);
    expect(parseNear(0.01)).toBe(10_000_000_000_000_000_000_000n);
    expect(parseNear("0.000000000000000000000001")).toBe(1n);
    expect(() => parseNear("1.0000000000000000000000001")).toThrow();
    expect(() => parseNear("abc")).toThrow();
  });

  it("formats yoctoNEAR without float rounding", () => {
    expect(formatNear(parseNear("4.989955"))).toBe("4.989955");
    expect(formatNear(parseNear("5"))).toBe("5");
    expect(formatNear(44_636_512_500_000_000_000n, 8)).toBe("0.00004463");
    expect(formatNear(-parseNear("0.5"))).toBe("-0.5");
  });

  it("converts Tgas", () => {
    expect(tgas(30)).toBe(30n * GAS_PER_TGAS);
    expect(tgas("0.45")).toBe(450_000_000_000n);
    expect(formatTgas(446_365_125_000n)).toBe("0.45");
    expect(formatTgas(tgas(30))).toBe("30");
  });
});
