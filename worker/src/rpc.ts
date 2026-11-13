/** What `read` returns when a node answered but has nothing: try the next node, and give null if none has it. */
export const MISSING = Symbol("missing");

/**
 * One JSON-RPC call, tried on each node in order until one answers. `read` turns a node's JSON into the
 * value, returns `MISSING` when the node answered "not there", or throws to try the next node. When no
 * node gave a value: the last error is thrown if any node failed, otherwise the answer is null.
 */
export async function rpcFirst<T>(
  urls: readonly string[],
  fetchFn: typeof fetch,
  call: { id: string; method: string; params: unknown },
  read: (json: unknown) => T | typeof MISSING,
): Promise<T | null> {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", ...call }),
      });
      const value = read(await res.json());
      if (value !== MISSING) return value;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return null;
}
