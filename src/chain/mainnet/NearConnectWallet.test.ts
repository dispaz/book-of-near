import { describe, expect, it, vi } from "vitest";
import { parseNear } from "../units";
import { checkFunds } from "./funds";
import { MAINNET_RPC_URLS, NearConnectWallet, type ConnectorLike } from "./NearConnectWallet";
import { signWithConfirmation } from "./signing";

/** A fake NEAR Connect and a fake RPC. Nothing real is ever contacted or signed. */
function fakes(opts: { amount?: string; storageUsage?: number; connectFails?: boolean } = {}) {
  const signAndSendTransaction = vi.fn(async () => ({ transaction: { hash: "TXHASH" } }));
  const wallet = {
    getAccounts: async () => [{ accountId: "ana.near" }],
    signAndSendTransaction,
  };
  const connector: ConnectorLike = {
    connect: vi.fn(async () => {
      if (opts.connectFails) throw new Error("User closed the wallet selector");
      return wallet;
    }),
    disconnect: vi.fn(async () => {}),
    getConnectedWallet: vi.fn(async () => {
      throw new Error("No wallet selected");
    }),
  };
  const calls: { url: string; body: { method: string; params: Record<string, string> } }[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(url), body });
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: {
          amount: parseNear(opts.amount ?? "12.5").toString(),
          locked: "0",
          storage_usage: opts.storageUsage ?? 1000,
        },
      }),
    );
  }) as unknown as typeof fetch;
  return { connector, signAndSendTransaction, fetchFn, calls };
}

describe("NearConnectWallet", () => {
  it("connects, then reads the mainnet balance (less the storage the account must keep)", async () => {
    const f = fakes({ amount: "12.5", storageUsage: 1000 });
    const w = new NearConnectWallet({ connector: f.connector, fetch: f.fetchFn });
    expect(w.kind).toBe("mainnet");
    const s = await w.connect();
    // 1000 bytes * 10^19 yocto = 0.00001 NEAR kept for storage
    expect(s).toEqual({
      status: "connected",
      accountId: "ana.near",
      balance: parseNear("12.5") - 1000n * 10n ** 19n,
    });
    expect(f.calls[0]!.url).toBe(MAINNET_RPC_URLS[0]);
    expect(f.calls[0]!.body.method).toBe("query");
    expect(f.calls[0]!.body.params).toMatchObject({
      request_type: "view_account",
      finality: "final",
      account_id: "ana.near",
    });
  });

  it("feeds the funds check: enough and not enough", async () => {
    const rich = new NearConnectWallet({
      connector: fakes({ amount: "5" }).connector,
      fetch: fakes({ amount: "5" }).fetchFn,
    });
    await rich.connect();
    expect(checkFunds(rich.state(), { amount: parseNear("1") }).kind).toBe("enough");
    const poor = new NearConnectWallet({
      connector: fakes({ amount: "0.02" }).connector,
      fetch: fakes({ amount: "0.02" }).fetchFn,
    });
    await poor.connect();
    expect(checkFunds(poor.state(), { amount: parseNear("1") }).kind).toBe("not-enough");
  });

  it("goes to an error state with a plain message when the learner closes the picker", async () => {
    const f = fakes({ connectFails: true });
    const w = new NearConnectWallet({ connector: f.connector, fetch: f.fetchFn });
    const s = await w.connect();
    expect(s.status).toBe("error");
    expect(checkFunds(s, { amount: 1n }).kind).toBe("no-wallet");
    if (s.status === "error") expect(s.message).toMatch(/not connected|closed|try again/i);
  });

  it("falls back to the next RPC node when the first is down", async () => {
    const f = fakes();
    const urls: string[] = [];
    const flaky = (async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url));
      if (urls.length === 1) throw new TypeError("network down");
      return f.fetchFn(url, init);
    }) as typeof fetch;
    const w = new NearConnectWallet({ connector: f.connector, fetch: flaky });
    expect((await w.connect()).status).toBe("connected");
    expect(urls).toEqual([MAINNET_RPC_URLS[0], MAINNET_RPC_URLS[1]]);
  });

  it("shows an error, not a fake balance, when no RPC node answers", async () => {
    const f = fakes();
    const down = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    const w = new NearConnectWallet({ connector: f.connector, fetch: down });
    const s = await w.connect();
    expect(s.status).toBe("error");
  });

  it("signs a Transfer through the wallet only after confirmation, in connector action shape", async () => {
    const f = fakes();
    const w = new NearConnectWallet({ connector: f.connector, fetch: f.fetchFn });
    await w.connect();
    const declined = await signWithConfirmation(
      w,
      { summary: "s", receiverId: "x.near", actions: [{ type: "Transfer", deposit: parseNear("1") }] },
      async () => false,
    );
    expect(declined).toEqual({ ok: false, reason: "declined" });
    expect(f.signAndSendTransaction).not.toHaveBeenCalled();

    const done = await signWithConfirmation(
      w,
      { summary: "s", receiverId: "x.near", actions: [{ type: "Transfer", deposit: parseNear("1") }] },
      async () => true,
    );
    expect(done).toEqual({ ok: true, txHash: "TXHASH" });
    expect(f.signAndSendTransaction).toHaveBeenCalledWith({
      network: "mainnet",
      signerId: "ana.near",
      receiverId: "x.near",
      actions: [{ type: "Transfer", params: { deposit: parseNear("1").toString() } }],
    });
  });

  it("disconnect clears the state", async () => {
    const f = fakes();
    const w = new NearConnectWallet({ connector: f.connector, fetch: f.fetchFn });
    await w.connect();
    await w.disconnect();
    expect(w.state()).toEqual({ status: "disconnected" });
    expect(f.connector.disconnect).toHaveBeenCalled();
  });
});
