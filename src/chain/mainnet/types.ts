/**
 * The mainnet wallet seam. Kept apart from `Chain` on purpose: `Chain` is the learner's practice
 * network (demo or testnet); this is their own real wallet on mainnet, used only for the final
 * badge and the optional capped swap. Types only, no network imports (a test enforces this).
 */
import type { AccountId } from "../types";

export type WalletState =
  | { status: "disconnected" }
  | { status: "connecting" }
  /** `balance` is the spendable yoctoNEAR (total minus what storage keeps locked). */
  | { status: "connected"; accountId: AccountId; balance: bigint }
  /** Something went wrong; `message` is plain English. The learner can try again. */
  | { status: "error"; message: string };

export interface FundsRequirement {
  /** What the action sends or spends, in yoctoNEAR. 0 for a fee-only action. */
  amount: bigint;
  /** Kept back for the network fee. Default: DEFAULT_FEE_RESERVE (0.01 NEAR). */
  feeReserve?: bigint;
}

export type FundsResult =
  | { kind: "enough"; needed: bigint; balance: bigint; fallback: null; message: string }
  | {
      kind: "not-enough";
      needed: bigint;
      balance: bigint;
      shortfall: bigint;
      fallback: "testnet";
      message: string;
    }
  | { kind: "no-wallet"; needed: bigint; fallback: "testnet"; message: string };

/** One thing a signing request will do, shown to the learner before the wallet is asked. */
export type SigningAction =
  | { type: "Transfer"; deposit: bigint }
  | { type: "FunctionCall"; methodName: string; args: object; gas: bigint; deposit: bigint };

export interface SigningRequest {
  /** Plain-English sentence: what this does and why. Shown in the confirmation. */
  summary: string;
  receiverId: AccountId;
  actions: SigningAction[];
}

/** What the confirmation shows. Built by `describeSigning`, never by the caller. */
export interface SigningPreview {
  summary: string;
  receiverId: AccountId;
  /** Total NEAR attached to the actions, formatted, e.g. "0.5". Never "0" for a non-zero total. */
  amountNear: string;
  /** The same with its unit, e.g. "0.5 NEAR" or "less than 0.000001 NEAR". Show this one. */
  amountText: string;
  /** Each action in a sentence. */
  lines: string[];
  /** Says that gas is paid on top of the amount. */
  feeNote: string;
  /** Says it is real money on mainnet (or a simulation in demo mode). */
  warning: string;
}

export interface SignedResult {
  txHash: string;
}

/** Why a signing request ended without a transaction. */
export type SigningRefusal =
  | "declined"
  | "no-wallet"
  | "invalid-request"
  | "not-enough"
  /** Another signing is already open or waiting for the wallet. */
  | "busy"
  /** The learner confirmed but the wallet or network failed (popup closed, RPC down, transaction failed). */
  | "failed";

export interface MainnetWallet {
  /** "demo": simulated, no network. "mainnet": a real wallet through NEAR Connect. */
  readonly kind: "demo" | "mainnet";
  state(): WalletState;
  subscribe(listener: (s: WalletState) => void): () => void;
  /** Opens the wallet picker (mainnet) or connects the simulated account (demo). Never throws. */
  connect(): Promise<WalletState>;
  disconnect(): Promise<void>;
  /** Re-reads the balance. */
  refresh(): Promise<WalletState>;
  /**
   * Asks the wallet to sign and send. Only call through `signWithConfirmation`, which shows the
   * amount first. Implementations must not be called for anything else.
   */
  signAndSend(request: SigningRequest): Promise<SignedResult>;
}
