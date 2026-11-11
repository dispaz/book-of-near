import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanPath,
  FINALE_MS,
  finaleRunner,
  rsvRows,
  type Finale,
  isWaiting,
  NODES,
  parcelSpot,
  secondsLeft,
  expectedSignMs,
  EXPECTED_MS,
  sharesIn,
  sharesLit,
  shortHex,
  shortName,
  signAnim,
  slipsShown,
  THRESHOLD,
} from "./signing";

describe("sharesLit: how many nodes have added their share", () => {
  it("none before the request, the threshold (not every node) once the answer is back", () => {
    expect(sharesLit("idle", 0)).toBe(0);
    expect(sharesLit("answered", 0)).toBe(THRESHOLD);
    expect(THRESHOLD).toBeLessThan(NODES);
  });

  it("isWaiting and the countdown", () => {
    expect(isWaiting("sending")).toBe(true);
    expect(isWaiting("waiting")).toBe(true);
    expect(isWaiting("answered")).toBe(false);
    expect(secondsLeft(0)).toBe(6);
    expect(secondsLeft(4000)).toBe(2);
    expect(secondsLeft(9000)).toBe(0);
  });

  it("expects a longer wait on the real testnet signer than on the demo one", () => {
    expect(expectedSignMs("demo")).toBe(EXPECTED_MS);
    // Measured on testnet, 11 Nov 2026: 6.7 to 13.9 s from send to final (docs/spikes-seed.md).
    expect(expectedSignMs("testnet")).toBe(10_000);
    expect(secondsLeft(0, expectedSignMs("testnet"))).toBe(10);
    expect(sharesLit("waiting", 5000, expectedSignMs("testnet"))).toBe(THRESHOLD / 2);
  });

  it("grows while the request waits, but never reaches the threshold before the answer", () => {
    const early = sharesLit("waiting", 1000);
    const late = sharesLit("waiting", 4500);
    expect(early).toBeLessThan(late);
    expect(sharesLit("waiting", 60_000)).toBe(THRESHOLD - 1);
    expect(sharesLit("sending", 300)).toBe(0);
  });
});

describe("the signing animation follows the real wait", () => {
  it("travel while sending, work while waiting, then the finale, then done", () => {
    expect(signAnim("idle", null)).toBe("idle");
    expect(signAnim("sending", null)).toBe("travel");
    expect(signAnim("waiting", null)).toBe("work");
    expect(signAnim("answered", "shares")).toBe("shares");
    expect(signAnim("answered", "sealed")).toBe("sealed");
    expect(signAnim("answered", null)).toBe("done");
    expect(signAnim("failed", null)).toBe("idle");
    expect(FINALE_MS.shares + FINALE_MS.sealed).toBeLessThan(2000);
  });

  it("gathers the lit shares while waiting, the threshold's at the finale, none once sealed", () => {
    expect(sharesIn("travel", 0)).toBe(0);
    expect(sharesIn("work", 3)).toBe(3);
    expect(sharesIn("shares", 3)).toBe(THRESHOLD);
    expect(sharesIn("sealed", THRESHOLD)).toBe(0);
    expect(sharesIn("done", THRESHOLD)).toBe(0);
  });

  it("forms the r, s and v slips at the seal and keeps them", () => {
    expect(slipsShown("work")).toBe(false);
    expect(slipsShown("shares")).toBe(false);
    expect(slipsShown("sealed")).toBe(true);
    expect(slipsShown("done")).toBe(true);
  });

  it("writes the slips as r, s and v with its value", () => {
    expect(rsvRows(1)).toEqual(["r", "s", "v 1"]);
    expect(rsvRows(0)).toEqual(["r", "s", "v 0"]);
  });

  it("keeps the parcel in the ring from the request to the end of the finale, then delivers it", () => {
    expect(parcelSpot("idle", true, false)).toBe("near");
    for (const a of ["travel", "work", "shares", "sealed"] as const)
      expect(parcelSpot(a, true, false)).toBe("signer");
    expect(parcelSpot("done", true, false)).toBe("near");
    expect(parcelSpot("done", false, true)).toBe("ethereum");
    // Off the signing step the parcel is never in the ring.
    expect(parcelSpot("work", false, false)).toBe("near");
  });
});

describe("finaleRunner: the finale's timers", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const total = FINALE_MS.shares + FINALE_MS.sealed;

  it("plays shares, then sealed, then settles", () => {
    const seen: Finale[] = [];
    const run = finaleRunner((f) => seen.push(f));
    run.play();
    vi.advanceTimersByTime(total);
    expect(seen).toEqual(["shares", "sealed", null]);
  });

  it("cancel (a new path) stops the pending steps", () => {
    const seen: Finale[] = [];
    const run = finaleRunner((f) => seen.push(f));
    run.play();
    run.cancel();
    vi.advanceTimersByTime(total);
    expect(seen).toEqual(["shares"]);
  });

  it("playing again clears the old timers first, so the finale runs once", () => {
    const seen: Finale[] = [];
    const run = finaleRunner((f) => seen.push(f));
    run.play();
    vi.advanceTimersByTime(FINALE_MS.shares / 2);
    run.play();
    vi.advanceTimersByTime(total * 2);
    expect(seen).toEqual(["shares", "shares", "sealed", null]);
  });

  it("after dispose (unmount) a late play, after an await, schedules nothing", () => {
    const seen: Finale[] = [];
    const run = finaleRunner((f) => seen.push(f));
    run.play();
    run.dispose();
    run.play();
    vi.advanceTimersByTime(total);
    expect(seen).toEqual(["shares"]);
    expect(vi.getTimerCount()).toBe(0);
    // React's dev double mount brings it back.
    run.revive();
    run.play();
    vi.advanceTimersByTime(total);
    expect(seen).toEqual(["shares", "shares", "sealed", null]);
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
