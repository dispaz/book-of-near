/**
 * One timed `block` request to one RPC endpoint, with no fallback (lesson 3.3 races them). It never
 * throws for a node's problem: a refused block, a 5xx, a 429, a timeout or no answer all come back as
 * `ok: false`, so the caller can show them and move on to the next endpoint.
 */
import type { RpcEndpointId } from "../rpcEndpoints";
import type { BlockRef, RpcProbe } from "../types";

export interface ProbeDeps {
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  /** The caller's abort: an aborted probe rejects (the caller is gone, nobody reads the answer). */
  signal?: AbortSignal;
}

const blockParams = (ref: BlockRef) =>
  ref === "final" || ref === "optimistic"
    ? { finality: ref }
    : "height" in ref
      ? { block_id: ref.height }
      : { block_id: ref.hash };

/* eslint-disable @typescript-eslint/no-explicit-any -- RPC JSON */
export async function probeEndpoint(
  endpointId: RpcEndpointId,
  url: string,
  ref: BlockRef,
  deps: ProbeDeps = {},
): Promise<RpcProbe> {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => globalThis.fetch(...a));
  const now = deps.now ?? (() => performance.now());
  const start = now();
  const took = () => Math.round(now() - start);
  const down = (message: string, status?: number): RpcProbe => ({
    ok: false,
    endpointId,
    latencyMs: took(),
    error: "Unavailable",
    status,
    message,
  });
  const timeout = AbortSignal.timeout(deps.timeoutMs ?? 8_000);
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "block", params: blockParams(ref) }),
      signal: deps.signal ? AbortSignal.any([timeout, deps.signal]) : timeout,
    });
  } catch {
    deps.signal?.throwIfAborted();
    return down("No answer: the node could not be reached or took too long.");
  }
  const body: any = await res.json().catch(() => null);
  const header = body?.result?.header;
  if (header)
    return {
      ok: true,
      endpointId,
      latencyMs: took(),
      blockHeight: header.height,
      blockTimestampMs: Math.round(Number(header.timestamp_nanosec ?? header.timestamp) / 1e6),
    };
  const cause = body?.error?.cause?.name ?? body?.error?.name;
  if (cause === "UNKNOWN_BLOCK" || cause === "GARBAGE_COLLECTED_BLOCK")
    return {
      ok: false,
      endpointId,
      latencyMs: took(),
      error: "UnknownBlock",
      status: res.status,
      message: "This node does not keep that block.",
    };
  return down(res.ok ? "The node gave no block." : `The node answered ${res.status}.`, res.status);
}
