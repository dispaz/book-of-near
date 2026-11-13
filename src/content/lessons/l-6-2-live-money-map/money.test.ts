import { describe, expect, it } from "vitest";
import {
  constantProduct,
  describe as describeScene,
  evidenceFor,
  HONEST_TAKE,
  nextSize,
  POOLS,
  priceOf,
  QUOTES,
  reactionFor,
  RECORDED_NOTE,
  SIZES,
  type MapState,
} from "./money";
import { CHECK, DOLLARS, FLOWS, MAP, ORACLE, SWAP } from "./steps";

const base: MapState = { step: MAP, compared: false, oracleRead: false, trade: null, flows: false };

describe("recorded pool quotes", () => {
  it("the constant-product rule on pool #4512's recorded reserves gives the recorded wNEAR quotes, to the yocto", () => {
    for (const size of SIZES) {
      const out = constantProduct(
        BigInt(size) * 10n ** 6n,
        POOLS.simple.reserveIn,
        POOLS.simple.reserveOut,
        POOLS.simple.feeBps,
      );
      expect(out.toString()).toBe(QUOTES[size].simpleRaw);
    }
  });

  it("prices the simple pool per NEAR, and the 100,000 trade at 10.9% over the starting price", () => {
    expect(priceOf(100_000).toFixed(4)).toBe("3.8817");
    expect(priceOf(100).toFixed(4)).toBe("3.5118");
    expect(POOLS.simple.startPrice.toFixed(4)).toBe("3.5009");
    expect(QUOTES[100_000].overStart).toBe("10.9%");
  });

  it("keeps the stable pool about 0.01% from 1:1 for 100,000 USDC (0.01005%)", () => {
    expect(Math.abs(QUOTES[100_000].stableOut / 100_000 - 1)).toBeLessThan(0.000101);
  });

  it("steps through the trade sizes and back to the first", () => {
    expect(nextSize(null)).toBe(100);
    expect(nextSize(100)).toBe(10_000);
    expect(nextSize(10_000)).toBe(100_000);
    expect(nextSize(100_000)).toBe(100);
  });

  it("labels every figure as recorded, never live", () => {
    expect(RECORDED_NOTE).toBe("Recorded on 13 Nov 2026. Not live data.");
  });
});

describe("reactionFor (rule 10a): an action, a hint or a detail, always one", () => {
  it("the mailbox compares on step 2 and shows the supplies after", () => {
    expect(reactionFor("usdc", base).detail).toMatch(/Stablecoins/);
    expect(reactionFor("usdc", { ...base, step: DOLLARS })).toEqual({ act: "compare" });
    expect(reactionFor("usdc", { ...base, step: ORACLE, compared: true }).detail).toMatch(
      /79\.3 million.*14\.6 million/,
    );
  });

  it("the oracle is not yet before step 3, reads on step 3, then shows the old price", () => {
    expect(reactionFor("oracle", base).hint).toBe("Not yet: you read the oracle on step 3.");
    expect(reactionFor("oracle", { ...base, step: ORACLE })).toEqual({ act: "read" });
    expect(reactionFor("oracle", { ...base, step: SWAP, oracleRead: true }).detail).toMatch(
      /\$1\.8843.*25 Aug 2026/,
    );
  });

  it("the pools wait for the oracle, then trade on step 4, then show the last trade", () => {
    expect(reactionFor("stable", { ...base, step: ORACLE }).hint).toBe("Read the oracle first.");
    expect(reactionFor("simple", { ...base, step: DOLLARS, oracleRead: true }).hint).toBe(
      "Not yet: you trade on step 4.",
    );
    expect(reactionFor("simple", { ...base, step: SWAP, oracleRead: true })).toEqual({ act: "trade" });
    const after: MapState = { ...base, step: FLOWS, oracleRead: true, trade: 100_000 };
    expect(reactionFor("stable", after).detail).toMatch(/100,000 USDC → 100,010\.05 USDt/);
    expect(reactionFor("simple", after).detail).toMatch(/25,762\.09 NEAR at \$3\.8817/);
  });

  it("the intents area waits for a trade, then shows the flows on step 5", () => {
    expect(reactionFor("intents", { ...base, step: ORACLE }).hint).toBe("Trade in the pools first.");
    expect(reactionFor("intents", { ...base, step: SWAP, trade: 100 }).hint).toBe(
      "Not yet: you follow the flows on step 5.",
    );
    expect(reactionFor("intents", { ...base, step: FLOWS, trade: 100 })).toEqual({ act: "flows" });
    expect(reactionFor("intents", { ...base, step: CHECK, trade: 100, flows: true }).detail).toMatch(
      /\$176 million/,
    );
  });

  it("the lending ledger always shows its detail", () => {
    expect(reactionFor("lend", base).detail).toMatch(/Rhea Lend \(was Burrow\)/);
  });
});

describe("the scene text and the completion record", () => {
  it("describes every step before the check for screen readers", () => {
    for (let step = 0; step < CHECK; step++)
      expect(describeScene({ ...base, step }).length).toBeGreaterThan(20);
  });

  it("records the swap as worked out from recorded quotes, never as a live trade", () => {
    expect(evidenceFor()).toEqual({
      pair: "USDC/USDt",
      amountIn: "100000",
      stableOut: "100010.046253",
      simpleOutNear: "25762.090317",
      recordedOn: "2026-11-13",
      kind: "recorded",
    });
  });
});

describe("the honest take", () => {
  it("is built from the recorded figures", () => {
    const text = [...HONEST_TAKE.comparedWith, ...HONEST_TAKE.strengths, ...HONEST_TAKE.weaknesses].join(" ");
    for (const figure of [
      "about $39.4 billion",
      "about $5.0 billion",
      "79.3 million",
      "14.6 million",
      "over five times",
      "about $600,000",
      "$176 million",
      "about $162 million",
      "10.9%",
      "about $160 million of the $162 million",
    ])
      expect(text).toContain(figure);
  });

  it("says the 10.9% is one pool's figure", () => {
    expect(HONEST_TAKE.weaknesses[0]).toMatch(/Rhea's biggest USDC\/NEAR pool/);
    expect(HONEST_TAKE.weaknesses[0]).toMatch(/router can split a big trade/);
  });
});
