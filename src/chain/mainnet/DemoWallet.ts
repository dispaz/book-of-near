import { parseNear } from "../units";
import type { MainnetWallet, SignedResult, SigningRequest, WalletState } from "./types";

/** The simulated mainnet account in demo mode. Not a real account. */
export const DEMO_MAINNET_ACCOUNT = "demo-learner.near";

export interface DemoWalletOptions {
  /** Starting balance in yoctoNEAR. Default 25 NEAR. */
  balance?: bigint;
  accountId?: string;
}

/**
 * Demo mode's wallet: connects at once with a made-up account, never touches the network and
 * "sends" by lowering its own balance. Deterministic (hash from a counter, no clock or randomness).
 */
export class DemoWallet implements MainnetWallet {
  readonly kind = "demo" as const;
  private current: WalletState = { status: "disconnected" };
  private balance: bigint;
  private readonly accountId: string;
  private sent = 0;
  private listeners = new Set<(s: WalletState) => void>();

  constructor(opts: DemoWalletOptions = {}) {
    this.balance = opts.balance ?? parseNear("25");
    this.accountId = opts.accountId ?? DEMO_MAINNET_ACCOUNT;
  }

  state(): WalletState {
    return this.current;
  }

  subscribe(listener: (s: WalletState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(s: WalletState): WalletState {
    this.current = s;
    for (const l of this.listeners) l(s);
    return s;
  }

  async connect(): Promise<WalletState> {
    return this.set({ status: "connected", accountId: this.accountId, balance: this.balance });
  }

  async disconnect(): Promise<void> {
    this.set({ status: "disconnected" });
  }

  async refresh(): Promise<WalletState> {
    return this.current.status === "connected"
      ? this.set({ status: "connected", accountId: this.accountId, balance: this.balance })
      : this.current;
  }

  async signAndSend(request: SigningRequest): Promise<SignedResult> {
    const total = request.actions.reduce((sum, a) => sum + a.deposit, 0n);
    this.balance -= total;
    this.sent += 1;
    await this.refresh();
    return { txHash: `demo-${this.sent.toString().padStart(4, "0")}` };
  }
}
