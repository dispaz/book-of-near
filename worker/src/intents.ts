/**
 * POST /intents/quote: a narrow proxy to the 1Click API (lesson 4.2). The API key, when one is set
 * (`ONECLICK_JWT` secret), stays here and is sent as a bearer token; without it 1Click still answers
 * (spike 6, unkeyed: an app fee is added). Only NEAR (wNEAR) in is allowed, and a non-dry quote (a real
 * swap) is refused above the lesson's cap, so the proxy cannot be used to price or open big swaps.
 */
export const ONECLICK_QUOTE_URL = "https://1click.chaindefuser.com/v0/quote";
const WNEAR = "nep141:wrap.near";
/** 0.25 NEAR in yoctoNEAR: the most a real (non-dry) quote may ask for. Same cap as the app. */
export const REAL_SWAP_CAP_YOCTO = 250_000_000_000_000_000_000_000n;

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

/** Checks the request and forwards only the fields 1Click needs. */
export async function quote(
  input: unknown,
  { apiKey, fetch: f = fetch }: { apiKey?: string; fetch?: Fetch },
): Promise<QuoteReply> {
  if (!input || typeof input !== "object") return { status: 400, body: { error: "Send a quote request." } };
  const b = input as Record<string, unknown>;
  if (typeof b.dry !== "boolean") return { status: 400, body: { error: "Say whether the quote is dry." } };
  if (b.originAsset !== WNEAR) return { status: 400, body: { error: "Only NEAR can be swapped here." } };
  if (typeof b.destinationAsset !== "string" || !/^nep(141|245):/.test(b.destinationAsset))
    return { status: 400, body: { error: "Unknown destination asset." } };
  if (typeof b.amount !== "string" || !/^[1-9]\d{0,40}$/.test(b.amount))
    return { status: 400, body: { error: "The amount must be a whole number of yoctoNEAR." } };
  if (!b.dry && BigInt(b.amount) > REAL_SWAP_CAP_YOCTO)
    return { status: 400, body: { error: "Refused: a real swap here is capped at 0.25 NEAR." } };
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
