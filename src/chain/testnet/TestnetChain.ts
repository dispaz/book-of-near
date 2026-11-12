/**
 * TestnetChain: the Chain interface on the real NEAR testnet (docs/chain.md).
 *
 * - Reads go through JSON-RPC with a fallback list (rpc.ts).
 * - Transactions are Borsh-encoded here (borsh.ts) and signed with near-kit (keys.ts), so the
 *   nonce and block hash the learner saw at build time are exactly what gets signed.
 * - Phase events follow the network: `broadcast` when send_tx goes out, `included` when the node
 *   reports INCLUDED, `executed` at EXECUTED_OPTIMISTIC, `final` at FINAL. `pace` is ignored.
 */
import { base64 } from "@scure/base";
import { isValidAccountId } from "../accountId";
import { ChainError } from "../errors";
import type {
  DelegateRequest,
  RelayResult,
  SignedDelegate,
  AccessKeyInfo,
  AccountId,
  AccountView,
  BlockRef,
  BlockView,
  Chain,
  ChunkView,
  CryptoHash,
  PhaseEvent,
  PhaseTimings,
  PracticeAccount,
  PublicKey,
  SendOptions,
  ShardId,
  ShardLayout,
  SignedTransaction,
  TransactionRequest,
  TxOutcome,
  UnsignedTransaction,
  ViewCallResult,
} from "../types";
import {
  delegateDigest,
  serializeSignedDelegate,
  serializeSignedTransaction,
  transactionDigest,
  transactionHash,
} from "./borsh";
import { KeyStore } from "./keys";
import {
  blockHashesOf,
  invalidTransactionError,
  mapAccessKeyList,
  mapBlock,
  mapChunkHeader,
  mapShardLayout,
  mapTxOutcome,
  type BlockInfo,
} from "./map";
import {
  fundPracticeAccount,
  memoryPracticeStore,
  newPracticeRecord,
  postJson,
  type Funder,
  type PracticeStore,
} from "./practice";
import { Rpc, RpcError, RpcUnreachable, TESTNET_ARCHIVAL_RPC_URLS } from "./rpc";

/* eslint-disable @typescript-eslint/no-explicit-any -- RPC JSON */
type Json = any;

/** A delegate action stays valid for this many blocks after it is signed (about 2 minutes). */
const DELEGATE_VALIDITY_BLOCKS = 200;

export interface TestnetChainOptions {
  rpc?: Rpc;
  /** Used for old blocks and transactions the regular nodes no longer keep. */
  archivalRpc?: Rpc;
  /** Where the practice account's throwaway key lives (localStorage in the app). */
  store?: PracticeStore;
  /** Faucets to try, in order, when there is no practice account yet. */
  funders?: Funder[];
  /** The app's account that receives practice transfers (VITE_RETURN_ACCOUNT_ID). */
  returnAccountId?: AccountId;
  /** How long to wait for a new account to show up at final finality. */
  accountWaitMs?: number;
  now?: () => number;
  /** The Worker that relays meta-transactions (`VITE_WORKER_URL`); `POST <url>/relay`. */
  relayUrl?: string;
  /** Fetch used for the relayer (tests). */
  fetch?: typeof fetch;
}

export class TestnetChain implements Chain {
  readonly network = "testnet" as const;
  private readonly rpc: Rpc;
  private readonly archival: Rpc;
  private readonly store: PracticeStore;
  private readonly funders: Funder[];
  private readonly keys = new KeyStore();
  private readonly now: () => number;
  private readonly accountWaitMs: number;
  private readonly returnAccountId: AccountId | undefined;
  private readonly relayUrl: string | undefined;
  private readonly doFetch: typeof fetch;
  private practice: Promise<PracticeAccount> | null = null;
  private layout: Promise<ShardLayout> | null = null;
  private readonly blockInfo = new Map<string, BlockInfo>();
  /** Last nonce this session used per key, so quick successive builds never collide. */
  private readonly usedNonce = new Map<string, bigint>();
  private readonly sentHere = new Map<CryptoHash, SignedTransaction>();

  constructor(opts: TestnetChainOptions = {}) {
    this.rpc = opts.rpc ?? new Rpc();
    this.archival = opts.archivalRpc ?? new Rpc({ urls: TESTNET_ARCHIVAL_RPC_URLS });
    this.store = opts.store ?? memoryPracticeStore();
    this.funders = opts.funders ?? [];
    this.now = opts.now ?? (() => performance.now());
    this.accountWaitMs = opts.accountWaitMs ?? 20_000;
    this.returnAccountId = opts.returnAccountId?.trim() || undefined;
    this.relayUrl = opts.relayUrl?.trim().replace(/\/+$/, "") || undefined;
    this.doFetch = opts.fetch ?? ((...a) => fetch(...a));
  }

  async returnAccount(): Promise<AccountId> {
    return this.returnAccountId ?? (await this.practiceAccount()).accountId;
  }

  // ---------- RPC helpers ----------

  private async call<T>(method: string, params: unknown, rpc = this.rpc): Promise<T> {
    try {
      return await rpc.call<T>(method, params);
    } catch (e) {
      if (e instanceof RpcUnreachable) throw new ChainError("Network", e.message);
      throw e;
    }
  }

  private query<T>(params: Record<string, unknown>): Promise<T> {
    return this.call<T>("query", { finality: "final", ...params });
  }

  // ---------- Practice account ----------

  practiceAccount(): Promise<PracticeAccount> {
    this.practice ??= this.openPracticeAccount().catch((e: unknown) => {
      this.practice = null;
      throw e;
    });
    return this.practice;
  }

  private async openPracticeAccount(): Promise<PracticeAccount> {
    const stored = this.store.load();
    if (stored) {
      this.keys.add(stored.publicKey, stored.secretKey);
      const keys = await this.listKeys(stored.accountId).catch((e: unknown) => {
        if (e instanceof ChainError && e.kind === "AccountDoesNotExist") return [];
        throw e;
      });
      if (keys.some((k) => k.publicKey === stored.publicKey))
        return { accountId: stored.accountId, publicKey: stored.publicKey };
      // The account or key is gone (testnet resets, or the key was deleted): make a new one.
      this.store.clear();
    }
    const pair = await this.keys.generate();
    let funded;
    try {
      funded = await fundPracticeAccount(pair.publicKey, this.funders);
    } catch (e) {
      throw new ChainError("Network", (e as Error).message);
    }
    this.store.save(newPracticeRecord(funded.accountId, pair.publicKey, pair.secretKey, funded.fundedBy));
    await this.waitForAccount(funded.accountId);
    return { accountId: funded.accountId, publicKey: pair.publicKey };
  }

  private async waitForAccount(accountId: AccountId) {
    const until = Date.now() + this.accountWaitMs;
    while (!(await this.accountExists(accountId))) {
      if (Date.now() > until)
        throw new ChainError(
          "Network",
          "The faucet answered, but the new account did not appear on testnet.",
        );
      await sleep(700);
    }
  }

  // ---------- Reads ----------

  async viewAccount(accountId: AccountId): Promise<AccountView> {
    try {
      const r = await this.query<Json>({ request_type: "view_account", account_id: accountId });
      return {
        accountId,
        amount: BigInt(r.amount),
        locked: BigInt(r.locked),
        codeHash: r.code_hash,
        storageUsage: Number(r.storage_usage),
        blockHeight: Number(r.block_height),
        blockHash: r.block_hash,
      };
    } catch (e) {
      throw this.accountError(e, accountId);
    }
  }

  private accountError(e: unknown, accountId: AccountId): unknown {
    if (e instanceof RpcError && (e.name === "UNKNOWN_ACCOUNT" || e.name === "INVALID_ACCOUNT"))
      return new ChainError("AccountDoesNotExist", `Account ${accountId} does not exist.`);
    return e;
  }

  async accountExists(accountId: AccountId): Promise<boolean> {
    try {
      await this.viewAccount(accountId);
      return true;
    } catch (e) {
      if (e instanceof ChainError && e.kind === "AccountDoesNotExist") return false;
      throw e;
    }
  }

  async listKeys(accountId: AccountId): Promise<AccessKeyInfo[]> {
    try {
      return mapAccessKeyList(
        await this.query<Json>({ request_type: "view_access_key_list", account_id: accountId }),
      );
    } catch (e) {
      throw this.accountError(e, accountId);
    }
  }

  async viewCall<T = unknown>(
    contractId: AccountId,
    methodName: string,
    args: Record<string, unknown> = {},
  ): Promise<ViewCallResult<T>> {
    let r: Json;
    try {
      r = await this.query<Json>({
        request_type: "call_function",
        account_id: contractId,
        method_name: methodName,
        args_base64: base64.encode(new TextEncoder().encode(JSON.stringify(args))),
      });
    } catch (e) {
      const mapped = this.accountError(e, contractId);
      if (mapped instanceof ChainError) throw mapped;
      if (e instanceof RpcError) throw new ChainError("ViewFailed", e.message);
      throw e;
    }
    // Older nodes put a contract error inside the result instead of the error field.
    if (r.error) throw new ChainError("ViewFailed", String(r.error));
    const bytes = Uint8Array.from(r.result as number[]);
    const text = new TextDecoder().decode(bytes);
    let result: unknown = text;
    try {
      result = text === "" ? null : JSON.parse(text);
    } catch {
      /* not JSON: keep the text */
    }
    return {
      result: result as T,
      logs: r.logs ?? [],
      blockHeight: Number(r.block_height),
      blockHash: r.block_hash,
    };
  }

  async newKeyPair(): Promise<PublicKey> {
    return (await this.keys.generate()).publicKey;
  }

  // ---------- Transactions ----------

  /** The signer's full-access key that this app holds. */
  private async defaultKey(signerId: AccountId): Promise<PublicKey> {
    const me = await this.practiceAccount();
    if (signerId === me.accountId) return me.publicKey;
    const keys = await this.listKeys(signerId);
    const ours = keys.find((k) => k.permission.type === "FullAccess" && this.keys.has(k.publicKey));
    if (!ours)
      throw new ChainError(
        "InvalidTransaction",
        `This app holds no full-access key for ${signerId}.`,
        "AccessKeyNotFound",
      );
    return ours.publicKey;
  }

  async buildTransaction(request: TransactionRequest): Promise<UnsignedTransaction> {
    const signerId = request.signerId ?? (await this.practiceAccount()).accountId;
    const publicKey = request.publicKey ?? (await this.defaultKey(signerId));
    let key: Json;
    try {
      key = await this.query<Json>({
        request_type: "view_access_key",
        account_id: signerId,
        public_key: publicKey,
      });
    } catch (e) {
      if (e instanceof RpcError) {
        if (e.name === "UNKNOWN_ACCOUNT")
          throw new ChainError(
            "InvalidTransaction",
            `The sender ${signerId} does not exist.`,
            "SignerDoesNotExist",
          );
        if (e.name === "UNKNOWN_ACCESS_KEY")
          throw new ChainError(
            "InvalidTransaction",
            `${signerId} has no key ${publicKey}.`,
            "AccessKeyNotFound",
          );
        if (e.name === "INVALID_ACCOUNT")
          throw new ChainError(
            "InvalidTransaction",
            `"${signerId}" is not a valid account id.`,
            "InvalidSignerId",
          );
      }
      throw e;
    }
    // Some nodes report a missing key inside the result instead of as an error.
    if (key?.error || key?.nonce === undefined)
      throw new ChainError("InvalidTransaction", `${signerId} has no key ${publicKey}.`, "AccessKeyNotFound");
    const slot = `${signerId}/${publicKey}`;
    const onChain = BigInt(key.nonce);
    const nonce = (onChain > (this.usedNonce.get(slot) ?? 0n) ? onChain : this.usedNonce.get(slot)!) + 1n;
    this.usedNonce.set(slot, nonce);
    const tx: UnsignedTransaction = {
      signerId,
      publicKey,
      nonce,
      receiverId: request.receiverId,
      blockHash: key.block_hash,
      actions: request.actions,
    };
    return tx;
  }

  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    const digest = transactionDigest(tx);
    const signature = await this.keys.sign(tx.publicKey, digest);
    return { ...tx, hash: transactionHash(tx), signature };
  }

  async signDelegate(request: DelegateRequest): Promise<SignedDelegate> {
    if (request.actions.some((a) => a.type === "Delegate"))
      throw new ChainError("InvalidTransaction", "A delegate action cannot hold another one.");
    const tx = await this.buildTransaction({
      signerId: request.senderId,
      receiverId: request.receiverId,
      actions: request.actions,
      publicKey: request.publicKey,
    });
    const head = await this.block("final");
    const fields = {
      senderId: tx.signerId,
      receiverId: tx.receiverId,
      actions: tx.actions,
      nonce: tx.nonce,
      maxBlockHeight: BigInt(head.height + DELEGATE_VALIDITY_BLOCKS),
      publicKey: tx.publicKey,
    };
    const signature = await this.keys.sign(tx.publicKey, delegateDigest(fields));
    const payload = base64.encode(serializeSignedDelegate({ ...fields, signature }));
    return { ...fields, signature, payload };
  }

  async relayDelegate(signed: SignedDelegate, options: SendOptions = {}): Promise<RelayResult> {
    if (!this.relayUrl)
      throw new ChainError("RelayRefused", "No relayer is set up for testnet in this app yet.");
    let reply: Awaited<ReturnType<typeof postJson>>;
    try {
      reply = await postJson(this.doFetch, `${this.relayUrl}/relay`, { signedDelegate: signed.payload }, 60_000);
    } catch {
      throw new ChainError("Network", "The relayer could not be reached.");
    }
    const body = (reply.json ?? {}) as Json;
    if (!reply.res.ok || typeof body.txHash !== "string")
      throw new ChainError(
        "RelayRefused",
        typeof body.error === "string" ? body.error : `The relayer answered ${reply.res.status}.`,
      );
    // The Worker waited for the relayer's transaction; read it back so the lesson can show its receipts.
    const outcome = await this.getTransaction(body.txHash, String(body.relayerId));
    options.onPhase?.({ phase: "final", atMs: 0, txHash: body.txHash, status: "FINAL" });
    return {
      relayerId: String(body.relayerId),
      outcome,
      remaining: Number(body.remaining ?? 0),
      cap: Number(body.cap ?? 0),
    };
  }

  async sendTransaction(request: TransactionRequest, options: SendOptions = {}): Promise<TxOutcome> {
    const unsigned = await this.buildTransaction(request);
    const clockStart = this.now();
    options.onPhase?.({ phase: "built", atMs: 0, status: "NONE" });
    const signed = await this.signTransaction(unsigned);
    const signedAt = round(this.now() - clockStart);
    options.onPhase?.({ phase: "signed", atMs: signedAt, txHash: signed.hash, status: "NONE" });
    return this.broadcast(signed, options, clockStart, signedAt);
  }

  async sendSignedTransaction(tx: SignedTransaction, options: SendOptions = {}): Promise<TxOutcome> {
    checkAccountIds(tx);
    // Nodes answer a re-sent transaction with its old result instead of running it twice.
    // Say what really happened: its nonce is used up, so the network will not run it again.
    const key = await this.query<Json>({
      request_type: "view_access_key",
      account_id: tx.signerId,
      public_key: tx.publicKey,
    }).catch(() => null);
    if (key?.nonce !== undefined && BigInt(key.nonce) >= tx.nonce)
      throw new ChainError(
        "InvalidTransaction",
        `Nonce ${tx.nonce} is already used. The key's last nonce is ${key.nonce}, so the network will not run this again.`,
        "InvalidNonce",
      );
    // The phase clock starts now; built and signed happened earlier, outside this call.
    const start = this.now();
    options.onPhase?.({ phase: "built", atMs: 0, status: "NONE" });
    options.onPhase?.({ phase: "signed", atMs: 0, txHash: tx.hash, status: "NONE" });
    return this.broadcast(tx, options, start, 0);
  }

  private async broadcast(
    tx: SignedTransaction,
    options: SendOptions,
    clockStart: number,
    signedAt: number,
  ): Promise<TxOutcome> {
    checkAccountIds(tx);
    const at = () => round(this.now() - clockStart);
    const emit = (e: PhaseEvent) => options.onPhase?.(e);
    const bytes = serializeSignedTransaction(tx, tx.signature);
    const hash = transactionHash(tx);

    const broadcastAt = at();
    emit({ phase: "broadcast", atMs: broadcastAt, txHash: hash, status: "NONE", node: hostOf(this.rpc.url) });
    try {
      await this.call("send_tx", { signed_tx_base64: base64.encode(bytes), wait_until: "INCLUDED" });
    } catch (e) {
      if (e instanceof RpcError) {
        const invalid = invalidTransactionError(e);
        if (invalid) throw invalid;
        // A node timeout does not mean the transaction failed: carry on and ask for its status.
        if (e.name !== "TIMEOUT_ERROR") throw new ChainError("Network", e.message);
      } else throw e;
    }
    const includedAt = Math.max(at(), broadcastAt + 1);
    this.sentHere.set(hash, tx);

    const optimistic = await this.txStatus(hash, tx.signerId, "EXECUTED_OPTIMISTIC");
    const inclusion = optimistic.transaction_outcome.block_hash as string;
    const inclusionBlock = await this.blockInfoFor(inclusion);
    emit({
      phase: "included",
      atMs: includedAt,
      txHash: hash,
      status: "INCLUDED",
      node: hostOf(this.rpc.url),
      blockHash: inclusion,
      blockHeight: inclusionBlock.height,
    });
    const executedAt = Math.max(at(), includedAt);
    emit({
      phase: "executed",
      atMs: executedAt,
      txHash: hash,
      status: "EXECUTED_OPTIMISTIC",
      blockHash: inclusion,
      blockHeight: inclusionBlock.height,
    });
    const final = await this.txStatus(hash, tx.signerId, "FINAL");
    const finalAt = Math.max(at(), executedAt + 1);
    const timings: PhaseTimings = {
      built: 0,
      signed: signedAt,
      broadcast: broadcastAt,
      included: includedAt,
      executed: executedAt,
      final: finalAt,
    };
    const outcome = await this.toOutcome(final, tx, timings);
    emit({
      phase: "final",
      atMs: finalAt,
      txHash: hash,
      status: "FINAL",
      blockHash: inclusion,
      blockHeight: inclusionBlock.height,
    });
    return outcome;
  }

  /** EXPERIMENTAL_tx_status, retried while the node has not seen the transaction yet. */
  private async txStatus(hash: CryptoHash, senderId: AccountId, waitUntil: string): Promise<Json> {
    const until = Date.now() + 120_000;
    for (;;) {
      try {
        return await this.call<Json>("EXPERIMENTAL_tx_status", {
          tx_hash: hash,
          sender_account_id: senderId,
          wait_until: waitUntil,
        });
      } catch (e) {
        const retry =
          e instanceof RpcError && (e.name === "UNKNOWN_TRANSACTION" || e.name === "TIMEOUT_ERROR");
        if (!retry || Date.now() > until) throw e;
        await sleep(500);
      }
    }
  }

  private async toOutcome(raw: Json, signed: SignedTransaction | undefined, timings?: PhaseTimings) {
    const hashes = blockHashesOf(raw);
    await Promise.all(hashes.map((h) => this.blockInfoFor(h)));
    return mapTxOutcome(raw, { signed, blocks: this.blockInfo, layout: await this.shardLayout(), timings });
  }

  async getTransaction(hash: CryptoHash, senderId: AccountId): Promise<TxOutcome> {
    const params = { tx_hash: hash, sender_account_id: senderId, wait_until: "NONE" };
    let raw: Json;
    try {
      raw = await this.call<Json>("EXPERIMENTAL_tx_status", params);
    } catch (e) {
      if (!(e instanceof RpcError) || e.name !== "UNKNOWN_TRANSACTION") throw e;
      try {
        raw = await this.call<Json>("EXPERIMENTAL_tx_status", params, this.archival);
      } catch {
        throw new ChainError("UnknownTransaction", `Transaction ${hash} was not found.`);
      }
    }
    if (!raw?.transaction_outcome)
      throw new ChainError("UnknownTransaction", `Transaction ${hash} was not found.`);
    return this.toOutcome(raw, this.sentHere.get(hash));
  }

  // ---------- Blocks, chunks, shards ----------

  private async rawBlock(ref: BlockRef = "final"): Promise<Json> {
    const params =
      ref === "final" || ref === "optimistic"
        ? { finality: ref }
        : { block_id: "height" in ref ? ref.height : ref.hash };
    try {
      return await this.call<Json>("block", params);
    } catch (e) {
      if (!(e instanceof RpcError) || e.name !== "UNKNOWN_BLOCK") throw e;
      try {
        return await this.call<Json>("block", params, this.archival);
      } catch {
        throw new ChainError("UnknownBlock", "That block is not known.");
      }
    }
  }

  private async blockInfoFor(hash: string): Promise<BlockInfo> {
    const known = this.blockInfo.get(hash);
    if (known) return known;
    const b = mapBlock(await this.rawBlock({ hash }));
    const info = { height: b.height, timestampMs: b.timestampMs };
    this.blockInfo.set(hash, info);
    return info;
  }

  async block(ref: BlockRef = "final"): Promise<BlockView> {
    const b = mapBlock(await this.rawBlock(ref));
    this.blockInfo.set(b.hash, { height: b.height, timestampMs: b.timestampMs });
    return b;
  }

  async chunk(ref: BlockRef, shardId: ShardId): Promise<ChunkView> {
    const raw = await this.rawBlock(ref);
    const block = mapBlock(raw);
    const header = block.chunks.find((c) => c.shardId === shardId);
    if (!header) throw new ChainError("UnknownChunk", `There is no shard ${shardId}.`);
    let c: Json;
    try {
      c = await this.call<Json>("chunk", { chunk_id: header.chunkHash });
    } catch (e) {
      if (!(e instanceof RpcError)) throw e;
      try {
        c = await this.call<Json>("chunk", { chunk_id: header.chunkHash }, this.archival);
      } catch {
        throw new ChainError("UnknownChunk", "That chunk is not known.");
      }
    }
    return {
      header: c.header ? mapChunkHeader(c.header) : header,
      blockHash: block.hash,
      blockHeight: block.height,
      transactions: (c.transactions as Json[]).map((t) => t.hash),
      // RPC lists the receipts this chunk sends out; the demo lists the ones it applies.
      receipts: (c.receipts as Json[]).map((r) => r.receipt_id),
    };
  }

  shardLayout(): Promise<ShardLayout> {
    this.layout ??= this.call<Json>("EXPERIMENTAL_protocol_config", { finality: "final" })
      .then(mapShardLayout)
      .catch((e: unknown) => {
        this.layout = null;
        throw e;
      });
    return this.layout;
  }
}

/** The network cannot even decode a malformed account id, so refuse it the way it would. */
function checkAccountIds(tx: UnsignedTransaction) {
  if (!isValidAccountId(tx.signerId))
    throw new ChainError(
      "InvalidTransaction",
      `"${tx.signerId}" is not a valid account id.`,
      "InvalidSignerId",
    );
  if (!isValidAccountId(tx.receiverId))
    throw new ChainError(
      "InvalidTransaction",
      `"${tx.receiverId}" is not a valid account id.`,
      "InvalidReceiverId",
    );
}

function round(ms: number) {
  return Math.max(0, Math.round(ms));
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** "https://rpc.testnet.fastnear.com" → "rpc.testnet.fastnear.com". */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
