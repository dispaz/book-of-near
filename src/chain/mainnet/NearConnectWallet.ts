/**
 * The real mainnet wallet: NEAR Connect (`@hot-labs/near-connect` 0.12.0) for login and signing,
 * a plain mainnet RPC `view_account` for the balance. Network code: loaded lazily, never imported
 * by lessons. The connector is injected so tests use a fake and never touch a real wallet.
 *
 * Verified (issue #4): `new NearConnector({ network: "mainnet" })`, `connect()`, `getConnectedWallet()`,
 * `disconnect()`. NOT verified (needs a human with a mainnet wallet): a real sign-in and a real
 * `signAndSendTransaction`; those call shapes follow the package's type declarations.
 */
import { Rpc, RpcError, RpcUnreachable } from "../testnet/rpc";
import type { MainnetWallet, SignedResult, SigningAction, SigningRequest, WalletState } from "./types";

/** Mainnet RPC endpoints in order of preference (verified by issue #4, all CORS `*`). */
export const MAINNET_RPC_URLS = [
  "https://rpc.mainnet.fastnear.com",
  "https://free.rpc.fastnear.com",
  "https://rpc.mainnet.near.org",
  "https://near.drpc.org",
];

/** NEAR keeps 10^19 yoctoNEAR per byte of storage an account uses (protocol constant). */
const STORAGE_PRICE_PER_BYTE = 10n ** 19n;

/** The slice of NEAR Connect's wallet we use. */
export interface ConnectedWalletLike {
  getAccounts(): Promise<{ accountId: string }[]>;
  signAndSendTransaction(params: {
    network: "mainnet";
    signerId: string;
    receiverId: string;
    actions: ConnectorAction[];
  }): Promise<{
    status?: unknown;
    transaction?: { hash?: string };
    transaction_outcome?: { id?: string };
  }>;
}
/** The slice of `NearConnector` we use. */
export interface ConnectorLike {
  connect(): Promise<ConnectedWalletLike>;
  disconnect(): Promise<void>;
  getConnectedWallet(): Promise<{ wallet: ConnectedWalletLike }>;
}

type ConnectorAction =
  | { type: "Transfer"; params: { deposit: string } }
  | { type: "FunctionCall"; params: { methodName: string; args: object; gas: string; deposit: string } };

function toConnectorAction(a: SigningAction): ConnectorAction {
  return a.type === "Transfer"
    ? { type: "Transfer", params: { deposit: a.deposit.toString() } }
    : {
        type: "FunctionCall",
        params: {
          methodName: a.methodName,
          args: a.args,
          gas: a.gas.toString(),
          deposit: a.deposit.toString(),
        },
      };
}

export interface NearConnectWalletOptions {
  connector: ConnectorLike;
  fetch?: typeof fetch;
  rpcUrls?: string[];
}

export class NearConnectWallet implements MainnetWallet {
  readonly kind = "mainnet" as const;
  private current: WalletState = { status: "disconnected" };
  private wallet: ConnectedWalletLike | null = null;
  private listeners = new Set<(s: WalletState) => void>();
  private readonly connector: ConnectorLike;
  private readonly rpc: Rpc;

  constructor(opts: NearConnectWalletOptions) {
    this.connector = opts.connector;
    this.rpc = new Rpc({ urls: opts.rpcUrls ?? MAINNET_RPC_URLS, fetch: opts.fetch });
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

  private async readBalance(accountId: string): Promise<bigint> {
    try {
      const v = await this.rpc.call<{ amount: string; locked?: string; storage_usage: number }>("query", {
        request_type: "view_account",
        finality: "final",
        account_id: accountId,
      });
      // `amount` is the liquid balance; staked NEAR (`locked`) counts toward the storage requirement first.
      const storageCost = BigInt(v.storage_usage) * STORAGE_PRICE_PER_BYTE;
      const stillToCover = storageCost - BigInt(v.locked ?? "0");
      const spendable = BigInt(v.amount) - (stillToCover > 0n ? stillToCover : 0n);
      return spendable > 0n ? spendable : 0n;
    } catch (e) {
      if (e instanceof RpcError && e.name === "UNKNOWN_ACCOUNT") return 0n; // a new account with no funds yet
      if (e instanceof RpcUnreachable)
        throw new Error("Could not reach NEAR mainnet to read your balance.", { cause: e });
      throw e;
    }
  }

  async connect(): Promise<WalletState> {
    this.set({ status: "connecting" });
    try {
      let wallet: ConnectedWalletLike;
      try {
        wallet = (await this.connector.getConnectedWallet()).wallet; // restore an earlier session
      } catch (restoreError) {
        // No earlier session (normal on a first visit). If the picker fails too, keep this as the cause.
        try {
          wallet = await this.connector.connect(); // opens the wallet picker
        } catch (e) {
          console.debug("No earlier wallet session to restore:", restoreError);
          throw e;
        }
      }
      const account = (await wallet.getAccounts())[0];
      if (!account) throw new Error("The wallet did not share an account.");
      this.wallet = wallet;
      return this.set({
        status: "connected",
        accountId: account.accountId,
        balance: await this.readBalance(account.accountId),
      });
    } catch (e) {
      this.wallet = null;
      const reason = e instanceof Error ? e.message : "unknown problem";
      return this.set({
        status: "error",
        message: `The wallet was not connected (${reason}). Try again, or use the free testnet edition.`,
      });
    }
  }

  async disconnect(): Promise<void> {
    this.wallet = null;
    try {
      await this.connector.disconnect();
    } catch {
      /* already signed out */
    }
    this.set({ status: "disconnected" });
  }

  async refresh(): Promise<WalletState> {
    const s = this.current;
    if (s.status !== "connected") return s;
    try {
      return this.set({ ...s, balance: await this.readBalance(s.accountId) });
    } catch (e) {
      return this.set({ status: "error", message: (e as Error).message });
    }
  }

  async signAndSend(request: SigningRequest): Promise<SignedResult> {
    const s = this.current;
    if (s.status !== "connected" || !this.wallet) throw new Error("No wallet is connected.");
    const out = await this.wallet.signAndSendTransaction({
      network: "mainnet",
      signerId: s.accountId,
      receiverId: request.receiverId,
      actions: request.actions.map(toConnectorAction),
    });
    await this.refresh();
    if (out.status && typeof out.status === "object" && "Failure" in out.status)
      throw new Error("The transaction was sent but failed on the network, so it did not go through.");
    const txHash = out.transaction?.hash ?? out.transaction_outcome?.id ?? "";
    if (!txHash)
      throw new Error("The wallet returned no transaction id, so we cannot confirm it went through.");
    return { txHash };
  }
}

/** Builds the real thing. Loads NEAR Connect on demand (it is a separate chunk). */
export async function createNearConnectWallet(): Promise<NearConnectWallet> {
  const { NearConnector } = await import("@hot-labs/near-connect");
  const connector = new NearConnector({ network: "mainnet" }) as unknown as ConnectorLike;
  return new NearConnectWallet({ connector });
}
