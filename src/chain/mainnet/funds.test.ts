import { describe, expect, it } from "vitest";
import { parseNear } from "../units";
import { checkFunds } from "./funds";
import type { WalletState } from "./types";

const connected = (near: string): WalletState => ({
  status: "connected",
  accountId: "ana.near",
  balance: parseNear(near),
});

describe("checkFunds", () => {
  it("says no-wallet when nobody is connected, and offers the testnet fallback", () => {
    const r = checkFunds({ status: "disconnected" }, { amount: parseNear("0.01") });
    expect(r.kind).toBe("no-wallet");
    expect(r.fallback).toBe("testnet");
    expect(r.message).toMatch(/connect/i);
  });

  it("says no-wallet while connecting or after an error", () => {
    expect(checkFunds({ status: "connecting" }, { amount: 1n }).kind).toBe("no-wallet");
    expect(checkFunds({ status: "error", message: "x" }, { amount: 1n }).kind).toBe("no-wallet");
  });

  it("says enough when the balance covers the amount plus the fee reserve", () => {
    const r = checkFunds(connected("1"), { amount: parseNear("0.5") });
    expect(r).toMatchObject({ kind: "enough", fallback: null });
  });

  it("says not-enough with the shortfall when the balance is too low", () => {
    // 0.5 + default reserve 0.01 = 0.51 needed, 0.3 available -> short by 0.21
    const r = checkFunds(connected("0.3"), { amount: parseNear("0.5") });
    expect(r.kind).toBe("not-enough");
    if (r.kind === "not-enough") {
      expect(r.shortfall).toBe(parseNear("0.21"));
      expect(r.fallback).toBe("testnet");
      expect(r.message).toContain("0.21");
    }
  });

  it("is enough at exactly the needed amount and not enough one yocto below", () => {
    expect(checkFunds(connected("0.51"), { amount: parseNear("0.5") }).kind).toBe("enough");
    const below: WalletState = { status: "connected", accountId: "a.near", balance: parseNear("0.51") - 1n };
    expect(checkFunds(below, { amount: parseNear("0.5") }).kind).toBe("not-enough");
  });

  it("checks a fee only (amount 0) with a custom reserve", () => {
    expect(checkFunds(connected("0.02"), { amount: 0n, feeReserve: parseNear("0.05") }).kind).toBe(
      "not-enough",
    );
    expect(checkFunds(connected("0.02"), { amount: 0n }).kind).toBe("enough");
  });
});
