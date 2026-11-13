/**
 * Book of NEAR Worker. Routes:
 *   POST /faucet   fund a testnet practice account (faucet.ts)
 *   POST /intents/quote  1Click quote proxy for lesson 4.2 (intents.ts)
 *   POST /claim    sign a stage badge claim after checking its evidence on testnet (claim.ts)
 *   POST /exam     grade the final exam after checking the route's badges on testnet (exam.ts)
 *   POST /final    sign the final badge claim for a passed exam's receipt (final.ts)
 *   GET  /health   { ok, faucet }
 * Secrets (never in the repo): FAUCET_ACCOUNT_ID, FAUCET_PRIVATE_KEY, CLAIM_SIGNING_KEY, optional ONECLICK_JWT. See README.md.
 */
import { claim, MAX_CLAIM_BODY_BYTES, rpcLookup, type TxLookup } from "./claim";
import { exam, MAX_EXAM_BODY_BYTES, rpcBadges, type BadgeReader } from "./exam";
import { faucet, type FaucetSender } from "./faucet";
import { final, MAX_FINAL_BODY_BYTES } from "./final";
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
  /** Exam attempts per IP address (default 30), per account (default 10) and in total (default 2000) per UTC day. */
  EXAM_PER_IP_DAILY?: string;
  EXAM_PER_ACCOUNT_DAILY?: string;
  EXAM_GLOBAL_DAILY?: string;
  /** Final badge claims signed per IP address (default 10), per account (default 5) and in total (default 300) per UTC day. */
  FINAL_PER_IP_DAILY?: string;
  FINAL_PER_ACCOUNT_DAILY?: string;
  FINAL_GLOBAL_DAILY?: string;
}

export interface Overrides {
  sender?: FaucetSender | null;
  counters?: CounterStore;
  now?: () => Date;
  /** The fetch used to reach 1Click (tests). */
  fetch?: Fetch;
  /** Testnet transaction lookup for badge claims (tests). */
  lookup?: TxLookup;
  /** Badge contract reads for the exam gate (tests). */
  badges?: BadgeReader;
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

/** What differs between the signed routes (/claim, /exam, /final) before their own check runs. */
interface SignedRoute {
  /** Counter prefix: `<name>` per IP and in total, `<name>-account` per account. */
  name: string;
  maxBytes: number;
  notSetUp: string;
  tooBig: string;
  perIpDaily: number;
  perAccountDaily: number;
  globalDaily: number;
  /** 429 text when the day's total is used up, and when an IP or account is over its limit. */
  globalUsed: string;
  tooMany: string;
}

/**
 * The shared prologue of the signed routes: config, body size cap, JSON, counters, client address and
 * the per-IP, total and per-account daily slots. Slots are taken before the body is checked, so refused
 * requests count too. Returns the parsed body and the time, or the error reply.
 */
async function signedPrologue(
  request: Request,
  env: Env,
  o: Overrides,
  origin: string | null,
  r: SignedRoute,
): Promise<
  | { ok: true; body: unknown; now: Date; contractId: string; signingKey: string }
  | { ok: false; reply: Response }
> {
  const fail = (status: number, error: string) => ({
    ok: false as const,
    reply: json(status, { error }, origin),
  });
  if (!env.CLAIM_SIGNING_KEY || !env.BADGE_CONTRACT_ID) return fail(503, r.notSetUp);
  if (Number(request.headers.get("content-length") ?? 0) > r.maxBytes) return fail(413, r.tooBig);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > r.maxBytes) return fail(413, r.tooBig);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "Send JSON.");
  }
  const dev = env.ALLOW_LOCALHOST === "1";
  const counters =
    o.counters ??
    (env.FAUCET_LIMITS
      ? kvCounters(env.FAUCET_LIMITS)
      : dev
        ? (fallbackCounters ??= memoryCounters())
        : null);
  if (!counters) return fail(503, r.notSetUp);
  const ip = request.headers.get("cf-connecting-ip") ?? (dev ? "local" : null);
  if (!ip) return fail(400, "Unknown client address.");
  const now = o.now?.() ?? new Date();
  const byIp = await takeSlot(
    counters,
    { perIpDaily: r.perIpDaily, globalDaily: r.globalDaily },
    ip,
    now,
    r.name,
  );
  const account = (body as { accountId?: unknown } | null)?.accountId;
  const byAccount = byIp.ok
    ? await takeSlot(
        counters,
        { perIpDaily: r.perAccountDaily, globalDaily: Number.MAX_SAFE_INTEGER },
        String(account ?? "?").slice(0, 64),
        now,
        `${r.name}-account`,
      )
    : byIp;
  if (!byAccount.ok) return fail(429, byAccount.reason === "global" ? r.globalUsed : r.tooMany);
  return { ok: true, body, now, contractId: env.BADGE_CONTRACT_ID, signingKey: env.CLAIM_SIGNING_KEY };
}

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
    const p = await signedPrologue(request, env, o, origin, {
      name: "claim",
      maxBytes: MAX_CLAIM_BODY_BYTES,
      notSetUp: "Badge claims are not set up yet.",
      tooBig: "The claim request is too big.",
      perIpDaily: limitFrom(env.CLAIM_PER_IP_DAILY, 20),
      perAccountDaily: limitFrom(env.CLAIM_PER_ACCOUNT_DAILY, 10),
      globalDaily: limitFrom(env.CLAIM_GLOBAL_DAILY, 500),
      globalUsed: "The app has signed today's badge claims. Try again tomorrow.",
      tooMany: "Too many claims today. Try again tomorrow.",
    });
    if (!p.ok) return p.reply;
    const reply = await claim(p.body, {
      contractId: p.contractId,
      signingKey: p.signingKey,
      lookup: o.lookup ?? rpcLookup(),
      now: p.now,
    });
    return json(reply.status, reply.body, origin);
  }
  if (url.pathname === "/exam" && request.method === "POST") {
    // Every attempt counts, graded or refused, so the Worker's RPC reads and signatures stay bounded.
    const p = await signedPrologue(request, env, o, origin, {
      name: "exam",
      maxBytes: MAX_EXAM_BODY_BYTES,
      notSetUp: "The exam is not set up yet.",
      tooBig: "The exam request is too big.",
      perIpDaily: limitFrom(env.EXAM_PER_IP_DAILY, 30),
      perAccountDaily: limitFrom(env.EXAM_PER_ACCOUNT_DAILY, 10),
      globalDaily: limitFrom(env.EXAM_GLOBAL_DAILY, 2000),
      globalUsed: "The app has graded today's exams. Try again tomorrow.",
      tooMany: "Too many exam attempts today. Try again tomorrow.",
    });
    if (!p.ok) return p.reply;
    const reply = await exam(p.body, {
      contractId: p.contractId,
      signingKey: p.signingKey,
      badges: o.badges ?? rpcBadges(p.contractId),
      now: p.now,
    });
    return json(reply.status, reply.body, origin);
  }
  if (url.pathname === "/final" && request.method === "POST") {
    const p = await signedPrologue(request, env, o, origin, {
      name: "final",
      maxBytes: MAX_FINAL_BODY_BYTES,
      notSetUp: "Final badge claims are not set up yet.",
      tooBig: "The final claim request is too big.",
      perIpDaily: limitFrom(env.FINAL_PER_IP_DAILY, 10),
      perAccountDaily: limitFrom(env.FINAL_PER_ACCOUNT_DAILY, 5),
      globalDaily: limitFrom(env.FINAL_GLOBAL_DAILY, 300),
      globalUsed: "The app has signed today's final badge claims. Try again tomorrow.",
      tooMany: "Too many final badge claims today. Try again tomorrow.",
    });
    if (!p.ok) return p.reply;
    const reply = await final(p.body, { contractId: p.contractId, signingKey: p.signingKey, now: p.now });
    return json(reply.status, reply.body, origin);
  }
  return json(404, { error: "Not found." }, origin);
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
