/**
 * NEAR Intents through the 1Click API (lesson 4.2). 1Click has no testnet (spike 6), so:
 * - demo mode uses RECORDED_QUOTE and never touches the network;
 * - testnet mode asks for a live DRY quote (no deposit, no key needed): through our Worker
 *   (`$VITE_WORKER_URL/intents/quote`, which adds the API key when one is set) or, with no Worker
 *   configured, straight from 1Click without a key;
 * - the optional tiny real swap (mainnet, capped) gets a non-dry quote the same way and is signed
 *   only through the mainnet wallet seam (`signWithConfirmation`).
 * Lessons never call 1Click themselves: they use the functions here. Pure except `requestQuote`,
 * which takes `fetch` as a parameter.
 */
import { checkFunds } from "./mainnet/funds";
import type { FundsResult, SigningRequest, WalletState } from "./mainnet/types";
import { formatNear, parseNear } from "./units";

export const ONECLICK_URL = "https://1click.chaindefuser.com";
/** NEAR as 1Click lists it: wrapped NEAR on NEAR (`/v0/tokens`, 24 decimals). */
export const WNEAR_ASSET = "nep141:wrap.near";
/** Native USDC on Arbitrum, bridged into NEAR Intents (`/v0/tokens`, 6 decimals). */
export const USDC_ARB_ASSET = "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near";
export const USDC_DECIMALS = 6;
/** The settlement contract on NEAR mainnet (the verifier). */
export const VERIFIER_CONTRACT = "intents.near";
/** The lesson's dry-run amount (docs/lessons/stage-4/4.2.md, section 5). */
export const DRY_AMOUNT = parseNear("5");
/** 1% slippage tolerance, in basis points. */
export const SLIPPAGE_BPS = 100;
/** A dry quote needs some recipient on Arbitrum; nothing is sent. 1Click refuses the 0x…dEaD burn address (12 Nov 2026), so a placeholder is used. */
export const DRY_RECIPIENT = "0x1111111111111111111111111111111111111111";

// ---------- the optional tiny real swap ----------

/** What the tiny real swap sends. */
export const REAL_SWAP_AMOUNT = parseNear("0.1");
/** Hard cap in NEAR: never more than this, whatever the price. The Worker refuses above it too. */
export const REAL_SWAP_CAP = parseNear("0.25");
/** Cap in US dollars (the script: "capped at $1"), checked on the live quote's `amountInUsd`. */
export const REAL_SWAP_CAP_USD = 1;
/** wrap.near keeps this much NEAR to register the deposit address for wNEAR (NEP-145 storage). */
export const STORAGE_DEPOSIT = parseNear("0.00125");

export type QuoteSource = "recorded" | "worker" | "direct";

export interface IntentQuote {
  /** Base units of the origin asset (yoctoNEAR). */
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: number | null;
  /** Base units of the destination asset (USDC: 6 decimals). */
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: number | null;
  /** The guaranteed minimum, after slippage. */
  minAmountOut: string;
  minAmountOutFormatted: string;
  /** Seconds the swap should take. */
  timeEstimate: number;
  /** ISO time the quote stops being valid. */
  deadline: string;
  /** 1Click's signature over the quote. */
  signature: string;
  /** The app fee 1Click added without a key (`appFees[0].fee`), or null. Unit unconfirmed (spike 6). */
  appFee: number | null;
  /** Only on a non-dry quote: where to send the NEAR. */
  depositAddress: string | null;
  correlationId: string;
  source: QuoteSource;
}

/** The fields 1Click needs for a quote (spike 6). Built here so every caller sends the same shape. */
export interface QuoteBody {
  dry: boolean;
  swapType: "EXACT_INPUT";
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN";
  destinationAsset: string;
  amount: string;
  refundTo: string;
  refundType: "ORIGIN_CHAIN";
  recipient: string;
  recipientType: "DESTINATION_CHAIN" | "INTENTS";
  deadline: string;
}

/** The lesson's dry quote: 5 NEAR for USDC on Arbitrum. Nothing is deposited. */
export function dryQuoteBody(now: Date, amount = DRY_AMOUNT): QuoteBody {
  return {
    dry: true,
    swapType: "EXACT_INPUT",
    slippageTolerance: SLIPPAGE_BPS,
    originAsset: WNEAR_ASSET,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: USDC_ARB_ASSET,
    amount: amount.toString(),
    refundTo: "intents.near",
    refundType: "ORIGIN_CHAIN",
    recipient: DRY_RECIPIENT,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(now.getTime() + 10 * 60_000).toISOString(),
  };
}

/**
 * The tiny real swap's quote: NEAR for USDC on Arbitrum, kept for the learner inside NEAR Intents
 * (`recipientType: "INTENTS"`, under their own NEAR account), so no Arbitrum address is needed. A refund
 * goes back to their NEAR account.
 */
export function realQuoteBody(accountId: string, now: Date, amount = REAL_SWAP_AMOUNT): QuoteBody {
  return {
    ...dryQuoteBody(now, amount),
    dry: false,
    refundTo: accountId,
    recipient: accountId,
    recipientType: "INTENTS",
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Formats base units with `decimals`, trimmed: ("20270000", 6) → "20.27". */
export function formatUnits(base: string, decimals: number, maxDecimals = 4): string {
  if (!/^\d+$/.test(base)) return base;
  const padded = base.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded
    .slice(padded.length - decimals, padded.length - decimals + maxDecimals)
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Reads a 1Click quote response. Throws an Error with a plain-English message when it is not a quote
 * (an error body, a missing amount or signature), so the lesson never shows half a quote.
 */
export function parseQuote(json: unknown, source: QuoteSource): IntentQuote {
  const body = (json ?? {}) as Record<string, unknown>;
  const q = body.quote as Record<string, unknown> | undefined;
  if (!q || typeof q !== "object") {
    const msg =
      typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "";
    throw new Error(msg ? `1Click did not give a quote: ${msg}` : "1Click did not give a quote.");
  }
  const amountIn = str(q.amountIn);
  const amountOut = str(q.amountOut);
  const minAmountOut = str(q.minAmountOut);
  const signature = str(body.signature);
  if (!/^\d+$/.test(amountIn) || !/^\d+$/.test(amountOut) || !/^\d+$/.test(minAmountOut))
    throw new Error("1Click's quote is missing its amounts.");
  if (!signature) throw new Error("1Click's quote is not signed.");
  const req = (body.quoteRequest ?? {}) as Record<string, unknown>;
  const fees = Array.isArray(req.appFees) ? (req.appFees as Record<string, unknown>[]) : [];
  return {
    amountIn,
    amountInFormatted: str(q.amountInFormatted) || formatUnits(amountIn, 24),
    amountInUsd: num(q.amountInUsd),
    amountOut,
    amountOutFormatted: str(q.amountOutFormatted) || formatUnits(amountOut, USDC_DECIMALS),
    amountOutUsd: num(q.amountOutUsd),
    minAmountOut,
    minAmountOutFormatted: str(q.minAmountOutFormatted) || formatUnits(minAmountOut, USDC_DECIMALS),
    timeEstimate: num(q.timeEstimate) ?? 0,
    deadline: str(q.deadline) || str(req.deadline),
    signature,
    appFee: fees[0] ? num(fees[0].fee) : null,
    depositAddress: str(q.depositAddress) || null,
    correlationId: str(body.correlationId),
    source,
  };
}

/**
 * Demo mode's quote, in 1Click's response shape. Numbers from the lesson script (section 5: 5 NEAR →
 * 20.27 USDC, 27 s); the shape and the unkeyed app fee from spike 6. Not a live price.
 */
export const RECORDED_RESPONSE = {
  quote: {
    amountIn: "5000000000000000000000000",
    amountInFormatted: "5",
    amountInUsd: "20.35",
    minAmountIn: "5000000000000000000000000",
    amountOut: "20270000",
    amountOutFormatted: "20.27",
    amountOutUsd: "20.26",
    minAmountOut: "20067300",
    timeEstimate: 27,
    deadline: "2026-11-01T12:10:00.000Z",
  },
  quoteRequest: {
    dry: true,
    swapType: "EXACT_INPUT",
    slippageTolerance: SLIPPAGE_BPS,
    originAsset: WNEAR_ASSET,
    destinationAsset: USDC_ARB_ASSET,
    amount: "5000000000000000000000000",
    appFees: [{ recipient: "recorded-demo", fee: 20 }],
  },
  signature: "ed25519:3sQ7bX1nRecordedDemoQuoteNotLive8kP2vY5wM4cT9hJ6dF1aZ",
  timestamp: "2026-11-01T12:00:00.000Z",
  correlationId: "recorded-demo-quote",
} as const;

export const RECORDED_QUOTE: IntentQuote = parseQuote(RECORDED_RESPONSE, "recorded");

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Asks for a quote: through the Worker when `workerUrl` is set (the API key stays there), otherwise
 * straight from 1Click without a key. Rejects with a plain-English Error.
 */
export async function requestQuote(
  body: QuoteBody,
  { workerUrl, fetch: f = fetch, signal }: { workerUrl?: string; fetch?: Fetch; signal?: AbortSignal } = {},
): Promise<IntentQuote> {
  const via: QuoteSource = workerUrl ? "worker" : "direct";
  const url = workerUrl ? `${workerUrl.replace(/\/$/, "")}/intents/quote` : `${ONECLICK_URL}/v0/quote`;
  let res: Response;
  try {
    res = await f(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new Error(
      via === "worker" ? "The app's Worker could not be reached." : "1Click could not be reached.",
    );
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // An empty or non-JSON body: parseQuote says what is missing.
  }
  if (!res.ok && !(json && typeof json === "object" && "quote" in json)) {
    const b = (json ?? {}) as Record<string, unknown>;
    const msg = typeof b.error === "string" ? b.error : typeof b.message === "string" ? b.message : "";
    throw new Error(`The quote request failed (${res.status})${msg ? `: ${msg}` : "."}`);
  }
  return parseQuote(json, via);
}

// ---------- the real swap: offer, cap and the signing request ----------

/** Whether the tiny real swap can be offered: only with a connected wallet that can pay for it. */
export function swapOffer(state: WalletState): FundsResult {
  return checkFunds(state, { amount: REAL_SWAP_AMOUNT + STORAGE_DEPOSIT });
}

export type CapCheck = { ok: true } | { ok: false; message: string };

/**
 * Refuses any real swap above the cap: more than REAL_SWAP_CAP NEAR, or a quote worth more than $1.
 * Leave `amountInUsd` out before there is a quote; a live quote with no dollar value (`null`) is refused,
 * because the $1 cap could not be checked.
 */
export function capCheck(amount: bigint, amountInUsd?: number | null): CapCheck {
  if (amount <= 0n) return { ok: false, message: "The swap amount must be more than 0." };
  if (amount > REAL_SWAP_CAP)
    return {
      ok: false,
      message: `Refused: ${formatNear(amount, 4)} NEAR is above this lesson's cap of ${formatNear(REAL_SWAP_CAP, 2)} NEAR.`,
    };
  if (amountInUsd === null)
    return {
      ok: false,
      message: `Refused: the quote has no dollar value, so the $${REAL_SWAP_CAP_USD} cap cannot be checked. Nothing was sent.`,
    };
  if (amountInUsd !== undefined && amountInUsd > REAL_SWAP_CAP_USD)
    return {
      ok: false,
      message: `Refused: the quote is worth $${amountInUsd.toFixed(2)}, above this lesson's cap of $${REAL_SWAP_CAP_USD}.`,
    };
  return { ok: true };
}

/**
 * The one transaction of the tiny real swap, all on wrap.near: wrap the NEAR, register the deposit
 * address for wNEAR, and send the wNEAR to it. If any action fails, all three roll back (one receipt).
 */
export function tinySwapRequest(depositAddress: string, amount = REAL_SWAP_AMOUNT): SigningRequest {
  return {
    summary: `Swap ${formatNear(amount, 4)} NEAR for USDC, kept in your NEAR Intents account (not sent to Arbitrum). The NEAR goes to the 1Click deposit address ${depositAddress}; the USDC stays in ${VERIFIER_CONTRACT} until you withdraw it.`,
    receiverId: "wrap.near",
    actions: [
      { type: "FunctionCall", methodName: "near_deposit", args: {}, gas: 10n * 10n ** 12n, deposit: amount },
      {
        type: "FunctionCall",
        methodName: "storage_deposit",
        args: { account_id: depositAddress, registration_only: true },
        gas: 10n * 10n ** 12n,
        deposit: STORAGE_DEPOSIT,
      },
      {
        type: "FunctionCall",
        methodName: "ft_transfer",
        args: { receiver_id: depositAddress, amount: amount.toString() },
        gas: 30n * 10n ** 12n,
        deposit: 1n,
      },
    ],
  };
}

export type TinySwapOutcome =
  | { kind: "not-offered"; message: string }
  | { kind: "refused"; message: string }
  | { kind: "declined" }
  | { kind: "failed"; message: string }
  | { kind: "done"; txHash: string; quote: IntentQuote };

type SignResult = { ok: true; txHash: string } | { ok: false; reason: string; message?: string };

/**
 * The tiny real swap, step by step: the funds check, the cap on the amount, a live quote with a deposit
 * address, the cap again on the quote's dollar value, then the signing request (which shows the amount
 * and waits for the learner's "Confirm"). Never signs when any check fails. `quote` and `sign` are
 * passed in: the lesson gives the live 1Click quote and the wallet seam's `sign`.
 */
export async function runTinySwap({
  wallet,
  amount = REAL_SWAP_AMOUNT,
  quote,
  sign,
}: {
  wallet: WalletState;
  amount?: bigint;
  quote: (amount: bigint, accountId: string) => Promise<IntentQuote>;
  sign: (request: SigningRequest) => Promise<SignResult>;
}): Promise<TinySwapOutcome> {
  const funds = checkFunds(wallet, { amount: amount + STORAGE_DEPOSIT });
  if (funds.kind !== "enough" || wallet.status !== "connected")
    return { kind: "not-offered", message: funds.message };
  const before = capCheck(amount);
  if (!before.ok) return { kind: "refused", message: before.message };
  let q: IntentQuote;
  try {
    q = await quote(amount, wallet.accountId);
  } catch (e) {
    return { kind: "failed", message: (e as Error).message || "No quote came back." };
  }
  const after = capCheck(BigInt(q.amountIn), q.amountInUsd);
  if (!after.ok) return { kind: "refused", message: after.message };
  if (!q.depositAddress)
    return { kind: "failed", message: "The quote has no deposit address, so nothing was sent." };
  const out = await sign(tinySwapRequest(q.depositAddress, amount));
  if (out.ok) return { kind: "done", txHash: out.txHash, quote: q };
  if (out.reason === "declined") return { kind: "declined" };
  return { kind: "failed", message: out.message ?? `Nothing was sent (${out.reason}).` };
}
