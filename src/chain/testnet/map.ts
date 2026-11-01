/**
 * Maps NEAR RPC JSON (snake_case, amounts as strings) into the Chain result shapes in ../types.ts.
 * Pure functions, unit tested with recorded testnet responses in fixtures/.
 */
import { base64 } from "@scure/base";
import { ChainError } from "../errors";
import { shardForAccount } from "../shards";
import type {
  AccessKeyInfo,
  AccessKeyPermission,
  Action,
  ActionErrorKind,
  BlockView,
  ChunkHeaderView,
  ExecutionOutcome,
  ExecutionStatus,
  FinalExecutionStatus,
  InvalidTxReason,
  PhaseTimings,
  ReceiptView,
  ShardLayout,
  SignedTransaction,
  TxExecutionError,
  TxExecutionStatus,
  TxOutcome,
} from "../types";
import { RpcError } from "./rpc";

/* eslint-disable @typescript-eslint/no-explicit-any -- RPC JSON is loosely typed by nature. */
type Json = any;

const big = (v: unknown): bigint => (v === null || v === undefined ? 0n : BigInt(String(v)));

// ---------- Keys and actions ----------

export function mapPermission(p: Json): AccessKeyPermission {
  if (p === "FullAccess" || p?.FullAccess !== undefined) return { type: "FullAccess" };
  const fc = p?.FunctionCall ?? p;
  const out: AccessKeyPermission = {
    type: "FunctionCall",
    receiverId: fc.receiver_id,
    methodNames: fc.method_names ?? [],
  };
  if (fc.allowance !== null && fc.allowance !== undefined) out.allowance = big(fc.allowance);
  return out;
}

export function mapAccessKeyList(list: Json): AccessKeyInfo[] {
  return (list.keys as Json[]).map((k) => ({
    publicKey: k.public_key,
    nonce: big(k.access_key.nonce),
    permission: mapPermission(k.access_key.permission),
  }));
}

function decodeArgs(b64: string | undefined): Record<string, unknown> {
  if (!b64) return {};
  try {
    const v: unknown = JSON.parse(new TextDecoder().decode(base64.decode(b64)));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : { value: v };
  } catch {
    return { base64: b64 };
  }
}

export function mapAction(a: Json): Action {
  if (a === "CreateAccount") return { type: "CreateAccount" };
  const [kind, v] = Object.entries(a as Record<string, Json>)[0]!;
  switch (kind) {
    case "CreateAccount":
      return { type: "CreateAccount" };
    case "DeployContract": {
      let code: Uint8Array = new Uint8Array();
      try {
        if (typeof v.code === "string") code = base64.decode(v.code);
      } catch {
        /* newer nodes send a hash instead of the code */
      }
      return { type: "DeployContract", code };
    }
    case "FunctionCall":
      return {
        type: "FunctionCall",
        methodName: v.method_name,
        args: decodeArgs(v.args),
        gas: big(v.gas),
        deposit: big(v.deposit),
      };
    case "Transfer":
      return { type: "Transfer", deposit: big(v.deposit) };
    case "AddKey":
      return {
        type: "AddKey",
        publicKey: v.public_key,
        permission: mapPermission(v.access_key.permission),
      };
    case "DeleteKey":
      return { type: "DeleteKey", publicKey: v.public_key };
    case "DeleteAccount":
      return { type: "DeleteAccount", beneficiaryId: v.beneficiary_id };
    default:
      // Stake, delegate and global-contract actions are not part of the course; show them as a call.
      return { type: "FunctionCall", methodName: kind, args: {}, gas: 0n, deposit: 0n };
  }
}

// ---------- Errors ----------

const INVALID_TX_REASONS: InvalidTxReason[] = [
  "SignerDoesNotExist",
  "InvalidSignerId",
  "InvalidReceiverId",
  "AccessKeyNotFound",
  "ReceiverMismatch",
  "MethodNameMismatch",
  "RequiresFullAccess",
  "NotEnoughAllowance",
  "DepositWithFunctionCall",
  "InvalidNonce",
  "Expired",
  "NotEnoughBalance",
  "LackBalanceForState",
  "InvalidSignature",
];

const INVALID_TX_MESSAGES: Record<InvalidTxReason, string> = {
  SignerDoesNotExist: "The sender's account does not exist.",
  InvalidSignerId: "The sender is not a valid account id.",
  InvalidReceiverId: "The receiver is not a valid account id.",
  AccessKeyNotFound: "The sender has no such key. It may have been deleted.",
  ReceiverMismatch: "This key may only call one contract, and this is a different one.",
  MethodNameMismatch: "This key may not call that method.",
  RequiresFullAccess: "This key may only call contract methods. It cannot send NEAR or change keys.",
  NotEnoughAllowance: "This key's allowance is too small to pay for the gas.",
  DepositWithFunctionCall: "This key cannot attach NEAR to a call.",
  InvalidNonce: "The nonce is already used. Each transaction from a key needs a higher nonce.",
  Expired: "The transaction is too old: its block hash has expired.",
  NotEnoughBalance: "The sender does not have enough NEAR for this.",
  LackBalanceForState: "The sender must keep enough NEAR to pay for its storage.",
  InvalidSignature: "The signature does not match the transaction. Was it changed after signing?",
};

/** Find the first known InvalidTxError reason anywhere inside an RPC error object. */
export function findInvalidTxReason(raw: unknown): InvalidTxReason | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown): InvalidTxReason | null => {
    if (typeof v === "string") return INVALID_TX_REASONS.find((r) => v === r) ?? null;
    if (!v || typeof v !== "object" || seen.has(v)) return null;
    seen.add(v);
    for (const [k, inner] of Object.entries(v)) {
      const hit = INVALID_TX_REASONS.find((r) => r === k);
      if (hit) return hit;
      const deeper = walk(inner);
      if (deeper) return deeper;
    }
    return null;
  };
  return walk(raw);
}

/** RPC error from send_tx → ChainError "InvalidTransaction" with a reason, or null if it is not one. */
export function invalidTransactionError(e: RpcError): ChainError | null {
  // A malformed account id cannot even be decoded by the node.
  if (e.name === "PARSE_ERROR" && /Account ID/i.test(e.message))
    return new ChainError("InvalidTransaction", INVALID_TX_MESSAGES.InvalidReceiverId, "InvalidReceiverId");
  if (e.name !== "INVALID_TRANSACTION" && !/InvalidTxError|InvalidTransaction/.test(JSON.stringify(e.raw)))
    return null;
  const reason = findInvalidTxReason(e.raw);
  if (!reason)
    return new ChainError("InvalidTransaction", `The network refused the transaction: ${e.message}`);
  return new ChainError("InvalidTransaction", INVALID_TX_MESSAGES[reason], reason);
}

function actionErrorKind(kind: Json): { kind: ActionErrorKind; message: string } {
  const [name, v] = Object.entries(kind as Record<string, Json>)[0] ?? ["Unknown", {}];
  switch (name) {
    case "FunctionCallError": {
      const inner = v?.ExecutionError ?? v?.MethodResolveError ?? v?.CompilationError ?? v;
      const message = typeof inner === "string" ? inner : `The contract call failed: ${JSON.stringify(v)}`;
      return { kind: { type: "FunctionCallError", message }, message };
    }
    case "AccountAlreadyExists":
      return {
        kind: { type: "AccountAlreadyExists", accountId: v.account_id },
        message: `The account ${v.account_id} already exists.`,
      };
    case "AccountDoesNotExist":
      return {
        kind: { type: "AccountDoesNotExist", accountId: v.account_id },
        message: `The account ${v.account_id} does not exist.`,
      };
    case "CreateAccountNotAllowed":
      return {
        kind: { type: "CreateAccountNotAllowed", accountId: v.account_id, predecessorId: v.predecessor_id },
        message: `${v.predecessor_id} may not create ${v.account_id}. Only its parent account can.`,
      };
    case "ActorNoPermission":
      return {
        kind: { type: "ActorNoPermission", accountId: v.account_id, actorId: v.actor_id },
        message: `${v.actor_id} may not do this to ${v.account_id}.`,
      };
    case "AddKeyAlreadyExists":
      return {
        kind: { type: "AddKeyAlreadyExists", accountId: v.account_id, publicKey: v.public_key },
        message: `${v.account_id} already has that key.`,
      };
    case "DeleteKeyDoesNotExist":
      return {
        kind: { type: "DeleteKeyDoesNotExist", accountId: v.account_id, publicKey: v.public_key },
        message: `${v.account_id} has no such key to delete.`,
      };
    case "LackBalanceForState":
      return {
        kind: { type: "LackBalanceForState", accountId: v.account_id, amount: big(v.amount) },
        message: `${v.account_id} does not keep enough NEAR to pay for its storage.`,
      };
    case "NotEnoughBalance":
      return {
        kind: {
          type: "NotEnoughBalance",
          accountId: v.signer_id ?? v.account_id,
          balance: big(v.balance),
          cost: big(v.cost),
        },
        message: "Not enough NEAR for this.",
      };
    default: {
      const message = `The action failed: ${name}.`;
      return { kind: { type: "FunctionCallError", message }, message };
    }
  }
}

export function mapFailure(f: Json): TxExecutionError {
  if (f?.ActionError) {
    const { kind, message } = actionErrorKind(f.ActionError.kind);
    return { type: "ActionError", index: f.ActionError.index ?? 0, kind, message };
  }
  const reason = findInvalidTxReason(f) ?? "InvalidSignature";
  return { type: "InvalidTxError", reason, message: INVALID_TX_MESSAGES[reason] };
}

export function mapStatus(s: Json): ExecutionStatus {
  if (s && "SuccessValue" in s) return { type: "SuccessValue", value: s.SuccessValue ?? "" };
  if (s && "SuccessReceiptId" in s) return { type: "SuccessReceiptId", receiptId: s.SuccessReceiptId };
  if (s && "Failure" in s) return { type: "Failure", error: mapFailure(s.Failure) };
  // "Unknown" or still running.
  return { type: "SuccessValue", value: "" };
}

// ---------- Blocks, chunks, shards ----------

export function mapChunkHeader(c: Json): ChunkHeaderView {
  return {
    chunkHash: c.chunk_hash,
    shardId: Number(c.shard_id),
    heightCreated: Number(c.height_created),
    heightIncluded: Number(c.height_included),
    gasUsed: big(c.gas_used),
    gasLimit: big(c.gas_limit),
  };
}

export function mapBlock(b: Json): BlockView {
  const h = b.header;
  return {
    height: Number(h.height),
    hash: h.hash,
    prevHash: h.prev_hash,
    timestampMs: Math.floor(Number(BigInt(String(h.timestamp_nanosec ?? h.timestamp)) / 1_000_000n)),
    author: b.author,
    chunks: (b.chunks as Json[]).map(mapChunkHeader),
  };
}

export function mapShardLayout(protocolConfig: Json): ShardLayout {
  const sl = protocolConfig.shard_layout;
  const v = sl.V3 ?? sl.V2 ?? sl.V1 ?? sl;
  const boundaryAccounts: string[] = v.boundary_accounts ?? [];
  const shardIds: number[] = (v.shard_ids ?? boundaryAccounts.concat("").map((_, i) => i)).map(Number);
  return { shardIds, boundaryAccounts };
}

// ---------- Transactions ----------

/** What the mapper needs to know about a block: its height and time. */
export interface BlockInfo {
  height: number;
  timestampMs: number;
}

export interface MapTxContext {
  /** The transaction as this app signed it (keeps the reference block hash RPC does not return). */
  signed?: SignedTransaction;
  blocks: Map<string, BlockInfo>;
  layout: ShardLayout;
  /** Real phase timings measured while sending; derived from block times when absent. */
  timings?: PhaseTimings;
}

/** All block hashes an EXPERIMENTAL_tx_status result refers to (to fetch their heights). */
export function blockHashesOf(raw: Json): string[] {
  const set = new Set<string>([raw.transaction_outcome.block_hash]);
  for (const r of raw.receipts_outcome as Json[]) set.add(r.block_hash);
  return [...set];
}

function outcomeOf(o: Json, ctx: MapTxContext): ExecutionOutcome {
  const block = ctx.blocks.get(o.block_hash);
  return {
    id: o.id,
    executorId: o.outcome.executor_id,
    blockHash: o.block_hash,
    blockHeight: block?.height ?? 0,
    shardId: shardForAccount(ctx.layout, o.outcome.executor_id),
    gasBurnt: big(o.outcome.gas_burnt),
    tokensBurnt: big(o.outcome.tokens_burnt),
    logs: o.outcome.logs ?? [],
    receiptIds: o.outcome.receipt_ids ?? [],
    status: mapStatus(o.outcome.status),
  };
}

function signedFromRpc(t: Json): SignedTransaction {
  return {
    signerId: t.signer_id,
    publicKey: t.public_key,
    nonce: big(t.nonce),
    receiverId: t.receiver_id,
    // RPC `tx` does not return the reference block hash (docs/chain.md).
    blockHash: "",
    actions: (t.actions as Json[]).map(mapAction),
    hash: t.hash,
    signature: t.signature,
  };
}

/** EXPERIMENTAL_tx_status result → TxOutcome. Receipts are sorted by block height (execution order). */
export function mapTxOutcome(raw: Json, ctx: MapTxContext): TxOutcome {
  const transactionOutcome = outcomeOf(raw.transaction_outcome, ctx);
  const receiptInfo = new Map<string, Json>();
  for (const r of (raw.receipts ?? []) as Json[]) receiptInfo.set(r.receipt_id, r);
  // `receipts` leaves out the first receipt, the one the transaction turns into. Rebuild it.
  const t = raw.transaction;
  for (const id of (raw.transaction_outcome.outcome.receipt_ids ?? []) as string[])
    if (!receiptInfo.has(id))
      receiptInfo.set(id, {
        predecessor_id: t.signer_id,
        receiver_id: t.receiver_id,
        receipt: { Action: { actions: t.actions } },
      });

  const receipts: ReceiptView[] = (raw.receipts_outcome as Json[])
    .map((o, order) => {
      const out = outcomeOf(o, ctx);
      const info = receiptInfo.get(o.id);
      const predecessorId: string = info?.predecessor_id ?? "";
      const acts = info?.receipt?.Action?.actions ?? [];
      return {
        order,
        view: {
          ...out,
          predecessorId,
          receiverId: info?.receiver_id ?? out.executorId,
          actions: (acts as Json[]).map(mapAction),
          isRefund: predecessorId === "system",
        } satisfies ReceiptView,
      };
    })
    .sort((a, b) => a.view.blockHeight - b.view.blockHeight || a.order - b.order)
    .map((r) => r.view);

  const gasPrice =
    transactionOutcome.gasBurnt > 0n ? transactionOutcome.tokensBurnt / transactionOutcome.gasBurnt : 0n;
  const status = mapStatus(raw.status);
  const finalStatus: FinalExecutionStatus =
    status.type === "SuccessReceiptId" ? { type: "SuccessValue", value: "" } : status;

  return {
    status: finalStatus,
    finalExecutionStatus: (raw.final_execution_status ?? "FINAL") as TxExecutionStatus,
    transaction: ctx.signed ?? signedFromRpc(raw.transaction),
    transactionOutcome,
    receipts,
    timings: ctx.timings ?? timingsFromBlocks(transactionOutcome, receipts, ctx.blocks),
    gasPrice,
  };
}

/** For transactions looked up later: time from the inclusion block, by block timestamps. */
function timingsFromBlocks(
  t: ExecutionOutcome,
  receipts: ReceiptView[],
  blocks: Map<string, BlockInfo>,
): PhaseTimings {
  const t0 = blocks.get(t.blockHash)?.timestampMs ?? 0;
  const at = (hash: string) => Math.max(0, (blocks.get(hash)?.timestampMs ?? t0) - t0);
  const work = receipts.filter((r) => !r.isRefund);
  const executed = work.length ? Math.max(...work.map((r) => at(r.blockHash))) : 0;
  const last = receipts.length ? Math.max(...receipts.map((r) => at(r.blockHash))) : executed;
  return { built: 0, signed: 0, broadcast: 0, included: 0, executed, final: Math.max(executed, last) };
}

/** Plain-English message for an RPC error that is not about a transaction. */
export function describeRpcError(e: RpcError): string {
  return e.message || e.name;
}
