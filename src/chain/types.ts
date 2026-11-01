/**
 * The Chain interface: the single seam for all chain access (see docs/chain.md).
 *
 * Types only. This file must never import a network library (near-kit, near-api-js, fetch
 * wrappers): `noNetworkImports.test.ts` enforces it. Shapes mirror NEAR RPC results
 * (https://docs.near.org/api/rpc/introduction) in camelCase, so TestnetChain can map RPC JSON
 * into them field by field. Amounts are bigint yoctoNEAR, gas is bigint gas units.
 */

/** Account id, e.g. `alice.testnet` or a 64-hex implicit id. Rules in accountId.ts. */
export type AccountId = string;
/** base58 32-byte hash, the format NEAR uses for tx hashes, receipt ids and block hashes. */
export type CryptoHash = string;
/** `ed25519:<base58>` public key. */
export type PublicKey = string;
/** yoctoNEAR (1 NEAR = 10^24). */
export type Yocto = bigint;
/** Gas units (1 Tgas = 10^12). */
export type Gas = bigint;
export type ShardId = number;
export type ChainNetwork = "demo" | "testnet";

// ---------- Keys ----------

export type AccessKeyPermission =
  | { type: "FullAccess" }
  | {
      type: "FunctionCall";
      /** The only contract this key may call. */
      receiverId: AccountId;
      /** Allowed methods; empty means any method of `receiverId`. */
      methodNames: string[];
      /** Gas fees this key may still spend, in yoctoNEAR. Undefined means no limit. */
      allowance?: Yocto;
    };

export interface AccessKeyInfo {
  publicKey: PublicKey;
  /** Last nonce used with this key. The next transaction must use a higher one. */
  nonce: bigint;
  permission: AccessKeyPermission;
}

// ---------- Actions (what a transaction or receipt does) ----------

export type Action =
  | { type: "CreateAccount" }
  | { type: "DeployContract"; code: Uint8Array }
  | {
      type: "FunctionCall";
      methodName: string;
      /** JSON arguments (most NEAR contracts take JSON). */
      args: Record<string, unknown>;
      gas: Gas;
      deposit: Yocto;
    }
  | { type: "Transfer"; deposit: Yocto }
  | { type: "AddKey"; publicKey: PublicKey; permission: AccessKeyPermission }
  | { type: "DeleteKey"; publicKey: PublicKey }
  | { type: "DeleteAccount"; beneficiaryId: AccountId };

// ---------- Transactions ----------

/** What the caller asks for. The chain fills in nonce and block hash when it builds. */
export interface TransactionRequest {
  /** Defaults to the practice account. */
  signerId?: AccountId;
  receiverId: AccountId;
  actions: Action[];
  /** Key to sign with; defaults to the signer's full-access key held by the chain. */
  publicKey?: PublicKey;
}

export interface UnsignedTransaction {
  signerId: AccountId;
  publicKey: PublicKey;
  /** Key nonce + 1. Each transaction from a key must use a higher nonce, which stops replays. */
  nonce: bigint;
  receiverId: AccountId;
  /** A recent block hash. The transaction expires once that block is too old. */
  blockHash: CryptoHash;
  actions: Action[];
}

export interface SignedTransaction extends UnsignedTransaction {
  /** sha256 of the serialized transaction, base58. This is the transaction id. */
  hash: CryptoHash;
  signature: string;
}

/** NEAR's RPC `wait_until` levels (https://docs.near.org/api/rpc/transactions). */
export type TxExecutionStatus =
  "NONE" | "INCLUDED" | "EXECUTED_OPTIMISTIC" | "INCLUDED_FINAL" | "EXECUTED" | "FINAL";

/** Lifecycle phases a lesson can light up, in order. */
export type TxPhase = "built" | "signed" | "broadcast" | "included" | "executed" | "final";

export interface PhaseEvent {
  phase: TxPhase;
  /** Milliseconds since the transaction was built. */
  atMs: number;
  txHash?: CryptoHash;
  /** The RPC status this phase corresponds to, when there is one. */
  status?: TxExecutionStatus;
  blockHeight?: number;
  blockHash?: CryptoHash;
}

/** Milliseconds since build, per phase. `executed` = last non-refund receipt applied. */
export type PhaseTimings = Record<TxPhase, number>;

export interface SendOptions {
  /** Called as each phase happens, in order. Use `phases()` from ops.ts for an async iterator. */
  onPhase?: (event: PhaseEvent) => void;
  /**
   * "realtime" waits the recorded timings between phases; "instant" fires them all at once
   * (tests, reduced motion). Ignored by TestnetChain, which follows the real network.
   */
  pace?: "realtime" | "instant";
}

// ---------- Outcomes ----------

export type ActionErrorKind =
  | { type: "AccountAlreadyExists"; accountId: AccountId }
  | { type: "AccountDoesNotExist"; accountId: AccountId }
  | { type: "CreateAccountNotAllowed"; accountId: AccountId; predecessorId: AccountId }
  | { type: "ActorNoPermission"; accountId: AccountId; actorId: AccountId }
  | { type: "AddKeyAlreadyExists"; accountId: AccountId; publicKey: PublicKey }
  | { type: "DeleteKeyDoesNotExist"; accountId: AccountId; publicKey: PublicKey }
  | { type: "LackBalanceForState"; accountId: AccountId; amount: Yocto }
  | { type: "NotEnoughBalance"; accountId: AccountId; balance: Yocto; cost: Yocto }
  | { type: "FunctionCallError"; message: string };

export type TxExecutionError =
  | { type: "ActionError"; index: number; kind: ActionErrorKind; message: string }
  | { type: "InvalidTxError"; reason: InvalidTxReason; message: string };

export type ExecutionStatus =
  /** base64 of the returned bytes (JSON for most contracts); "" when nothing is returned. */
  | { type: "SuccessValue"; value: string }
  | { type: "SuccessReceiptId"; receiptId: CryptoHash }
  | { type: "Failure"; error: TxExecutionError };

export type FinalExecutionStatus = Exclude<ExecutionStatus, { type: "SuccessReceiptId" }>;

/** One execution step: the transaction itself (converted to a receipt) or one receipt. */
export interface ExecutionOutcome {
  /** Transaction hash or receipt id. */
  id: CryptoHash;
  executorId: AccountId;
  blockHash: CryptoHash;
  blockHeight: number;
  shardId: ShardId;
  gasBurnt: Gas;
  /** gasBurnt × gas price. */
  tokensBurnt: Yocto;
  logs: string[];
  /** Receipts this step created. */
  receiptIds: CryptoHash[];
  status: ExecutionStatus;
}

/** A receipt plus its outcome (RPC `EXPERIMENTAL_tx_status` joins `receipts` and `receipts_outcome`). */
export interface ReceiptView extends ExecutionOutcome {
  predecessorId: AccountId;
  receiverId: AccountId;
  actions: Action[];
  /** Gas refunds come from "system". */
  isRefund: boolean;
}

export interface TxOutcome {
  status: FinalExecutionStatus;
  finalExecutionStatus: TxExecutionStatus;
  transaction: SignedTransaction;
  transactionOutcome: ExecutionOutcome;
  /** In execution order. */
  receipts: ReceiptView[];
  timings: PhaseTimings;
  /** Gas price used for this transaction, yoctoNEAR per gas unit. */
  gasPrice: Yocto;
}

// ---------- Accounts, blocks, shards ----------

export interface AccountView {
  accountId: AccountId;
  /** Spendable balance, yoctoNEAR. */
  amount: Yocto;
  /** Staked balance, yoctoNEAR. */
  locked: Yocto;
  /** base58 sha256 of the contract code; "11111111111111111111111111111111" when none. */
  codeHash: CryptoHash;
  storageUsage: number;
  blockHeight: number;
  blockHash: CryptoHash;
}

export interface PracticeAccount {
  accountId: AccountId;
  publicKey: PublicKey;
}

export interface ViewCallResult<T = unknown> {
  result: T;
  logs: string[];
  blockHeight: number;
  blockHash: CryptoHash;
}

export type BlockRef = "final" | "optimistic" | { height: number } | { hash: CryptoHash };

export interface ChunkHeaderView {
  chunkHash: CryptoHash;
  shardId: ShardId;
  heightCreated: number;
  heightIncluded: number;
  gasUsed: Gas;
  gasLimit: Gas;
}

export interface BlockView {
  height: number;
  hash: CryptoHash;
  prevHash: CryptoHash;
  timestampMs: number;
  author: AccountId;
  chunks: ChunkHeaderView[];
}

export interface ChunkView {
  header: ChunkHeaderView;
  blockHash: CryptoHash;
  blockHeight: number;
  /** Hashes of transactions first included in this chunk. */
  transactions: CryptoHash[];
  /** Ids of receipts applied in this chunk. */
  receipts: CryptoHash[];
}

/** NEAR assigns accounts to shards by boundary accounts (RPC `EXPERIMENTAL_protocol_config`). */
export interface ShardLayout {
  /** shardIds[i] holds accounts in [boundaryAccounts[i-1], boundaryAccounts[i]). */
  shardIds: ShardId[];
  boundaryAccounts: AccountId[];
}

// ---------- Errors ----------

export type InvalidTxReason =
  | "SignerDoesNotExist"
  | "InvalidSignerId"
  | "InvalidReceiverId"
  | "AccessKeyNotFound"
  | "ReceiverMismatch"
  | "MethodNameMismatch"
  | "RequiresFullAccess"
  | "NotEnoughAllowance"
  | "DepositWithFunctionCall"
  | "InvalidNonce"
  | "Expired"
  | "NotEnoughBalance"
  | "LackBalanceForState"
  | "InvalidSignature";

/** Errors thrown (rejected) by Chain methods. Failed actions are not thrown: they come back as a Failure status. */
export type ChainErrorKind =
  | "InvalidTransaction"
  | "AccountDoesNotExist"
  | "UnknownTransaction"
  | "UnknownBlock"
  | "UnknownChunk"
  | "ViewFailed"
  | "Network";

// ---------- The interface ----------

export interface Chain {
  readonly network: ChainNetwork;

  /** The learner's practice account, created and funded on first use. */
  practiceAccount(): Promise<PracticeAccount>;
  /** Rejects with ChainError "AccountDoesNotExist". */
  viewAccount(accountId: AccountId): Promise<AccountView>;
  accountExists(accountId: AccountId): Promise<boolean>;
  listKeys(accountId: AccountId): Promise<AccessKeyInfo[]>;
  /** Read-only contract call. Rejects with ChainError "ViewFailed" on a panic or a missing method. */
  viewCall<T = unknown>(
    contractId: AccountId,
    methodName: string,
    args?: Record<string, unknown>,
  ): Promise<ViewCallResult<T>>;

  /** Make a new key pair. The secret stays inside the chain's key store; you get the public key. */
  newKeyPair(): Promise<PublicKey>;

  /** Fill in nonce, block hash and key (lesson 0.3 shows these before signing). */
  buildTransaction(request: TransactionRequest): Promise<UnsignedTransaction>;
  /** Sign locally; the hash becomes the transaction id. No network. */
  signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction>;
  /**
   * Broadcast and wait for FINAL. Rejects with ChainError "InvalidTransaction" when the network
   * refuses the transaction; a failed action resolves with a Failure status instead.
   */
  sendSignedTransaction(tx: SignedTransaction, options?: SendOptions): Promise<TxOutcome>;
  /** build + sign + send, reporting every phase. */
  sendTransaction(request: TransactionRequest, options?: SendOptions): Promise<TxOutcome>;
  /** Look up a past transaction (RPC `tx`). Rejects with "UnknownTransaction". */
  getTransaction(hash: CryptoHash, senderId: AccountId): Promise<TxOutcome>;

  block(ref?: BlockRef): Promise<BlockView>;
  chunk(block: BlockRef, shardId: ShardId): Promise<ChunkView>;
  shardLayout(): Promise<ShardLayout>;
}
