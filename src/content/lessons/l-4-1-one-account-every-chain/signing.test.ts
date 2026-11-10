import { describe, expect, it } from "vitest";
import { cleanPath, NODES, sharesLit, shortHex, shortName, THRESHOLD } from "./signing";

describe("sharesLit: how many nodes have added their share", () => {
  it("none before the request, all once the answer is back", () => {
    expect(sharesLit("idle", 0)).toBe(0);
    expect(sharesLit("answered", 0)).toBe(NODES);
  });

  it("grows while the request waits, but never reaches the threshold before the answer", () => {
    const early = sharesLit("waiting", 1000);
    const late = sharesLit("waiting", 4500);
    expect(early).toBeLessThan(late);
    expect(sharesLit("waiting", 60_000)).toBe(THRESHOLD - 1);
    expect(sharesLit("sending", 300)).toBe(0);
  });
});

describe("cleanPath", () => {
  it("accepts a short label and trims it", () => {
    expect(cleanPath("  ethereum-1 ")).toEqual({ ok: true, path: "ethereum-1" });
    expect(cleanPath("eth/defi")).toEqual({ ok: true, path: "eth/defi" });
  });
  it("refuses an empty or too long path", () => {
    expect(cleanPath("   ").ok).toBe(false);
    expect(cleanPath("x".repeat(65)).ok).toBe(false);
  });
});

describe("short forms", () => {
  it("shortens hex and long implicit account ids, keeps names", () => {
    expect(shortHex("0x2F9e1556Ae1F8Fa558C6cDC25257dE8253511280")).toBe("0x2F9e15…1280");
    expect(shortName("a".repeat(64))).toBe("aaaaaa…aaaa");
    expect(shortName("ana.testnet")).toBe("ana.testnet");
  });
});
