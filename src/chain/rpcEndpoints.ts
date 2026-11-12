/**
 * The testnet RPC endpoints a lesson can ask one by one (`Chain.probeRpc`, lesson 3.3). Pure data, no
 * network code. All were up with CORS `*` on 1 Nov 2026 (issue #4, docs/spikes-seed.md) and again on
 * 12 Nov 2026. DRPC has no working testnet endpoint (`testnet.drpc.org` answered 404), so the third
 * regular endpoint is FastNEAR's second address.
 */

export type RpcEndpointId = "fastnear" | "near-org" | "fastnear-2" | "archival";

export interface RpcEndpoint {
  id: RpcEndpointId;
  /** Who runs it, for the learner. */
  name: string;
  url: string;
  /** An archival node keeps every block since genesis; a regular one only the recent ones. */
  archival: boolean;
}

export const RPC_ENDPOINTS: readonly RpcEndpoint[] = [
  { id: "fastnear", name: "FastNEAR", url: "https://rpc.testnet.fastnear.com", archival: false },
  { id: "near-org", name: "NEAR Foundation", url: "https://rpc.testnet.near.org", archival: false },
  { id: "fastnear-2", name: "FastNEAR (2nd address)", url: "https://test.rpc.fastnear.com", archival: false },
  { id: "archival", name: "Archival node", url: "https://archival-rpc.testnet.fastnear.com", archival: true },
];

export function rpcEndpoint(id: RpcEndpointId): RpcEndpoint {
  const e = RPC_ENDPOINTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown RPC endpoint ${id}`);
  return e;
}

/**
 * Round trips recorded once for a `block` request at final finality, 12 Nov 2026, from one computer
 * (median of five, connection already open). DemoChain answers after these. They are one sample,
 * not a promise: real numbers depend on where you are and how busy each provider is.
 */
export const RECORDED_LATENCY_MS: Record<RpcEndpointId, number> = {
  fastnear: 77,
  "near-org": 3079,
  "fastnear-2": 81,
  archival: 98,
};

/**
 * A block a regular testnet node no longer keeps but the archival node does (checked 12 Nov 2026:
 * `rpc.testnet.fastnear.com` answered UNKNOWN_BLOCK, `archival-rpc.testnet.fastnear.com` the block).
 */
export const HISTORICAL_BLOCK = { height: 100_000_000, timestampMs: 1_662_964_982_304 } as const;

/** Regular nodes keep about 5 epochs of history (docs.near.org, RPC providers). */
export const KEPT_EPOCHS = 5;
/** Blocks per epoch on testnet (EXPERIMENTAL_genesis_config `epoch_length`, 12 Nov 2026). */
export const EPOCH_BLOCKS = 43_200;
