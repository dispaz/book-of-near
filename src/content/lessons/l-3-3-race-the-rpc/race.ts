/**
 * Lesson 3.3's logic, pure and unit tested: race three RPC providers, fail over past a blocked one and
 * ask a regular and an archival node for an old block. Every request goes through a `probe` function
 * (Chain.probeRpc in the app), so the same code runs in demo mode and on testnet.
 */
import { HISTORICAL_BLOCK, rpcEndpoint, type RpcEndpointId } from "../../../chain/rpcEndpoints";
import type { BlockRef, RpcProbe } from "../../../chain/types";

export type Probe = (endpointId: string, ref?: BlockRef) => Promise<RpcProbe>;

/** The three regular providers, in the order of the app's fallback list (first is tried first). */
export const RACE_IDS = ["fastnear", "near-org", "fastnear-2"] as const satisfies readonly RpcEndpointId[];
/** The provider the learner switches off at step 3: the first in the list. */
export const BLOCKABLE: RpcEndpointId = "fastnear";

export const nameOf = (id: string) => rpcEndpoint(id as RpcEndpointId).name;
export const hostOf = (id: string) => rpcEndpoint(id as RpcEndpointId).url.replace(/^https:\/\//, "");

export interface Race {
  results: RpcProbe[];
  /** The fastest provider that answered with a block. */
  winner: RpcProbe | null;
  slowest: RpcProbe | null;
}

/** Ask every provider at the same moment. `onResult` hears each answer as it lands. */
export async function race(probe: Probe, onResult?: (p: RpcProbe) => void): Promise<Race> {
  const results = await Promise.all(
    RACE_IDS.map(async (id) => {
      const p = await probe(id, "final");
      onResult?.(p);
      return p;
    }),
  );
  const ok = results.filter((p) => p.ok).sort((a, b) => a.latencyMs - b.latencyMs);
  return { results, winner: ok[0] ?? null, slowest: ok[ok.length - 1] ?? null };
}

export interface Attempt {
  endpointId: string;
  ok: boolean;
  latencyMs: number;
  status?: number;
  /** True for a provider the learner blocked: the browser stops the request before it leaves. */
  simulated: boolean;
  message: string;
}

export interface Failover {
  attempts: Attempt[];
  /** Who answered in the end (null: every provider failed). */
  answeredBy: string | null;
  /** Time until the answer, all tries together. */
  totalMs: number;
  blockHeight?: number;
}

/**
 * What a client with a fallback list does: try the providers in order and move on after a failure.
 * A blocked provider gets a simulated 503 that costs no time here.
 */
export async function failover(
  probe: Probe,
  blocked: readonly string[],
  onAttempt?: (a: Attempt) => void,
): Promise<Failover> {
  const attempts: Attempt[] = [];
  let totalMs = 0;
  for (const id of RACE_IDS) {
    let a: Attempt;
    let height: number | undefined;
    if (blocked.includes(id)) {
      a = {
        endpointId: id,
        ok: false,
        latencyMs: 0,
        status: 503,
        simulated: true,
        message: "503 Service Unavailable (simulated outage)",
      };
    } else {
      const p = await probe(id, "final");
      a = {
        endpointId: id,
        ok: p.ok,
        latencyMs: p.latencyMs,
        status: p.ok ? 200 : p.status,
        simulated: false,
        message: p.ok ? `Block #${p.blockHeight.toLocaleString("en-US")}` : p.message,
      };
      if (p.ok) height = p.blockHeight;
    }
    attempts.push(a);
    totalMs += a.latencyMs;
    onAttempt?.(a);
    if (a.ok) return { attempts, answeredBy: id, totalMs, blockHeight: height };
  }
  return { attempts, answeredBy: null, totalMs };
}

export interface Historical {
  regular: RpcProbe;
  archival: RpcProbe;
}

/** Ask a regular node (FastNEAR) and the archival node for the same old block, at the same time. */
export async function historical(probe: Probe): Promise<Historical> {
  const ref = { height: HISTORICAL_BLOCK.height };
  const [regular, archival] = await Promise.all([probe("fastnear", ref), probe("archival", ref)]);
  return { regular, archival };
}

/** How long a latency bar is, as a share of the longest one. Never shorter than 4% so it stays visible. */
export function barShare(ms: number, max: number): number {
  if (max <= 0) return 0.04;
  return Math.max(0.04, Math.min(1, ms / max));
}

export const ms = (n: number) => n.toLocaleString("en-US");

/** The learner's own numbers for later text (manifest `vars`). */
export function varsFor(r: Race | null, f?: Failover | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (r?.winner) {
    out.fastest = nameOf(r.winner.endpointId);
    out.fastestMs = ms(r.winner.latencyMs);
  }
  if (r?.slowest) {
    out.slowest = nameOf(r.slowest.endpointId);
    out.slowestMs = ms(r.slowest.latencyMs);
  }
  if (f?.answeredBy) {
    out.backup = nameOf(f.answeredBy);
    out.backupMs = ms(f.totalMs);
  }
  return out;
}
