/**
 * Daily rate limits for the faucet: N accounts per IP address and M accounts in total per UTC day.
 * Counters live behind a tiny `CounterStore` so tests (and `wrangler dev`) can use memory and
 * production uses Workers KV.
 */

export interface CounterStore {
  get(key: string): Promise<number>;
  /** Store `value`, forgotten after `ttlSeconds`. */
  put(key: string, value: number, ttlSeconds: number): Promise<void>;
}

export function memoryCounters(): CounterStore {
  const m = new Map<string, number>();
  return {
    get: async (k) => m.get(k) ?? 0,
    put: async (k, v) => void m.set(k, v),
  };
}

/** Minimal slice of the KV binding we use. */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Workers KV counters. KV is eventually consistent between Cloudflare locations, so two requests
 * hitting different locations within a minute could both pass the last free slot. One address
 * normally reaches one location, and the in-isolate lock below serialises requests per Worker
 * instance, so the per-IP cap holds in practice; the global cap may overshoot by a few accounts.
 */
export function kvCounters(kv: KvLike): CounterStore {
  return {
    get: async (k) => Number((await kv.get(k)) ?? "0") || 0,
    put: (k, v, ttl) => kv.put(k, String(v), { expirationTtl: Math.max(60, ttl) }),
  };
}

export interface Limits {
  perIpDaily: number;
  globalDaily: number;
}

export type LimitResult = { ok: true } | { ok: false; reason: "ip" | "global" };

let chain: Promise<unknown> = Promise.resolve();
/** Run `fn` after every earlier call in this isolate has finished (check-then-increment safety). */
function serialised<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

/**
 * Take one slot for `ip` today, or refuse. The slot is taken before the account is created,
 * so failed attempts count too: hammering the endpoint can never drain the faucet.
 */
export function takeSlot(store: CounterStore, limits: Limits, ip: string, now: Date): Promise<LimitResult> {
  return serialised(async () => {
    const day = now.toISOString().slice(0, 10);
    const ipKey = `ip:${day}:${ip}`;
    const allKey = `all:${day}`;
    const [mine, all] = await Promise.all([store.get(ipKey), store.get(allKey)]);
    if (mine >= limits.perIpDaily) return { ok: false, reason: "ip" } as const;
    if (all >= limits.globalDaily) return { ok: false, reason: "global" } as const;
    const ttl = 2 * 24 * 3600;
    await Promise.all([store.put(ipKey, mine + 1, ttl), store.put(allKey, all + 1, ttl)]);
    return { ok: true } as const;
  });
}
