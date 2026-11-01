/**
 * Book of NEAR Worker. Routes:
 *   POST /faucet   fund a testnet practice account (faucet.ts)
 *   GET  /health   { ok, faucet }
 * Secrets (never in the repo): FAUCET_ACCOUNT_ID, FAUCET_PRIVATE_KEY. See README.md.
 */
import { faucet, type FaucetSender } from "./faucet";
import { kvCounters, memoryCounters, type CounterStore, type KvLike } from "./limits";
import { nearSender } from "./near";

export interface Env {
  FAUCET_ACCOUNT_ID?: string;
  FAUCET_PRIVATE_KEY?: string;
  FAUCET_LIMITS?: KvLike;
  ALLOWED_ORIGINS?: string;
  FAUCET_AMOUNT?: string;
  PER_IP_DAILY?: string;
  GLOBAL_DAILY?: string;
}

export interface Overrides {
  sender?: FaucetSender | null;
  counters?: CounterStore;
  now?: () => Date;
}

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function allowedOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null;
  if (LOCALHOST.test(origin)) return origin;
  const list = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin) ? origin : null;
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
    const counters =
      o.counters ??
      (env.FAUCET_LIMITS ? kvCounters(env.FAUCET_LIMITS) : (fallbackCounters ??= memoryCounters()));
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const reply = await faucet(body, ip, {
      sender,
      counters,
      limits: { perIpDaily: Number(env.PER_IP_DAILY ?? 3), globalDaily: Number(env.GLOBAL_DAILY ?? 50) },
      amount: env.FAUCET_AMOUNT ?? "0.5",
      now: o.now,
    });
    return json(reply.status, reply.body, origin);
  }
  return json(404, { error: "Not found." }, origin);
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
