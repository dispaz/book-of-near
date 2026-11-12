/**
 * Book of NEAR Worker. Routes:
 *   POST /faucet   fund a testnet practice account (faucet.ts)
 *   POST /intents/quote  1Click quote proxy for lesson 4.2 (intents.ts)
 *   POST /claim    sign a stage badge claim after checking its evidence on testnet (claim.ts)
 *   GET  /health   { ok, faucet }
 * Secrets (never in the repo): FAUCET_ACCOUNT_ID, FAUCET_PRIVATE_KEY, CLAIM_SIGNING_KEY, optional ONECLICK_JWT. See README.md.
 */
import { claim, rpcLookup, type TxLookup } from "./claim";
import { faucet, type FaucetSender } from "./faucet";
import { MAX_QUOTE_BODY_BYTES, quote, type Fetch } from "./intents";
import { kvCounters, memoryCounters, takeSlot, type CounterStore, type KvLike } from "./limits";
import { nearSender } from "./near";

export interface Env {
  FAUCET_ACCOUNT_ID?: string;
  FAUCET_PRIVATE_KEY?: string;
  FAUCET_LIMITS?: KvLike;
  ALLOWED_ORIGINS?: string;
  /** "1" lets any http://localhost:<port> origin call the Worker. Set only for local dev (.dev.vars). */
  ALLOW_LOCALHOST?: string;
  FAUCET_AMOUNT?: string;
  PER_IP_DAILY?: string;
  GLOBAL_DAILY?: string;
  /** Optional 1Click API key (a JWT), sent as a bearer token. Without it quotes still work, with an app fee. */
  ONECLICK_JWT?: string;
  /** Quotes per IP address per UTC day (default 20), and in total per UTC day (default 400). */
  QUOTE_PER_IP_DAILY?: string;
  QUOTE_GLOBAL_DAILY?: string;
  /** The badge claim key's secret, `ed25519:<base58>` (Worker secret). Without it /claim answers 503. */
  CLAIM_SIGNING_KEY?: string;
  /** The badge contract the claims are for (wrangler.toml var). */
  BADGE_CONTRACT_ID?: string;
  /** Signed claims per IP address (default 20), per account (default 10) and in total (default 500) per UTC day. */
  CLAIM_PER_IP_DAILY?: string;
  CLAIM_PER_ACCOUNT_DAILY?: string;
  CLAIM_GLOBAL_DAILY?: string;
}

export interface Overrides {
  sender?: FaucetSender | null;
  counters?: CounterStore;
  now?: () => Date;
  /** The fetch used to reach 1Click (tests). */
  fetch?: Fetch;
  /** Testnet transaction lookup for badge claims (tests). */
  lookup?: TxLookup;
}

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function allowedOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null;
  if (env.ALLOW_LOCALHOST === "1" && LOCALHOST.test(origin)) return origin;
  const list = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin) ? origin : null;
}

/** A daily limit from config. A missing or mistyped value falls back to the default, never to "no limit". */
export function limitFrom(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value.trim() !== "" && Number.isInteger(n) && n >= 0 ? n : fallback;
}

function json(status: number, body: unknown, origin: string | null): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

let fallbackCounters: CounterStore | null = null;

export async function handle(request: Request, env: Env, o: Overrides = {}): Promise<Response> {
  const url = new URL(request.url);
  const origin = allowedOrigin(request.headers.get("origin"), env);
  // A browser request from an origin we don't serve gets no CORS headers, so the browser blocks it.
  if (request.headers.get("origin") && !origin) return json(403, { error: "Origin not allowed." }, null);

  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin ?? "",
        "access-control-allow-methods": "POST, GET, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "Origin",
      },
    });

  const configured = !!(env.FAUCET_ACCOUNT_ID && env.FAUCET_PRIVATE_KEY);
  if (url.pathname === "/health") return json(200, { ok: true, faucet: configured }, origin);

  if (url.pathname === "/faucet" && request.method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "Send JSON." }, origin);
    }
    const sender =
      o.sender !== undefined
        ? o.sender
        : configured
          ? nearSender(env.FAUCET_ACCOUNT_ID!, env.FAUCET_PRIVATE_KEY!)
          : null;
    const dev = env.ALLOW_LOCALHOST === "1";
    // In-memory counters reset whenever the isolate restarts, so they are only acceptable in local dev.
    const counters =
      o.counters ??
      (env.FAUCET_LIMITS
        ? kvCounters(env.FAUCET_LIMITS)
        : dev
          ? (fallbackCounters ??= memoryCounters())
          : null);
    if (!counters) return json(503, { error: "The faucet is not set up yet." }, origin);
    // Cloudflare always sets cf-connecting-ip. Without it we can't rate-limit per address, so refuse.
    const ip = request.headers.get("cf-connecting-ip") ?? (dev ? "local" : null);
    if (!ip) return json(400, { error: "Unknown client address." }, origin);
    const reply = await faucet(body, ip, {
      sender,
      counters,
      limits: { perIpDaily: limitFrom(env.PER_IP_DAILY, 3), globalDaily: limitFrom(env.GLOBAL_DAILY, 50) },
      amount: env.FAUCET_AMOUNT ?? "0.5",
      now: o.now,
    });
    return json(reply.status, reply.body, origin);
  }
  if (url.pathname === "/intents/quote" && request.method === "POST") {
    const tooBig = () => json(413, { error: "The quote request is too big." }, origin);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_QUOTE_BODY_BYTES) return tooBig();
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_QUOTE_BODY_BYTES) return tooBig();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { error: "Send JSON." }, origin);
    }
    const dev = env.ALLOW_LOCALHOST === "1";
    const counters =
      o.counters ??
      (env.FAUCET_LIMITS
        ? kvCounters(env.FAUCET_LIMITS)
        : dev
          ? (fallbackCounters ??= memoryCounters())
          : null);
    if (!counters) return json(503, { error: "Quotes are not set up yet." }, origin);
    const ip = request.headers.get("cf-connecting-ip") ?? (dev ? "local" : null);
    if (!ip) return json(400, { error: "Unknown client address." }, origin);
    const now = o.now?.() ?? new Date();
    // A slot is taken before the request is checked or sent, so refused requests count too.
    const slot = await takeSlot(
      counters,
      {
        perIpDaily: limitFrom(env.QUOTE_PER_IP_DAILY, 20),
        globalDaily: limitFrom(env.QUOTE_GLOBAL_DAILY, 400),
      },
      ip,
      now,
      "quote",
    );
    if (!slot.ok)
      return json(
        429,
        {
          error:
            slot.reason === "ip"
              ? "Too many quotes from this address today. Try again tomorrow."
              : "The app has used today's quotes. Try again tomorrow.",
        },
        origin,
      );
    const reply = await quote(body, { apiKey: env.ONECLICK_JWT, fetch: o.fetch, now });
    return json(reply.status, reply.body, origin);
  }
  if (url.pathname === "/claim" && request.method === "POST") {
    if (!env.CLAIM_SIGNING_KEY || !env.BADGE_CONTRACT_ID)
      return json(503, { error: "Badge claims are not set up yet." }, origin);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "Send JSON." }, origin);
    }
    const dev = env.ALLOW_LOCALHOST === "1";
    const counters =
      o.counters ??
      (env.FAUCET_LIMITS
        ? kvCounters(env.FAUCET_LIMITS)
        : dev
          ? (fallbackCounters ??= memoryCounters())
          : null);
    if (!counters) return json(503, { error: "Badge claims are not set up yet." }, origin);
    const ip = request.headers.get("cf-connecting-ip") ?? (dev ? "local" : null);
    if (!ip) return json(400, { error: "Unknown client address." }, origin);
    const now = o.now?.() ?? new Date();
    const global = limitFrom(env.CLAIM_GLOBAL_DAILY, 500);
    // Slots are taken before the evidence is checked, so refused claims count too.
    const byIp = await takeSlot(
      counters,
      { perIpDaily: limitFrom(env.CLAIM_PER_IP_DAILY, 20), globalDaily: global },
      ip,
      now,
      "claim",
    );
    const account = (body as { accountId?: unknown } | null)?.accountId;
    const byAccount = byIp.ok
      ? await takeSlot(
          counters,
          { perIpDaily: limitFrom(env.CLAIM_PER_ACCOUNT_DAILY, 10), globalDaily: Number.MAX_SAFE_INTEGER },
          String(account ?? "?").slice(0, 64),
          now,
          "claim-account",
        )
      : byIp;
    if (!byAccount.ok)
      return json(
        429,
        {
          error:
            byAccount.reason === "global"
              ? "The app has signed today's badge claims. Try again tomorrow."
              : "Too many claims today. Try again tomorrow.",
        },
        origin,
      );
    const reply = await claim(body, {
      contractId: env.BADGE_CONTRACT_ID,
      signingKey: env.CLAIM_SIGNING_KEY,
      lookup: o.lookup ?? rpcLookup(),
      now,
    });
    return json(reply.status, reply.body, origin);
  }
  return json(404, { error: "Not found." }, origin);
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
