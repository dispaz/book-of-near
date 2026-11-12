import { describe, expect, it } from "vitest";
import { evidenceOf, pickResult, supplyProblem, symbolProblem, tokenIdFor, type PickState } from "./ft";
import { GASLESS, HOOK, MINT, REGISTER, TRAP } from "./steps";

const base: PickState = {
  step: HOOK,
  minted: false,
  refused: false,
  registered: false,
  relayed: 0,
  relayLeft: 3,
  relayCap: 3,
  symbol: "BOOK",
  supply: 1000,
  myBalance: 1000,
  friendBalance: 0,
  depositText: "0.00125",
};

describe("token values", () => {
  it("checks the symbol and supply", () => {
    expect(symbolProblem("BOOK")).toBeNull();
    expect(symbolProblem("book")).not.toBeNull();
    expect(symbolProblem("B")).not.toBeNull();
    expect(supplyProblem("1,000")).toBeNull();
    expect(supplyProblem("12")).not.toBeNull();
    expect(supplyProblem("1.5")).not.toBeNull();
  });

  it("puts the token under a named parent only", () => {
    expect(tokenIdFor("bon-abc.testnet")).toBe("token.bon-abc.testnet");
    expect(tokenIdFor("a".repeat(64))).toBeNull();
  });
});

describe("picks (rule 10a)", () => {
  it("runs each step's action from its object", () => {
    expect(pickResult({ ...base, step: MINT }, "stamp")).toEqual({ act: "mint" });
    expect(pickResult({ ...base, step: TRAP, minted: true }, "padlock")).toEqual({ act: "send" });
    expect(pickResult({ ...base, step: REGISTER, minted: true, refused: true }, "friend")).toEqual({
      act: "register",
    });
    expect(
      pickResult({ ...base, step: GASLESS, minted: true, refused: true, registered: true }, "parcel"),
    ).toEqual({ act: "gasless" });
  });

  it("says not yet with a hint when an earlier step is missing", () => {
    expect(pickResult({ ...base, step: TRAP }, "padlock")).toEqual({
      notYet: "Mint your tokens first (step 2).",
    });
    expect(pickResult({ ...base, step: GASLESS, minted: true }, "parcel")).toMatchObject({
      notYet: expect.stringContaining("Register"),
    });
    expect(pickResult(base, "friend")).toMatchObject({ notYet: expect.any(String) });
  });

  it("shows a detail after the step is done", () => {
    const done = {
      ...base,
      step: GASLESS,
      minted: true,
      refused: true,
      registered: true,
      relayed: 1,
      myBalance: 950,
      friendBalance: 50,
    };
    expect(pickResult(done, "me")).toMatchObject({ detail: expect.stringContaining("950 BOOK") });
    expect(pickResult(done, "parcel")).toMatchObject({ detail: expect.stringContaining("NEP-366") });
    expect(pickResult(done, "padlock")).toMatchObject({ detail: expect.stringContaining("0.00125") });
    expect(pickResult(done, "stamp")).toMatchObject({ detail: expect.stringContaining("NEP-141") });
    expect(pickResult({ ...done, relayLeft: 2 }, "relayer")).toEqual({
      detail: "The relayer paid the gas for 1 transfer. It pays for up to 3 per visit: 2 left.",
    });
  });

  it("the relayer says not yet until a signed parcel reaches it", () => {
    expect(pickResult({ ...base, step: GASLESS, minted: true }, "relayer")).toMatchObject({
      notYet: expect.stringContaining("Register"),
    });
    expect(
      pickResult({ ...base, step: GASLESS, minted: true, refused: true, registered: true }, "relayer"),
    ).toEqual({ notYet: "The relayer only carries signed transfers. Sign the parcel first." });
  });
});

describe("evidence", () => {
  it("marks where the token ran: demo evidence is never recorded as testnet", () => {
    const ev = evidenceOf({
      mode: "demo",
      minted: true,
      tokenId: "token.x.testnet",
      symbol: "BOOK",
      supply: 1000,
      relayTx: null,
    });
    expect(ev?.mode).toBe("demo");
  });

  it("records the token and the relayed transaction, never keys", () => {
    expect(
      evidenceOf({ mode: "demo", minted: false, tokenId: null, symbol: "BOOK", supply: 1000, relayTx: null }),
    ).toBeNull();
    expect(
      evidenceOf({
        mode: "demo",
        minted: true,
        tokenId: "token.x.testnet",
        symbol: "BOOK",
        supply: 1000,
        relayTx: "H",
      }),
    ).toEqual({
      mode: "demo",
      tokenContract: "token.x.testnet",
      tokenSymbol: "BOOK",
      totalSupply: "1000",
      relayerPaidGas: "true",
      txHash: "H",
    });
  });
});
