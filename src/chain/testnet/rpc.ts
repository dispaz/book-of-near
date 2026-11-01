/**
 * A small JSON-RPC client for NEAR with a fallback list (CLAUDE.md "Verified facts").
 * It moves to the next URL when a node cannot be reached, answers 5xx/429, or gives a non-JSON body.
 * An error *from NEAR* (unknown account, invalid transaction) is final and is not retried.
 */

/** Testnet RPC endpoints in order of preference (verified by issue #4, all CORS `*`). */
export const TESTNET_RPC_URLS = [
  "https://rpc.testnet.fastnear.com",
  "https://test.rpc.fastnear.com",
  "https://rpc.testnet.near.org",
];
/** Archival nodes keep old blocks and transactions that regular nodes have dropped. */
export const TESTNET_ARCHIVAL_RPC_URLS = ["https://archival-rpc.testnet.fastnear.com"];

/** An error returned by a NEAR node. `name` is the error's cause name, e.g. UNKNOWN_ACCOUNT. */
export class RpcError extends Error {
  constructor(
    readonly name: string,
    message: string,
    /** The raw `error` object from the node. */
    readonly raw: unknown,
  ) {
    super(message);
  }
}

/** The node could not be reached at all (all URLs failed). */
export class RpcUnreachable extends Error {}

interface RpcErrorBody {
  name?: string;
  cause?: { name?: string; info?: unknown };
  message?: string;
  data?: unknown;
  code?: number;
}

export interface RpcOptions {
  urls?: string[];
  fetch?: typeof fetch;
  /** Per-request timeout. send_tx can wait for a block, so keep this above a few seconds. */
  timeoutMs?: number;
}

export class Rpc {
  private readonly urls: string[];
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;
  private preferred = 0;
  private id = 0;

  constructor(opts: RpcOptions = {}) {
    this.urls = opts.urls ?? TESTNET_RPC_URLS;
    this.doFetch = opts.fetch ?? ((...a) => globalThis.fetch(...a));
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /** The URL that answered last; tried first next time. */
  get url(): string {
    return this.urls[this.preferred]!;
  }

  async call<T>(method: string, params: unknown): Promise<T> {
    let lastProblem = "no RPC URL configured";
    for (let n = 0; n < this.urls.length; n++) {
      const i = (this.preferred + n) % this.urls.length;
      const url = this.urls[i]!;
      let body: { result?: T; error?: RpcErrorBody };
      try {
        const res = await this.doFetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.status >= 500 || res.status === 429) {
          // A NEAR error can come with a 5xx status but a JSON-RPC body; prefer the body when present.
          const text = await res.text();
          const parsed = safeJson(text) as typeof body | null;
          if (!parsed?.error) {
            lastProblem = `${url} answered ${res.status}`;
            continue;
          }
          body = parsed;
        } else {
          const parsed = safeJson(await res.text()) as typeof body | null;
          if (!parsed) {
            lastProblem = `${url} answered ${res.status} without JSON`;
            continue;
          }
          body = parsed;
        }
      } catch (e) {
        lastProblem = `${url}: ${(e as Error).message}`;
        continue;
      }
      this.preferred = i;
      if (body.error) throw toRpcError(body.error);
      return body.result as T;
    }
    throw new RpcUnreachable(`Could not reach NEAR testnet (${lastProblem}).`);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toRpcError(e: RpcErrorBody): RpcError {
  const name = e.cause?.name ?? e.name ?? "UNKNOWN";
  const data = typeof e.data === "string" ? e.data : e.message;
  return new RpcError(name, data ?? name, e);
}
