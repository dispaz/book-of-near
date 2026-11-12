import { describe, expect, it, vi } from "vitest";
import {
  capCheck,
  dryQuoteBody,
  formatUnits,
  parseQuote,
  realQuoteBody,
  RECORDED_QUOTE,
  REAL_SWAP_AMOUNT,
  REAL_SWAP_CAP,
  requestQuote,
  runTinySwap,
  STORAGE_DEPOSIT,
  swapOffer,
  tinySwapRequest,
  USDC_ARB_ASSET,
  WNEAR_ASSET,
  type IntentQuote,
} from "./intents";
import { parseNear } from "./units";
import type { WalletState } from "./mainnet/types";

const NOW = new Date("2026-11-12T10:00:00.000Z");

/** A live dry quote in the shape spike 6 recorded (1 wNEAR → 4.054999 USDC, 27 s). */
const LIVE = {
  quote: {
    amountIn: "1000000000000000000000000",
    amountInFormatted: "1.0",
    amountInUsd: "4.0700",
    minAmountIn: "1000000000000000000000000",
    amountOut: "4054999",
    amountOutFormatted: "4.054999",
    amountOutUsd: "4.0532",
    minAmountOut: "4014449",
    timeEstimate: 27,
    refundFee: "0",
    withdrawFee: "0",
  },
  quoteRequest: { deadline: "2026-11-12T10:10:00.000Z", appFees: [{ recipient: "abc", fee: 20 }] },
  signature: "ed25519:5abc",
  timestamp: "2026-11-12T10:00:01.000Z",
  correlationId: "c-1",
};

const connected = (near: string): WalletState => ({
  status: "connected",
  accountId: "learner.near",
  balance: parseNear(near),
});

describe("dry quote request", () => {
  it("asks for 5 NEAR to USDC on Arbitrum, dry, with every field 1Click requires", () => {
    const b = dryQuoteBody(NOW);
    expect(b).toMatchObject({
      dry: true,
      swapType: "EXACT_INPUT",
      originAsset: WNEAR_ASSET,
      destinationAsset: USDC_ARB_ASSET,
      amount: "5000000000000000000000000",
      depositType: "ORIGIN_CHAIN",
      recipientType: "DESTINATION_CHAIN",
      refundType: "ORIGIN_CHAIN",
      slippageTolerance: 100,
    });
    expect(b.deadline).toBe("2026-11-12T10:10:00.000Z");
  });

  it("the real swap's quote is not dry and keeps the USDC for the learner's own account", () => {
    const b = realQuoteBody("learner.near", NOW);
    expect(b).toMatchObject({
      dry: false,
      recipient: "learner.near",
      recipientType: "INTENTS",
      refundTo: "learner.near",
      amount: REAL_SWAP_AMOUNT.toString(),
    });
  });
});

describe("parseQuote", () => {
  it("reads a live quote", () => {
    const q = parseQuote(LIVE, "worker");
    expect(q).toMatchObject({
      amountOut: "4054999",
      amountOutFormatted: "4.054999",
      minAmountOut: "4014449",
      minAmountOutFormatted: "4.0144",
      amountInUsd: 4.07,
      timeEstimate: 27,
      deadline: "2026-11-12T10:10:00.000Z",
      appFee: 20,
      depositAddress: null,
      source: "worker",
    });
  });

  it("refuses an error body or a quote without a signature, in plain English", () => {
    expect(() => parseQuote({ message: "Failed to receive response" }, "direct")).toThrow(
      "1Click did not give a quote: Failed to receive response",
    );
    expect(() => parseQuote({ ...LIVE, signature: "" }, "direct")).toThrow("not signed");
    expect(() => parseQuote({ ...LIVE, quote: { ...LIVE.quote, amountOut: "x" } }, "direct")).toThrow(
      "missing its amounts",
    );
  });

  it("the recorded demo quote is the script's numbers: 5 NEAR to 20.27 USDC in 27 s", () => {
    expect(RECORDED_QUOTE).toMatchObject({
      amountInFormatted: "5",
      amountOutFormatted: "20.27",
      minAmountOutFormatted: "20.0673",
      timeEstimate: 27,
      source: "recorded",
    });
  });

  it("formats base units", () => {
    expect(formatUnits("20270000", 6)).toBe("20.27");
    expect(formatUnits("5", 6)).toBe("0");
    expect(formatUnits("1500000", 6)).toBe("1.5");
  });
});

describe("requestQuote", () => {
  const ok = (body: unknown, status = 201) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("goes through the Worker when one is set", async () => {
    const f = vi.fn(async () => ok(LIVE));
    const q = await requestQuote(dryQuoteBody(NOW), { workerUrl: "https://w.example/", fetch: f });
    expect(f).toHaveBeenCalledWith(
      "https://w.example/intents/quote",
      expect.objectContaining({ method: "POST" }),
    );
    expect(q.source).toBe("worker");
  });

  it("asks 1Click directly, without a key, when there is no Worker", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      return ok(LIVE);
    });
    const q = await requestQuote(dryQuoteBody(NOW), { fetch: f });
    expect(f.mock.calls[0]![0]).toBe("https://1click.chaindefuser.com/v0/quote");
    expect(q.source).toBe("direct");
  });

  it("rejects in plain English on an error status or no network", async () => {
    await expect(
      requestQuote(dryQuoteBody(NOW), { fetch: async () => ok({ message: "timeout" }, 500) }),
    ).rejects.toThrow("The quote request failed (500): timeout");
    await expect(
      requestQuote(dryQuoteBody(NOW), {
        fetch: async () => {
          throw new TypeError("Failed to fetch");
        },
      }),
    ).rejects.toThrow("1Click could not be reached.");
  });
});

describe("the tiny real swap", () => {
  it("is offered only when the funds check passes", () => {
    expect(swapOffer({ status: "disconnected" }).kind).toBe("no-wallet");
    expect(swapOffer(connected("0.05")).kind).toBe("not-enough");
    expect(swapOffer(connected("1")).kind).toBe("enough");
  });

  it("is refused above the cap, in NEAR or in dollars", () => {
    expect(capCheck(REAL_SWAP_AMOUNT, 0.4)).toEqual({ ok: true });
    expect(capCheck(REAL_SWAP_CAP + 1n, null).ok).toBe(false);
    expect(capCheck(REAL_SWAP_AMOUNT, 1.01)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/\$1/),
    });
    expect(capCheck(0n, null).ok).toBe(false);
  });

  it("is one transaction to wrap.near: wrap, register the deposit address, send", () => {
    const r = tinySwapRequest("abc123");
    expect(r.receiverId).toBe("wrap.near");
    expect(r.actions.map((a) => (a.type === "FunctionCall" ? a.methodName : a.type))).toEqual([
      "near_deposit",
      "storage_deposit",
      "ft_transfer",
    ]);
    const total = r.actions.reduce((s, a) => s + a.deposit, 0n);
    expect(total).toBe(REAL_SWAP_AMOUNT + STORAGE_DEPOSIT + 1n);
  });

  const liveReal: IntentQuote = {
    ...RECORDED_QUOTE,
    amountIn: REAL_SWAP_AMOUNT.toString(),
    amountInUsd: 0.4,
    depositAddress: "dep.near",
    source: "worker",
  };

  it("signs only after every check passes", async () => {
    const sign = vi.fn(async () => ({ ok: true as const, txHash: "TX" }));
    const out = await runTinySwap({ wallet: connected("2"), quote: async () => liveReal, sign });
    expect(out).toMatchObject({ kind: "done", txHash: "TX" });
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it("never asks for a quote or a signature without funds, or above the cap", async () => {
    const quote = vi.fn(async () => liveReal);
    const sign = vi.fn(async () => ({ ok: true as const, txHash: "TX" }));
    expect((await runTinySwap({ wallet: connected("0.01"), quote, sign })).kind).toBe("not-offered");
    expect((await runTinySwap({ wallet: connected("5"), amount: parseNear("1"), quote, sign })).kind).toBe(
      "refused",
    );
    expect(quote).not.toHaveBeenCalled();
    // The live quote says it is worth more than $1: refused before signing.
    const pricey = vi.fn(async () => ({ ...liveReal, amountInUsd: 2.5 }));
    expect((await runTinySwap({ wallet: connected("5"), quote: pricey, sign })).kind).toBe("refused");
    expect(sign).not.toHaveBeenCalled();
  });

  it("reports a decline and a failure without throwing", async () => {
    const declined = await runTinySwap({
      wallet: connected("2"),
      quote: async () => liveReal,
      sign: async () => ({ ok: false, reason: "declined" }),
    });
    expect(declined).toEqual({ kind: "declined" });
    const failed = await runTinySwap({
      wallet: connected("2"),
      quote: async () => {
        throw new Error("1Click could not be reached.");
      },
      sign: async () => ({ ok: true, txHash: "x" }),
    });
    expect(failed).toEqual({ kind: "failed", message: "1Click could not be reached." });
  });
});
