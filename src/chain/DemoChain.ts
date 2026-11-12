/**
 * DemoChain: a deterministic, in-memory NEAR look-alike for demo mode. No network, no wallet.
 * Same seed + same calls gives byte-identical results (hashes, heights, timings).
 *
 * The model, in short (docs/chain.md has more):
 * - Blocks every 600 ms (https://docs.near.org/integrations/blocks-and-finality). A transaction is
 *   broadcast 250 ms after send, included in the next block, its receipts run one block apart when
 *   they cross accounts, and it is final two blocks after the last receipt.
 * - Six shards split by boundary accounts, like NEAR's shard layout.
 * - Gas fees from demo/fees.ts (approximations), gas held up front and refunded at the end.
 * - Actions in one receipt are all-or-nothing: a failing action rolls back the whole receipt.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { base58, base64 } from "@scure/base";
import { bytesToHex } from "@noble/hashes/utils.js";
import { isDirectSubAccount, isImplicitAccountId, isValidAccountId } from "./accountId";
import { ChainError } from "./errors";
import { encodeSuccessValue } from "./ops";
import { HISTORICAL_BLOCK, RECORDED_LATENCY_MS, RPC_ENDPOINTS } from "./rpcEndpoints";
import { shardForAccount } from "./shards";
import type {
  AccessKeyInfo,
  AccessKeyPermission,
  AccountId,
  AccountView,
  Action,
  ActionErrorKind,
  BlockRef,
  BlockView,
  Chain,
  ChunkHeaderView,
  ChunkView,
  CryptoHash,
  ExecutionOutcome,
  ExecutionStatus,
  FinalExecutionStatus,
  Gas,
  InvalidTxReason,
  PhaseEvent,
  PhaseTimings,
  PracticeAccount,
  ProbeOptions,
  RpcProbe,
  PublicKey,
  ReceiptView,
  SendOptions,
  ShardId,
  ShardLayout,
  SignedTransaction,
  TransactionRequest,
  TxOutcome,
  UnsignedTransaction,
  ViewCallResult,
  Yocto,
} from "./types";
import { parseNear, tgas } from "./units";
import {
  counterContract,
  COUNTER_WASM_SHA256,
  demoContractCode,
  DemoPromise,
  registrarContract,
  type DemoContract,
  type DemoContractContext,
  type PromiseResult,
} from "./demo/contracts";
import { mpcSignerContract } from "./demo/mpcSigner";
import { buyerContract, DEMO_BUYER, DEMO_SHOP, shopContract } from "./demo/shop";
import { SIGNER_CONTRACT } from "./chainSigMath";
import {
  attachedGas,
  deposits,
  execGas,
  GAS_BUY_PRICE,
  GAS_PRICE,
  sendGas,
  STORAGE_PRICE_PER_BYTE,
} from "./demo/fees";

export { demoContractCode, DemoPromise, type DemoContract, type DemoContractContext } from "./demo/contracts";

// ---------- Constants ----------

/** ~600 ms per block (NEAR docs, blocks and finality). */
export const BLOCK_MS = 600;
/** Time for the RPC node to accept the transaction. Unverified assumption from docs/lessons/stage-0/0.3.md. */
export const BROADCAST_MS = 250;
/** Blocks after the last receipt until the block is final (~1.2 s at 600 ms). */
export const FINALITY_BLOCKS = 2;
/** Demo chain starts here, so the first transaction lands in #200000001 (0.3 demo data). */
export const GENESIS_HEIGHT = 200_000_000;
const GENESIS_TIME_MS = Date.UTC(2026, 10, 1);
/** A transaction's block hash must be at most this many blocks old (NEAR: 86400). */
const TX_VALIDITY_BLOCKS = 86_400;
const CHUNK_GAS_LIMIT = tgas(1000);
const NO_CODE = "11111111111111111111111111111111";

/** Demo practice account key from docs/lessons/stage-0/0.3.md (same fixed key as lesson 0.2). */
export const DEMO_PRACTICE_PUBLIC_KEY = "ed25519:Ex4stLtTe43ynFmxGweGzMWLvRmRSUP6EjU6nvAdY2vg";
/** The app's return account in demo mode. Placeholder until #7 picks the real one. */
export const DEMO_RETURN_ACCOUNT = "book-of-near.testnet";

/**
 * Six shards. ILLUSTRATIVE boundaries, modelled on a past mainnet layout; the real testnet layout
 * comes from RPC (`EXPERIMENTAL_protocol_config`) and is verified by #4.
 */
export const DEMO_SHARD_LAYOUT: ShardLayout = {
  shardIds: [0, 1, 2, 3, 4, 5],
  boundaryAccounts: ["aurora", "aurora-0", "game.hot.tg", "kkuuue2akv_1630967379.near", "tge-lockup.sweat"],
};

// ---------- Options ----------

export interface DemoGenesisAccount {
  accountId: AccountId;
  balance: Yocto;
  /** Code to deploy at genesis (built-in or registered in `contracts`). */
  code?: Uint8Array;
}

export interface DemoChainOptions {
  /** Default "book-of-near". Changes every hash. */
  seed?: string;
  /** Default pace for sends; override per call with SendOptions.pace. Default "realtime". */
  pace?: "realtime" | "instant";
  /** Multiplies realtime delays (2 = a busy network). Default 1. */
  slowdown?: number;
  /** Practice account balance at start. Default 5 NEAR (the faucet amount in NEAR docs). */
  practiceBalance?: Yocto;
  practicePublicKey?: PublicKey;
  /** Extra accounts at genesis. */
  accounts?: DemoGenesisAccount[];
  /** Extra simulated contracts, installed when their code is deployed. */
  contracts?: { code: Uint8Array; contract: DemoContract }[];
  /** Override the timer (tests). */
  sleep?: (ms: number) => Promise<void>;
}

// ---------- Internal state ----------

interface KeyState {
  nonce: bigint;
  permission: AccessKeyPermission;
}

interface AccountState {
  amount: Yocto;
  locked: Yocto;
  codeHash: CryptoHash;
  codeSize: number;
  contract?: DemoContract;
  keys: Map<PublicKey, KeyState>;
  state: Map<string, string>;
}

interface BlockRecord {
  height: number;
  hash: CryptoHash;
  chunks: Map<ShardId, { transactions: CryptoHash[]; receipts: CryptoHash[]; gasUsed: Gas }>;
}

interface PendingReceipt {
  id: CryptoHash;
  predecessorId: AccountId;
  receiverId: AccountId;
  actions: Action[];
  height: number;
  isRefund: boolean;
  /** Wait for this receipt's final result, then run with it as promiseResult. */
  waitFor?: CryptoHash;
  promiseResult?: PromiseResult;
  order: number;
}

class ActionFailure extends Error {
  constructor(
    readonly index: number,
    readonly kind: ActionErrorKind,
    message: string,
    readonly gasUsed: Gas = 0n,
  ) {
    super(message);
  }
}

const enc = new TextEncoder();

function serialize(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    typeof v === "bigint" ? `${v}` : v instanceof Uint8Array ? base64.encode(v) : v,
  );
}

function cloneAccount(a: AccountState): AccountState {
  return {
    ...a,
    keys: new Map([...a.keys].map(([k, v]) => [k, { nonce: v.nonce, permission: { ...v.permission } }])),
    state: new Map(a.state),
  };
}

function cloneActions(list: Action[]): Action[] {
  return list.map((a) => (a.type === "FunctionCall" ? { ...a, args: structuredClone(a.args) } : { ...a }));
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------- DemoChain ----------

export class DemoChain implements Chain {
  readonly network = "demo" as const;
  private readonly seed: string;
  private readonly pace: "realtime" | "instant";
  private readonly slowdown: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly accounts = new Map<AccountId, AccountState>();
  private readonly contracts = new Map<CryptoHash, DemoContract>();
  private readonly blocks = new Map<number, BlockRecord>();
  private readonly blockByHash = new Map<CryptoHash, number>();
  private readonly txs = new Map<CryptoHash, TxOutcome>();
  /** Public keys whose secret this chain holds (the key store). */
  private readonly keyStore = new Set<PublicKey>();
  private readonly practice: PracticeAccount;
  private head = GENESIS_HEIGHT;
  private keyCounter = 0;

  constructor(options: DemoChainOptions = {}) {
    this.seed = options.seed ?? "book-of-near";
    this.pace = options.pace ?? "realtime";
    this.slowdown = options.slowdown ?? 1;
    this.sleep = options.sleep ?? realSleep;
    this.install(demoContractCode("counter"), counterContract);
    // The real counter.wasm runs as the same simulated counter (lesson 3.1 deploys the real bytes).
    this.contracts.set(COUNTER_WASM_SHA256, counterContract);
    this.install(demoContractCode("registrar"), registrarContract);
    this.install(demoContractCode("mpc-signer"), mpcSignerContract);
    this.install(demoContractCode("shop"), shopContract);
    this.install(demoContractCode("buyer"), buyerContract);
    for (const c of options.contracts ?? []) this.install(c.code, c.contract);

    const publicKey = options.practicePublicKey ?? DEMO_PRACTICE_PUBLIC_KEY;
    this.practice = { accountId: bytesToHex(base58.decode(publicKey.slice(8))), publicKey };
    this.keyStore.add(publicKey);
    this.genesisAccount(this.practice.accountId, options.practiceBalance ?? parseNear("5"), publicKey);
    this.genesisAccount("testnet", parseNear("1000000"), undefined, demoContractCode("registrar"));
    this.genesisAccount(DEMO_RETURN_ACCOUNT, parseNear("100"));
    // The chain-signature signer (lesson 4.1), a demo stand-in for v1.signer-prod.testnet.
    this.genesisAccount(SIGNER_CONTRACT, parseNear("100"), undefined, demoContractCode("mpc-signer"));
    // Lesson 2.2's cross-contract call: a buyer contract and a shop, on different demo shards.
    this.genesisAccount(DEMO_BUYER, parseNear("10"), undefined, demoContractCode("buyer"));
    this.genesisAccount(DEMO_SHOP, parseNear("10"), undefined, demoContractCode("shop"));
    for (const a of options.accounts ?? []) this.genesisAccount(a.accountId, a.balance, undefined, a.code);
    this.makeBlock(GENESIS_HEIGHT);
  }

  // ---------- Reads ----------

  async returnAccount(): Promise<AccountId> {
    return DEMO_RETURN_ACCOUNT;
  }

  async practiceAccount(): Promise<PracticeAccount> {
    return { ...this.practice };
  }

  async viewAccount(accountId: AccountId): Promise<AccountView> {
    const a = this.accounts.get(accountId);
    if (!a) throw new ChainError("AccountDoesNotExist", `Account ${accountId} does not exist.`);
    return {
      accountId,
      amount: a.amount,
      locked: a.locked,
      codeHash: a.codeHash,
      storageUsage: this.storageUsage(a),
      blockHeight: this.head,
      blockHash: this.blockHash(this.head),
    };
  }

  async accountExists(accountId: AccountId): Promise<boolean> {
    return this.accounts.has(accountId);
  }

  async listKeys(accountId: AccountId): Promise<AccessKeyInfo[]> {
    const a = this.accounts.get(accountId);
    if (!a) throw new ChainError("AccountDoesNotExist", `Account ${accountId} does not exist.`);
    return [...a.keys].map(([publicKey, k]) => ({
      publicKey,
      nonce: k.nonce,
      permission: { ...k.permission },
    }));
  }

  async viewCall<T = unknown>(
    contractId: AccountId,
    methodName: string,
    args: Record<string, unknown> = {},
  ): Promise<ViewCallResult<T>> {
    const a = this.accounts.get(contractId);
    if (!a) throw new ChainError("AccountDoesNotExist", `Account ${contractId} does not exist.`);
    const method = a.contract?.[methodName];
    if (!a.contract) throw new ChainError("ViewFailed", `${contractId} has no contract deployed.`);
    if (!method) throw new ChainError("ViewFailed", `${contractId} has no method ${methodName}.`);
    const logs: string[] = [];
    const ctx: DemoContractContext = {
      contractId,
      predecessorId: contractId,
      signerId: contractId,
      deposit: 0n,
      args: structuredClone(args),
      blockHeight: this.head,
      get: (k) => a.state.get(k),
      set: () => {
        throw new Error("ProhibitedInView: a view call cannot change state");
      },
      remove: () => {
        throw new Error("ProhibitedInView: a view call cannot change state");
      },
      log: (m) => logs.push(m),
      functionCall: () => {
        throw new Error("ProhibitedInView: a view call cannot call other contracts");
      },
      batch: () => {
        throw new Error("ProhibitedInView: a view call cannot call other contracts");
      },
    };
    try {
      const result = method.run(ctx) as T;
      return { result, logs, blockHeight: this.head, blockHash: this.blockHash(this.head) };
    } catch (e) {
      throw new ChainError("ViewFailed", `Smart contract panicked: ${(e as Error).message}`);
    }
  }

  async newKeyPair(): Promise<PublicKey> {
    const bytes = this.digest(`key|${this.keyCounter++}`);
    const pk = `ed25519:${base58.encode(bytes)}`;
    this.keyStore.add(pk);
    return pk;
  }

  /**
   * Demo twin of a single RPC request: answers after the round trip recorded for that endpoint
   * (RECORDED_LATENCY_MS). The demo history starts at its own genesis, so every demo block is recent;
   * below it, only the archival node knows the one recorded testnet block (HISTORICAL_BLOCK).
   */
  async probeRpc(endpointId: string, ref: BlockRef = "final", options: ProbeOptions = {}): Promise<RpcProbe> {
    const endpoint = RPC_ENDPOINTS.find((e) => e.id === endpointId);
    if (!endpoint) throw new Error(`Unknown RPC endpoint ${endpointId}`);
    const latencyMs = RECORDED_LATENCY_MS[endpoint.id];
    if ((options.pace ?? this.pace) === "realtime") await this.sleep(latencyMs * this.slowdown);
    const height = typeof ref === "object" && "height" in ref ? ref.height : null;
    if (height !== null && height < GENESIS_HEIGHT) {
      if (endpoint.archival && height === HISTORICAL_BLOCK.height)
        return {
          ok: true,
          endpointId,
          latencyMs,
          blockHeight: height,
          blockTimestampMs: HISTORICAL_BLOCK.timestampMs,
        };
      return {
        ok: false,
        endpointId,
        latencyMs,
        error: "UnknownBlock",
        status: 422,
        message: `Block #${height.toLocaleString("en-US")} is not kept on this node.`,
      };
    }
    try {
      const b = await this.block(ref);
      return { ok: true, endpointId, latencyMs, blockHeight: b.height, blockTimestampMs: b.timestampMs };
    } catch {
      return {
        ok: false,
        endpointId,
        latencyMs,
        error: "UnknownBlock",
        status: 422,
        message: "That block is not known.",
      };
    }
  }

  async block(ref: BlockRef = "final"): Promise<BlockView> {
    const height = this.resolveBlock(ref);
    return {
      height,
      hash: this.blockHash(height),
      prevHash: this.blockHash(height - 1),
      timestampMs: GENESIS_TIME_MS + (height - GENESIS_HEIGHT) * BLOCK_MS,
      author: `demo-validator-${height % 4}.pool.testnet`,
      chunks: DEMO_SHARD_LAYOUT.shardIds.map((s) => this.chunkHeader(height, s)),
    };
  }

  async chunk(ref: BlockRef, shardId: ShardId): Promise<ChunkView> {
    const height = this.resolveBlock(ref);
    if (!DEMO_SHARD_LAYOUT.shardIds.includes(shardId))
      throw new ChainError("UnknownChunk", `There is no shard ${shardId}.`);
    const c = this.blocks.get(height)?.chunks.get(shardId);
    return {
      header: this.chunkHeader(height, shardId),
      blockHash: this.blockHash(height),
      blockHeight: height,
      transactions: [...(c?.transactions ?? [])],
      receipts: [...(c?.receipts ?? [])],
    };
  }

  async shardLayout(): Promise<ShardLayout> {
    return structuredClone(DEMO_SHARD_LAYOUT);
  }

  async getTransaction(hash: CryptoHash, senderId: AccountId): Promise<TxOutcome> {
    const tx = this.txs.get(hash);
    if (!tx || tx.transaction.signerId !== senderId)
      throw new ChainError("UnknownTransaction", `Transaction ${hash} was not found.`);
    return structuredClone(tx);
  }

  // ---------- Writes ----------

  async buildTransaction(request: TransactionRequest): Promise<UnsignedTransaction> {
    const signerId = request.signerId ?? this.practice.accountId;
    const signer = this.accounts.get(signerId);
    const publicKey =
      request.publicKey ??
      [...(signer?.keys ?? [])].find(
        ([pk, k]) => k.permission.type === "FullAccess" && this.keyStore.has(pk),
      )?.[0];
    if (!publicKey)
      throw new ChainError(
        "InvalidTransaction",
        `No key of ${signerId} is in the key store.`,
        "AccessKeyNotFound",
      );
    const key = signer?.keys.get(publicKey);
    return {
      signerId,
      publicKey,
      nonce: (key?.nonce ?? 0n) + 1n,
      receiverId: request.receiverId,
      blockHash: this.blockHash(this.head),
      actions: cloneActions(request.actions),
    };
  }

  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    if (!this.keyStore.has(tx.publicKey))
      throw new ChainError("InvalidTransaction", "This app does not hold that key.", "InvalidSignature");
    const hash = this.txHash(tx);
    return { ...tx, actions: cloneActions(tx.actions), hash, signature: this.signatureFor(hash) };
  }

  async sendTransaction(request: TransactionRequest, options: SendOptions = {}): Promise<TxOutcome> {
    const unsigned = await this.buildTransaction(request);
    options.onPhase?.({ phase: "built", atMs: 0, status: "NONE" });
    const signed = await this.signTransaction(unsigned);
    options.onPhase?.({ phase: "signed", atMs: 0, txHash: signed.hash, status: "NONE" });
    return this.sendSignedTransaction(signed, options, true);
  }

  async sendSignedTransaction(
    tx: SignedTransaction,
    options: SendOptions = {},
    alreadyReported = false,
  ): Promise<TxOutcome> {
    const outcome = this.execute(tx);
    const events = this.phaseEvents(outcome).filter(
      (e) => !alreadyReported || (e.phase !== "built" && e.phase !== "signed"),
    );
    const realtime = (options.pace ?? this.pace) === "realtime";
    let clock = alreadyReported ? outcome.timings.signed : 0;
    for (const e of events) {
      if (realtime && e.atMs > clock) await this.sleep((e.atMs - clock) * this.slowdown);
      clock = e.atMs;
      options.onPhase?.(e);
    }
    return structuredClone(outcome);
  }

  // ---------- Execution ----------

  /** Validate, then run the whole transaction synchronously. Throws ChainError for invalid transactions. */
  private execute(tx: SignedTransaction): TxOutcome {
    const reject = (reason: InvalidTxReason, message: string): never => {
      throw new ChainError("InvalidTransaction", message, reason);
    };
    if (!isValidAccountId(tx.signerId))
      reject("InvalidSignerId", `"${tx.signerId}" is not a valid account id.`);
    if (!isValidAccountId(tx.receiverId))
      reject("InvalidReceiverId", `"${tx.receiverId}" is not a valid account id.`);
    if (this.txHash(tx) !== tx.hash || tx.signature !== this.signatureFor(tx.hash))
      reject(
        "InvalidSignature",
        "The signature does not match the transaction. Was it changed after signing?",
      );
    const signer = this.accounts.get(tx.signerId);
    if (!signer) return reject("SignerDoesNotExist", `The sender ${tx.signerId} does not exist.`);
    const key = signer.keys.get(tx.publicKey);
    if (!key) return reject("AccessKeyNotFound", `${tx.signerId} has no key ${tx.publicKey}.`);
    if (tx.nonce <= key.nonce)
      reject("InvalidNonce", `Nonce ${tx.nonce} is already used. The key's last nonce is ${key.nonce}.`);
    const refHeight = this.blockByHash.get(tx.blockHash);
    if (refHeight === undefined || this.head - refHeight > TX_VALIDITY_BLOCKS)
      reject("Expired", "The transaction's block hash is unknown or too old.");

    const gasHeld = sendGas(tx.actions) + execGas(tx.actions) + attachedGas(tx.actions);
    const gasCost = gasHeld * GAS_BUY_PRICE;
    const cost = gasCost + deposits(tx.actions);

    const perm = key.permission;
    if (perm.type === "FunctionCall") {
      if (!tx.actions.every((a) => a.type === "FunctionCall"))
        reject(
          "RequiresFullAccess",
          "This key may only call contract methods. It cannot send NEAR or change keys.",
        );
      if (tx.receiverId !== perm.receiverId)
        reject("ReceiverMismatch", `This key may only call ${perm.receiverId}, not ${tx.receiverId}.`);
      for (const a of tx.actions) {
        if (a.type !== "FunctionCall") continue;
        if (a.deposit > 0n) reject("DepositWithFunctionCall", "This key cannot attach NEAR to a call.");
        if (perm.methodNames.length && !perm.methodNames.includes(a.methodName))
          reject("MethodNameMismatch", `This key may not call ${a.methodName}.`);
      }
      if (perm.allowance !== undefined && perm.allowance < gasCost)
        reject("NotEnoughAllowance", "This key's allowance is too small to pay for the gas.");
    }
    if (signer.amount < cost)
      reject("NotEnoughBalance", `${tx.signerId} does not have enough NEAR for this.`);
    if (signer.amount - cost < BigInt(this.storageUsage(signer)) * STORAGE_PRICE_PER_BYTE)
      reject("LackBalanceForState", `${tx.signerId} must keep enough NEAR to pay for its storage.`);

    // ---- Valid: convert the transaction into a receipt in the next block. ----
    const start = this.head;
    const inclusion = start + 1;
    signer.amount -= cost;
    key.nonce = tx.nonce;
    if (perm.type === "FunctionCall" && perm.allowance !== undefined) perm.allowance -= gasCost;

    const convGas = sendGas(tx.actions);
    let burnt = convGas;
    const firstReceipt = this.receiptId(tx.hash, 0);
    this.chunkAt(inclusion, this.shardOf(tx.signerId)).transactions.push(tx.hash);
    const transactionOutcome: ExecutionOutcome = {
      id: tx.hash,
      executorId: tx.signerId,
      blockHash: this.blockHash(inclusion),
      blockHeight: inclusion,
      shardId: this.shardOf(tx.signerId),
      gasBurnt: convGas,
      tokensBurnt: convGas * GAS_PRICE,
      logs: [],
      receiptIds: [firstReceipt],
      status: { type: "SuccessReceiptId", receiptId: firstReceipt },
    };

    let order = 0;
    const pending: PendingReceipt[] = [
      {
        id: firstReceipt,
        predecessorId: tx.signerId,
        receiverId: tx.receiverId,
        actions: cloneActions(tx.actions),
        // A receipt to yourself runs in the same block; to another account, in the next one.
        height: tx.receiverId === tx.signerId ? inclusion : inclusion + 1,
        isRefund: false,
        order: order++,
      },
    ];
    const results = new Map<CryptoHash, ExecutionStatus>();
    const receipts: ReceiptView[] = [];
    let lastWork = inclusion;
    let refundsPending = true;

    while (pending.length) {
      const ready = pending.filter((p) => !p.waitFor);
      ready.sort((x, y) => x.height - y.height || x.order - y.order);
      const r = ready[0];
      if (!r) throw new Error("DemoChain: receipt dependency cycle");
      pending.splice(pending.indexOf(r), 1);

      const view = this.applyReceipt(r, tx, (child) => {
        pending.push({ ...child, order: order++ });
      });
      burnt += view.gasBurnt;
      receipts.push(view);
      results.set(r.id, view.status);
      if (!r.isRefund) lastWork = Math.max(lastWork, r.height);

      // Wake callbacks waiting on this receipt.
      for (const p of pending) {
        if (p.waitFor !== r.id) continue;
        if (view.status.type === "SuccessReceiptId") p.waitFor = view.status.receiptId;
        else {
          p.waitFor = undefined;
          p.height = Math.max(p.height, r.height + 1);
          p.promiseResult =
            view.status.type === "SuccessValue"
              ? { ok: true, value: decodeValue(view.status.value) }
              : { ok: false, message: view.status.error.message };
        }
      }

      // Once all work is done, refund unused gas to the signer in the next block.
      if (!pending.length && refundsPending) {
        refundsPending = false;
        const refund = gasHeld * GAS_BUY_PRICE - burnt * GAS_PRICE;
        if (refund > 0n)
          pending.push({
            id: this.receiptId(tx.hash, 1000 + order),
            predecessorId: "system",
            receiverId: tx.signerId,
            actions: [{ type: "Transfer", deposit: refund }],
            height: Math.max(...receipts.map((x) => x.blockHeight)) + 1,
            isRefund: true,
            order: order++,
          });
      }
    }

    const lastHeight = Math.max(inclusion, ...receipts.map((x) => x.blockHeight));
    const finalHeight = lastHeight + FINALITY_BLOCKS;
    for (let h = this.head + 1; h <= finalHeight; h++) this.makeBlock(h);
    this.head = finalHeight;

    const at = (h: number) => BROADCAST_MS + (h - start) * BLOCK_MS;
    const timings: PhaseTimings = {
      built: 0,
      signed: 0,
      broadcast: BROADCAST_MS,
      included: at(inclusion),
      executed: at(lastWork),
      final: at(finalHeight),
    };
    const outcome: TxOutcome = {
      status: finalStatus(transactionOutcome.status, results),
      finalExecutionStatus: "FINAL",
      transaction: { ...tx, actions: cloneActions(tx.actions) },
      transactionOutcome,
      receipts,
      timings,
      gasPrice: GAS_PRICE,
    };
    this.txs.set(tx.hash, outcome);
    return outcome;
  }

  /** Run one receipt. All its actions succeed together or are rolled back together. */
  private applyReceipt(
    r: PendingReceipt,
    tx: SignedTransaction,
    schedule: (child: Omit<PendingReceipt, "order">) => void,
  ): ReceiptView {
    const shardId = this.shardOf(r.receiverId);
    const chunk = this.chunkAt(r.height, shardId);
    chunk.receipts.push(r.id);
    const base = {
      id: r.id,
      executorId: r.receiverId,
      predecessorId: r.predecessorId,
      receiverId: r.receiverId,
      actions: cloneActions(r.actions),
      blockHash: this.blockHash(r.height),
      blockHeight: r.height,
      shardId,
      isRefund: r.isRefund,
    };

    if (r.isRefund) {
      const to = this.accounts.get(r.receiverId);
      if (to) to.amount += deposits(r.actions);
      return {
        ...base,
        gasBurnt: 0n,
        tokensBurnt: 0n,
        logs: [],
        receiptIds: [],
        status: { type: "SuccessValue", value: "" },
      };
    }

    const before = this.accounts.get(r.receiverId);
    const snapshot = before ? cloneAccount(before) : undefined;
    const logs: string[] = [];
    const children: Omit<PendingReceipt, "order">[] = [];
    let gas = execGas(r.actions);
    let status: ExecutionStatus = { type: "SuccessValue", value: "" };
    let createdHere = false;

    try {
      r.actions.forEach((action, index) => {
        const fail = (kind: ActionErrorKind, message: string, used: Gas = 0n): never => {
          throw new ActionFailure(index, kind, message, used);
        };
        let acct = this.accounts.get(r.receiverId);
        const needAccount = (): AccountState =>
          acct ??
          fail(
            { type: "AccountDoesNotExist", accountId: r.receiverId },
            `Account ${r.receiverId} does not exist.`,
          );
        const needOwner = () => {
          if (r.predecessorId !== r.receiverId && !createdHere)
            fail(
              { type: "ActorNoPermission", accountId: r.receiverId, actorId: r.predecessorId },
              `${r.predecessorId} may not change ${r.receiverId}.`,
            );
        };

        switch (action.type) {
          case "CreateAccount": {
            if (acct)
              fail(
                { type: "AccountAlreadyExists", accountId: r.receiverId },
                `${r.receiverId} already exists.`,
              );
            if (!isDirectSubAccount(r.receiverId, r.predecessorId))
              fail(
                { type: "CreateAccountNotAllowed", accountId: r.receiverId, predecessorId: r.predecessorId },
                `Only ${r.receiverId.slice(r.receiverId.indexOf(".") + 1)} can create ${r.receiverId}.`,
              );
            this.accounts.set(r.receiverId, emptyAccount());
            createdHere = true;
            break;
          }
          case "Transfer": {
            if (!acct && isImplicitAccountId(r.receiverId)) {
              // Sending NEAR to a 64-hex id creates that implicit account, owned by the matching key.
              acct = emptyAccount();
              acct.keys.set(`ed25519:${base58.encode(hexToBytes(r.receiverId))}`, {
                nonce: BigInt(r.height) * 1_000_000n,
                permission: { type: "FullAccess" },
              });
              this.accounts.set(r.receiverId, acct);
            }
            needAccount().amount += action.deposit;
            break;
          }
          case "AddKey": {
            const a = needAccount();
            needOwner();
            if (a.keys.has(action.publicKey))
              fail(
                { type: "AddKeyAlreadyExists", accountId: r.receiverId, publicKey: action.publicKey },
                "That key is already on the account.",
              );
            // New keys start at nonce = block height × 10^6 (NEAR docs, transaction anatomy).
            a.keys.set(action.publicKey, {
              nonce: BigInt(r.height) * 1_000_000n,
              permission: { ...action.permission },
            });
            break;
          }
          case "DeleteKey": {
            const a = needAccount();
            needOwner();
            if (!a.keys.delete(action.publicKey))
              fail(
                { type: "DeleteKeyDoesNotExist", accountId: r.receiverId, publicKey: action.publicKey },
                "That key is not on the account, so it cannot be deleted.",
              );
            break;
          }
          case "DeployContract": {
            const a = needAccount();
            needOwner();
            const hash = base58.encode(sha256(action.code));
            a.codeHash = hash;
            a.codeSize = action.code.length;
            a.contract = this.contracts.get(hash);
            break;
          }
          case "DeleteAccount": {
            const a = needAccount();
            needOwner();
            this.accounts.delete(r.receiverId);
            if (a.amount > 0n)
              children.push({
                id: this.receiptId(r.id, children.length),
                predecessorId: r.receiverId,
                receiverId: action.beneficiaryId,
                actions: [{ type: "Transfer", deposit: a.amount }],
                height: r.height + 1,
                isRefund: false,
              });
            break;
          }
          case "FunctionCall": {
            const a = needAccount();
            a.amount += action.deposit;
            const method = a.contract?.[action.methodName];
            const callFail = (message: string, used: Gas): never =>
              fail({ type: "FunctionCallError", message }, message, used);
            if (!a.contract) callFail("CompilationError: there is no contract on this account.", 0n);
            if (!method) callFail(`MethodResolveError: there is no method ${action.methodName}.`, 0n);
            let used = method!.gas ?? tgas(2);
            if (used > action.gas) callFail("Exceeded the prepaid gas.", action.gas);
            const ctx: DemoContractContext = {
              contractId: r.receiverId,
              predecessorId: r.predecessorId,
              signerId: tx.signerId,
              deposit: action.deposit,
              args: structuredClone(action.args),
              blockHeight: r.height,
              promiseResult: r.promiseResult,
              get: (k) => a.state.get(k),
              set: (k, v) => void a.state.set(k, v),
              remove: (k) => void a.state.delete(k),
              log: (m) => logs.push(m),
              functionCall: (receiverId, methodName, args = {}, o = {}) =>
                new DemoPromise(
                  receiverId,
                  [
                    {
                      type: "FunctionCall",
                      methodName,
                      args,
                      gas: o.gas ?? tgas(10),
                      deposit: o.deposit ?? 0n,
                    },
                  ],
                  o.then
                    ? { methodName: o.then.methodName, args: o.then.args ?? {}, gas: o.then.gas ?? tgas(10) }
                    : undefined,
                  o.delay ?? 0,
                ),
              batch: (receiverId, list) => new DemoPromise(receiverId, cloneActions(list)),
            };
            let value: unknown;
            try {
              value = method!.run(ctx);
            } catch (e) {
              callFail(`Smart contract panicked: ${(e as Error).message}`, used);
            }
            if (value instanceof DemoPromise) {
              // Creating receipts costs send gas now, and their exec + attached gas is reserved.
              const call = value.actions;
              used += sendGas(call) + execGas(call) + attachedGas(call);
              const thenActions: Action[] = value.then
                ? [
                    {
                      type: "FunctionCall",
                      methodName: value.then.methodName,
                      args: value.then.args,
                      gas: value.then.gas,
                      deposit: 0n,
                    },
                  ]
                : [];
              if (value.then) used += sendGas(thenActions) + execGas(thenActions) + attachedGas(thenActions);
              if (used > action.gas) callFail("Exceeded the prepaid gas.", action.gas);
              // NEAR attached to the new receipt leaves the contract now.
              const sent = deposits(call);
              if (a.amount < sent) callFail("The contract does not have enough NEAR to attach.", used);
              a.amount -= sent;
              const callId = this.receiptId(r.id, children.length);
              children.push({
                id: callId,
                predecessorId: r.receiverId,
                receiverId: value.receiverId,
                actions: cloneActions(call),
                height: r.height + 1 + value.delay,
                isRefund: false,
              });
              let tail = callId;
              if (value.then) {
                tail = this.receiptId(r.id, children.length);
                children.push({
                  id: tail,
                  predecessorId: r.receiverId,
                  receiverId: r.receiverId,
                  actions: thenActions,
                  height: r.height + 2 + value.delay,
                  isRefund: false,
                  waitFor: callId,
                });
              }
              status = { type: "SuccessReceiptId", receiptId: tail };
              // Only send fees are burnt here; the reserved gas is burnt by the children.
              gas +=
                used -
                attachedGas(call) -
                execGas(call) -
                (value.then ? execGas(thenActions) + attachedGas(thenActions) : 0n);
            } else {
              status = { type: "SuccessValue", value: encodeSuccessValue(value) };
              gas += used;
            }
            break;
          }
        }
      });

      const after = this.accounts.get(r.receiverId);
      if (after && after.amount < BigInt(this.storageUsage(after)) * STORAGE_PRICE_PER_BYTE) {
        const need = BigInt(this.storageUsage(after)) * STORAGE_PRICE_PER_BYTE;
        throw new ActionFailure(
          r.actions.length - 1,
          { type: "LackBalanceForState", accountId: r.receiverId, amount: need },
          `${r.receiverId} needs at least ${need} yoctoNEAR to pay for its storage.`,
        );
      }
    } catch (e) {
      if (!(e instanceof ActionFailure)) throw e;
      // Roll back everything this receipt did.
      if (snapshot) this.accounts.set(r.receiverId, snapshot);
      else this.accounts.delete(r.receiverId);
      children.length = 0;
      gas += e.gasUsed;
      status = {
        type: "Failure",
        error: { type: "ActionError", index: e.index, kind: e.kind, message: e.message },
      };
      const back = deposits(r.actions);
      if (back > 0n && r.predecessorId !== "system")
        children.push({
          id: this.receiptId(r.id, 99),
          predecessorId: "system",
          receiverId: r.predecessorId,
          actions: [{ type: "Transfer", deposit: back }],
          height: r.height + 1,
          isRefund: true,
        });
    }

    for (const c of children) schedule(c);
    chunk.gasUsed += gas;
    return {
      ...base,
      gasBurnt: gas,
      tokensBurnt: gas * GAS_PRICE,
      logs,
      receiptIds: children.map((c) => c.id),
      status,
    };
  }

  private phaseEvents(o: TxOutcome): PhaseEvent[] {
    const t = o.timings;
    const hash = o.transaction.hash;
    const inc = o.transactionOutcome;
    const lastWork = o.receipts.filter((r) => !r.isRefund).at(-1) ?? o.receipts.at(-1);
    const finalHeight = inc.blockHeight + Math.round((t.final - t.included) / BLOCK_MS);
    return [
      { phase: "built", atMs: t.built, txHash: hash, status: "NONE" },
      { phase: "signed", atMs: t.signed, txHash: hash, status: "NONE" },
      { phase: "broadcast", atMs: t.broadcast, txHash: hash, status: "NONE" },
      {
        phase: "included",
        atMs: t.included,
        txHash: hash,
        status: "INCLUDED",
        blockHeight: inc.blockHeight,
        blockHash: inc.blockHash,
      },
      {
        phase: "executed",
        atMs: t.executed,
        txHash: hash,
        status: "EXECUTED_OPTIMISTIC",
        blockHeight: lastWork?.blockHeight,
        blockHash: lastWork?.blockHash,
      },
      {
        phase: "final",
        atMs: t.final,
        txHash: hash,
        status: "FINAL",
        blockHeight: finalHeight,
        blockHash: this.blockHash(finalHeight),
      },
    ];
  }

  // ---------- Helpers ----------

  private install(code: Uint8Array, contract: DemoContract) {
    this.contracts.set(base58.encode(sha256(code)), contract);
  }

  private genesisAccount(accountId: AccountId, balance: Yocto, publicKey?: PublicKey, code?: Uint8Array) {
    const a = emptyAccount();
    a.amount = balance;
    if (publicKey)
      a.keys.set(publicKey, {
        nonce: BigInt(GENESIS_HEIGHT) * 1_000_000n,
        permission: { type: "FullAccess" },
      });
    if (code) {
      a.codeHash = base58.encode(sha256(code));
      a.codeSize = code.length;
      a.contract = this.contracts.get(a.codeHash);
    }
    this.accounts.set(accountId, a);
  }

  private storageUsage(a: AccountState): number {
    let n = 100 + a.codeSize;
    for (const [pk, k] of a.keys) {
      n += pk.length + 40;
      if (k.permission.type === "FunctionCall")
        n += k.permission.receiverId.length + k.permission.methodNames.join("").length;
    }
    for (const [k, v] of a.state) n += k.length + v.length + 40;
    return n;
  }

  private shardOf(accountId: AccountId): ShardId {
    return shardForAccount(DEMO_SHARD_LAYOUT, accountId);
  }

  private digest(label: string): Uint8Array {
    return sha256(enc.encode(`${this.seed}|${label}`));
  }

  private blockHash(height: number): CryptoHash {
    return base58.encode(this.digest(`block|${height}`));
  }

  private makeBlock(height: number): BlockRecord {
    let b = this.blocks.get(height);
    if (!b) {
      b = { height, hash: this.blockHash(height), chunks: new Map() };
      this.blocks.set(height, b);
      this.blockByHash.set(b.hash, height);
    }
    return b;
  }

  private chunkAt(height: number, shardId: ShardId) {
    const b = this.makeBlock(height);
    let c = b.chunks.get(shardId);
    if (!c) {
      c = { transactions: [], receipts: [], gasUsed: 0n };
      b.chunks.set(shardId, c);
    }
    return c;
  }

  private chunkHeader(height: number, shardId: ShardId): ChunkHeaderView {
    return {
      chunkHash: base58.encode(this.digest(`chunk|${height}|${shardId}`)),
      shardId,
      heightCreated: height,
      heightIncluded: height,
      gasUsed: this.blocks.get(height)?.chunks.get(shardId)?.gasUsed ?? 0n,
      gasLimit: CHUNK_GAS_LIMIT,
    };
  }

  private resolveBlock(ref: BlockRef): number {
    if (ref === "final" || ref === "optimistic") return this.head;
    const h = "height" in ref ? ref.height : this.blockByHash.get(ref.hash);
    if (h === undefined || h < GENESIS_HEIGHT || h > this.head)
      throw new ChainError("UnknownBlock", "That block is not known.");
    return h;
  }

  private txHash(tx: UnsignedTransaction): CryptoHash {
    const { signerId, publicKey, nonce, receiverId, blockHash, actions } = tx;
    return base58.encode(
      this.digest(`tx|${serialize({ signerId, publicKey, nonce, receiverId, blockHash, actions })}`),
    );
  }

  private signatureFor(hash: CryptoHash): string {
    const a = this.digest(`sig1|${hash}`);
    const b = this.digest(`sig2|${hash}`);
    const sig = new Uint8Array(64);
    sig.set(a);
    sig.set(b, 32);
    return `ed25519:${base58.encode(sig)}`;
  }

  private receiptId(parent: CryptoHash, index: number): CryptoHash {
    return base58.encode(this.digest(`receipt|${parent}|${index}`));
  }
}

function emptyAccount(): AccountState {
  return { amount: 0n, locked: 0n, codeHash: NO_CODE, codeSize: 0, keys: new Map(), state: new Map() };
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function decodeValue(b64: string): unknown {
  if (!b64) return undefined;
  return JSON.parse(new TextDecoder().decode(base64.decode(b64)));
}

/** Follow SuccessReceiptId links from the transaction to the receipt that produced the final result. */
function finalStatus(
  start: ExecutionStatus,
  results: Map<CryptoHash, ExecutionStatus>,
): FinalExecutionStatus {
  let s = start;
  for (let i = 0; s.type === "SuccessReceiptId" && i < 100; i++) {
    const next = results.get(s.receiptId);
    if (!next) break;
    s = next;
  }
  return s.type === "SuccessReceiptId" ? { type: "SuccessValue", value: "" } : s;
}
