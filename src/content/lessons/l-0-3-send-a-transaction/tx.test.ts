import { describe, expect, it } from "vitest";
import { ChainError } from "../../../chain/errors";
import { parseNear } from "../../../chain/units";
import {
  duration,
  explorerUrl,
  kindError,
  near,
  readAmount,
  receiverFor,
  senderBalance,
  short,
  TRANSFER_FEE,
  TRANSFER_HELD,
} from "./tx";

describe("readAmount", () => {
  it("accepts 0.001 to 0.1 NEAR", () => {
    expect(readAmount("0.01")).toEqual({ ok: true, amount: parseNear("0.01") });
    expect(readAmount(" 0.001 ")).toEqual({ ok: true, amount: parseNear("0.001") });
    expect(readAmount("0.1")).toEqual({ ok: true, amount: parseNear("0.1") });
    expect(readAmount(".05")).toEqual({ ok: true, amount: parseNear("0.05") });
  });
  it("explains what is wrong", () => {
    expect(readAmount("0.2")).toEqual({ ok: false, problem: "Pick an amount from 0.001 to 0.1 NEAR." });
    expect(readAmount("0.0001")).toMatchObject({ ok: false });
    expect(readAmount("")).toMatchObject({ ok: false, problem: expect.stringMatching(/Type a number/) });
    expect(readAmount("abc")).toMatchObject({ ok: false });
    expect(readAmount("-0.01")).toMatchObject({ ok: false });
    expect(readAmount("1.")).toMatchObject({ ok: false });
  });
});

describe("fee numbers from the script", () => {
  it("held gas is ten times the fee, and the refund is the difference", () => {
    expect(TRANSFER_HELD).toBe(TRANSFER_FEE * 10n);
    expect(near(TRANSFER_HELD - TRANSFER_FEE)).toBe("0.000405 NEAR");
  });
});

describe("senderBalance", () => {
  const start = parseNear("5");
  const amount = parseNear("0.01");
  it("dips by amount plus held gas when included, then shows the real final balance", () => {
    expect(senderBalance(start, amount, "before")).toBe(start);
    expect(near(senderBalance(start, amount, "included"))).toBe("4.98955 NEAR");
    expect(near(senderBalance(start, amount, "final", parseNear("4.989955")))).toBe("4.989955 NEAR");
  });
});

describe("display helpers", () => {
  it("shortens long ids and formats durations", () => {
    expect(short("4VxZmyXwXcPA6SH6cYVNKvSFxpRGTetfNY7Y1iBQTMUx")).toBe("4VxZmy…TMUx");
    expect(short("alice.testnet", 6, 4)).toBe("alice.testnet");
    expect(duration(250)).toBe("250 ms");
    expect(duration(3250)).toBe("3.25 s");
  });
  it("links to NearBlocks on testnet", () => {
    expect(explorerUrl("abc")).toBe("https://testnet.nearblocks.io/txns/abc");
  });
  it("sends to the return account, never to a stranger", () => {
    expect(receiverFor("demo", "me", "book-of-near.testnet")).toBe("book-of-near.testnet");
    expect(receiverFor("testnet", "me", "book-of-near.testnet", "faucet.testnet")).toBe("faucet.testnet");
    expect(receiverFor("testnet", "me", "book-of-near.testnet", "")).toBe("me");
    expect(receiverFor("testnet", "me", "book-of-near.testnet")).toBe("me");
  });
});

describe("kindError", () => {
  it("explains a refused transfer for lack of balance", () => {
    const e = new ChainError("InvalidTransaction", "x does not have enough NEAR", "NotEnoughBalance");
    expect(kindError(e, "testnet")).toMatchObject({
      title: "Not enough NEAR in the practice account",
      detail: expect.stringMatching(/Nothing was charged.*demo mode/),
    });
    expect(kindError(e, "demo").detail).not.toMatch(/demo mode/);
  });
  it("explains an RPC failure", () => {
    const e = new ChainError("Network", "Could not reach NEAR testnet (all nodes failed).");
    expect(kindError(e, "testnet")).toMatchObject({
      title: "The RPC node did not answer",
      detail: expect.stringMatching(/Why: Could not reach NEAR testnet/),
    });
  });
  it("explains a faucet failure and anything else without a stack trace", () => {
    expect(kindError(new Error("No faucet could fund a practice account (429)."), "testnet").title).toBe(
      "No faucet could fund a practice account",
    );
    expect(kindError("weird", "demo")).toEqual({
      title: "Something went wrong",
      detail: "Please try again.",
    });
  });
});
