/**
 * Pure model for lesson 2.1: one finished transaction as a path of hops. Each hop is the transaction or
 * a receipt, run on one shard, in one chunk of one block. Built from what the Chain interface returns
 * (getTransaction, block, shardLayout), so DemoChain and TestnetChain give the same shape. No network here.
 */
import type {
  AccountId,
  BlockView,
  Chain,
  CryptoHash,
  Gas,
  ShardId,
  ShardLayout,
  TxOutcome,
} from "../../../chain/types";

export type HopKind = "transaction" | "receipt" | "callback" | "refund";

export interface Hop {
  /** 0-based position along the path. */
  index: number;
  kind: HopKind;
  /** Transaction hash or receipt id. */
  id: CryptoHash;
  /** The account whose code or balance this step touched. */
  accountId: AccountId;
  /** Who sent the receipt (absent for the transaction itself). */
  predecessorId?: AccountId;
  shardId: ShardId;
  blockHeight: number;
  blockHash: CryptoHash;
  /** The chunk this shard made in that block. */
  chunkHash: CryptoHash;
  /** Block time offset from the transaction's own block, in ms (from block timestamps). */
  sinceMs: number;
  gasBurnt: Gas;
}

/** "yours" = a testnet transaction of the learner; "demo" = the learner's demo transaction; "recorded" = saved example. */
export type TraceSource = "yours" | "demo" | "recorded";

export interface Trace {
  txHash: CryptoHash;
  signerId: AccountId;
  source: TraceSource;
  /** Every shard of the layout, in layout order (rows of the grid). */
  shardIds: ShardId[];
  /** Hops in execution order. */
  hops: Hop[];
  /** First and last block height on the path (the columns of the grid). */
  firstBlock: number;
  lastBlock: number;
  /** Time from the first block to the last step, by block timestamps. */
  workMs: number;
}

/** What 0.3 stored about the learner's transaction. */
export interface SeenEvidence {
  txHash: string;
  mode: "demo" | "testnet";
  includedMs?: number;
  finalMs?: number;
}

const kindOf = (isRefund: boolean, predecessor: string, receiver: string): HopKind =>
  isRefund ? "refund" : predecessor === receiver ? "callback" : "receipt";

/** Builds the path from a transaction outcome, the shard layout and the blocks it touched. */
export function traceFromOutcome(
  outcome: TxOutcome,
  layout: ShardLayout,
  blocks: ReadonlyMap<CryptoHash, BlockView>,
  source: TraceSource,
): Trace {
  const chunkOf = (blockHash: CryptoHash, shardId: ShardId) =>
    blocks.get(blockHash)?.chunks.find((x) => x.shardId === shardId)?.chunkHash ?? "";
  const stamp = (blockHash: CryptoHash) => blocks.get(blockHash)?.timestampMs ?? 0;
  const t = outcome.transactionOutcome;
  const t0 = stamp(t.blockHash);
  type Raw = Omit<Hop, "index" | "chunkHash" | "sinceMs">;
  const first: Raw = {
    kind: "transaction",
    id: outcome.transaction.hash,
    accountId: t.executorId,
    shardId: t.shardId,
    blockHash: t.blockHash,
    blockHeight: t.blockHeight,
    gasBurnt: t.gasBurnt,
  };
  const rest: Raw[] = outcome.receipts.map((r) => ({
    kind: kindOf(r.isRefund, r.predecessorId, r.receiverId),
    id: r.id,
    accountId: r.executorId,
    predecessorId: r.predecessorId,
    shardId: r.shardId,
    blockHash: r.blockHash,
    blockHeight: r.blockHeight,
    gasBurnt: r.gasBurnt,
  }));
  // The transaction stays first; receipts follow in block order (stable inside one block).
  const sorted = [first, ...rest.sort((a, b) => a.blockHeight - b.blockHeight)];
  const hops: Hop[] = sorted.map((h, index) => ({
    ...h,
    index,
    chunkHash: chunkOf(h.blockHash, h.shardId),
    sinceMs: Math.max(0, stamp(h.blockHash) - t0),
  }));
  return {
    txHash: outcome.transaction.hash,
    signerId: outcome.transaction.signerId,
    source,
    shardIds: [...layout.shardIds],
    hops,
    firstBlock: hops[0]!.blockHeight,
    lastBlock: Math.max(...hops.map((h) => h.blockHeight)),
    workMs: Math.max(...hops.map((h) => h.sinceMs)),
  };
}

/** Looks a finished transaction up through the Chain interface and builds its path. */
export async function loadTrace(
  chain: Chain,
  txHash: CryptoHash,
  signerId: AccountId,
  source: TraceSource,
): Promise<Trace> {
  const [outcome, layout] = await Promise.all([chain.getTransaction(txHash, signerId), chain.shardLayout()]);
  const hashes = new Set([outcome.transactionOutcome.blockHash, ...outcome.receipts.map((r) => r.blockHash)]);
  const blocks = new Map<CryptoHash, BlockView>();
  await Promise.all([...hashes].map(async (hash) => blocks.set(hash, await chain.block({ hash }))));
  return traceFromOutcome(outcome, layout, blocks, source);
}

// ---------- facts for the text ----------

/** Distinct shards in the order the path first reaches them. */
export function touchedShards(trace: Trace): ShardId[] {
  return [...new Set(trace.hops.map((h) => h.shardId))];
}

/** Distinct blocks on the path, in order. */
export function touchedBlocks(trace: Trace): number[] {
  return [...new Set(trace.hops.map((h) => h.blockHeight))];
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Learner-facing numbers for the manifest's `{placeholders}`. */
export function varsFor(trace: Trace, seen?: SeenEvidence | null): Record<string, string> {
  const own = trace.source !== "recorded" && seen?.finalMs !== undefined;
  return {
    firstShard: String(trace.hops[0]!.shardId),
    firstBlock: String(trace.firstBlock),
    hops: String(trace.hops.length),
    shardsTouched: plural(touchedShards(trace).length, "shard"),
    blocksCount: plural(touchedBlocks(trace).length, "block"),
    workTime: seconds(trace.workMs),
    finalSeen: own
      ? `the ${seconds(seen!.finalMs!)} until Final in 0.3`
      : "the few seconds a transaction takes to become final",
  };
}

/** The split of the stopwatch from 0.3, when 0.3 reported it: hand-over, receipts, and the rest. */
export function timeSplit(trace: Trace, seen?: SeenEvidence | null) {
  if (trace.source === "recorded" || !seen || seen.finalMs === undefined || seen.includedMs === undefined)
    return null;
  const rest = seen.finalMs - seen.includedMs - trace.workMs;
  return {
    includedMs: seen.includedMs,
    workMs: trace.workMs,
    restMs: Math.max(0, rest),
    finalMs: seen.finalMs,
  };
}

export interface TimePart {
  key: "handover" | "hops" | "finality";
  label: string;
  ms: number;
}

/**
 * Where the time went (step 5), as labelled parts in order. With the learner's own 0.3 stopwatch: the
 * hand-over (Send until the transaction was in a block), the shard hops (block timestamps) and the wait
 * for finality (the rest). A recorded example has no stopwatch, so only the hops are known.
 */
export function breakdown(trace: Trace, seen?: SeenEvidence | null): TimePart[] {
  const hops: TimePart = { key: "hops", label: "Shard hops, block to block", ms: trace.workMs };
  const split = timeSplit(trace, seen);
  if (!split) return [hops];
  return [
    { key: "handover", label: "Hand-over to the RPC node and into a block", ms: split.includedMs },
    hops,
    { key: "finality", label: "Waiting for finality", ms: split.restMs },
  ];
}

/** Reads the 0.3 evidence from the progress store. */
export function readSeenEvidence(raw: Record<string, string> | undefined): SeenEvidence | null {
  if (!raw?.txHash) return null;
  const num = (v?: string) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined);
  return {
    txHash: raw.txHash,
    mode: raw.mode === "testnet" ? "testnet" : "demo",
    includedMs: num(raw.includedMs),
    finalMs: num(raw.finalMs),
  };
}
