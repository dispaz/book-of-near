/**
 * POST /intents/quote: a narrow proxy to the 1Click API (lesson 4.2). The API key, when one is set
 * (`ONECLICK_JWT` secret), stays here and is sent as a bearer token; without it 1Click still answers
 * (spike 6, unkeyed: an app fee is added). Only an EXACT_INPUT swap of NEAR (wNEAR) into USDC on Arbitrum
 * is allowed, with bounded slippage and deadline, and a non-dry quote (a real swap) is refused above the
 * lesson's cap, so the proxy cannot be used to price or open big swaps. Rate limits live in index.ts.
 */
export const ONECLICK_QUOTE_URL = "https://1click.chaindefuser.com/v0/quote";
/** Same values as the app (`src/chain/intents.ts`); a unit test there checks they stay equal. */
export const WNEAR = "nep141:wrap.near";
/** Native USDC on Arbitrum: the only asset this proxy will quote into. */
export const USDC_ARB = "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near";
/** 0.25 NEAR in yoctoNEAR: the most a real (non-dry) quote may ask for. Same cap as the app. */
export const REAL_SWAP_CAP_YOCTO = 250_000_000_000_000_000_000_000n;
/** A quote request is a few hundred bytes; anything bigger is refused before it is parsed. */
export const MAX_QUOTE_BODY_BYTES = 4096;
/** Slippage tolerance in basis points: 0..3%. The app asks for 1%. */
export const MAX_SLIPPAGE_BPS = 300;
/** The quote's deadline must be in the future and at most this far ahead. The app asks for 10 minutes. */
export const MAX_DEADLINE_MS = 30 * 60_000;

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface QuoteReply {
  status: number;
  body: unknown;
}

const ALLOWED = [
  "dry",
  "swapType",
  "slippageTolerance",
  "originAsset",
  "depositType",
  "destinationAsset",
  "amount",
  "refundTo",
  "refundType",
  "recipient",
  "recipientType",
  "deadline",
] as const;

const isAddress = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 128;

/** Why the request is refused, or null when every field is in range. */
function problem(b: Record<string, unknown>, now: Date): string | null {
  if (typeof b.dry !== "boolean") return "Say whether the quote is dry.";
  // EXACT_INPUT only: `amount` is then the NEAR going in, so the cap below really bounds the swap.
  if (b.swapType !== "EXACT_INPUT") return "Only exact input swaps are allowed here.";
  if (b.originAsset !== WNEAR) return "Only NEAR can be swapped here.";
  if (b.destinationAsset !== USDC_ARB) return "Only USDC on Arbitrum can be quoted here.";
  if (typeof b.amount !== "string" || !/^[1-9]\d{0,40}$/.test(b.amount))
    return "The amount must be a whole number of yoctoNEAR.";
  if (!b.dry && BigInt(b.amount) > REAL_SWAP_CAP_YOCTO)
    return "Refused: a real swap here is capped at 0.25 NEAR.";
  const s = b.slippageTolerance;
  if (typeof s !== "number" || !Number.isInteger(s) || s < 0 || s > MAX_SLIPPAGE_BPS)
    return `The slippage tolerance must be 0 to ${MAX_SLIPPAGE_BPS} basis points.`;
  const deadline = typeof b.deadline === "string" ? Date.parse(b.deadline) : NaN;
  const ahead = deadline - now.getTime();
  if (!Number.isFinite(deadline) || ahead <= 0 || ahead > MAX_DEADLINE_MS)
    return "The deadline must be within the next 30 minutes.";
  if (b.depositType !== "ORIGIN_CHAIN" || b.refundType !== "ORIGIN_CHAIN")
    return "Deposits and refunds must use the origin chain.";
  if (b.recipientType !== "DESTINATION_CHAIN" && b.recipientType !== "INTENTS")
    return "Unknown recipient type.";
  if (!isAddress(b.recipient) || !isAddress(b.refundTo)) return "Give a recipient and a refund address.";
  return null;
}

/** Checks the request and forwards only the fields 1Click needs. */
export async function quote(
  input: unknown,
  { apiKey, fetch: f = fetch, now = new Date() }: { apiKey?: string; fetch?: Fetch; now?: Date },
): Promise<QuoteReply> {
  if (!input || typeof input !== "object") return { status: 400, body: { error: "Send a quote request." } };
  const b = input as Record<string, unknown>;
  const why = problem(b, now);
  if (why) return { status: 400, body: { error: why } };
  const body: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in b) body[k] = b[k];
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  let res: Response;
  try {
    res = await f(ONECLICK_QUOTE_URL, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    return { status: 502, body: { error: "1Click could not be reached." } };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { status: 502, body: { error: "1Click gave an answer that is not JSON." } };
  }
  return { status: res.status, body: json };
}
