import { describe, expect, it, vi } from "vitest";
import { parseNear } from "../units";
import { NearConnectWallet, type ConnectedWalletLike, type ConnectorLike } from "./NearConnectWallet";

function setup(sendResult: unknown) {
  let rpcUp = true;
  const wallet = {
    getAccounts: async () => [{ accountId: "ana.near" }],
    signAndSendTransaction: vi.fn(async () => sendResult),
  } as unknown as ConnectedWalletLike;
  const connector: ConnectorLike = {
    connect: async () => wallet,
    disconnect: async () => {},
    getConnectedWallet: async () => {
      throw new Error("none");
    },
  };
  const fetchFn = (async () => {
    if (!rpcUp) throw new TypeError("offline");
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { amount: parseNear("5").toString(), locked: "0", storage_usage: 0 },
      }),
    );
  }) as typeof fetch;
  return {
    w: new NearConnectWallet({ connector, fetch: fetchFn }),
    rpcDown: () => (rpcUp = false),
  };
}

const req = {
  summary: "s",
  receiverId: "x.near",
  actions: [{ type: "Transfer" as const, deposit: parseNear("1") }],
};

describe("NearConnectWallet.refresh", () => {
  it("rejects on an RPC blip but keeps the connected state and last known balance", async () => {
    const { w, rpcDown } = setup({});
    await w.connect();
    rpcDown();
    await expect(w.refresh()).rejects.toThrow(/could not reach/i);
    expect(w.state()).toMatchObject({ status: "connected", accountId: "ana.near", balance: parseNear("5") });
  });

  it("a successful send stays connected and succeeds even if the balance re-read then fails", async () => {
    const { w, rpcDown } = setup({ transaction: { hash: "H" }, status: { SuccessValue: "" } });
    await w.connect();
    rpcDown();
    await expect(w.signAndSend(req)).resolves.toEqual({ txHash: "H" });
    expect(w.state().status).toBe("connected");
  });

  it("returns an unconfirmed result (txHash null) when the wallet resolves with nothing", async () => {
    const { w } = setup(undefined);
    await w.connect();
    await expect(w.signAndSend(req)).resolves.toEqual({ txHash: null });
  });
});
