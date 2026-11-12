import { describe, expect, it, vi } from "vitest";
import { parseNear } from "../units";
import { NearConnectWallet, type ConnectedWalletLike, type ConnectorLike } from "./NearConnectWallet";

function setup(
  outcome: unknown,
  view = { amount: parseNear("5").toString(), locked: "0", storage_usage: 0 },
) {
  const wallet = {
    getAccounts: async () => [{ accountId: "ana.near" }],
    signAndSendTransaction: vi.fn(async () => outcome),
  } as unknown as ConnectedWalletLike;
  const connector: ConnectorLike = {
    connect: async () => wallet,
    disconnect: async () => {},
    getConnectedWallet: async () => {
      throw new Error("No wallet selected");
    },
  };
  const fetchFn = (async () =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: view }))) as typeof fetch;
  return new NearConnectWallet({ connector, fetch: fetchFn });
}

const req = {
  summary: "s",
  receiverId: "x.near",
  actions: [{ type: "Transfer" as const, deposit: parseNear("1") }],
};

describe("NearConnectWallet.signAndSend outcome checks", () => {
  it("throws when the transaction ran but failed", async () => {
    const w = setup({
      transaction: { hash: "H" },
      status: { Failure: { ActionError: { index: 0, kind: "LackBalanceForState" } } },
    });
    await w.connect();
    await expect(w.signAndSend(req)).rejects.toThrow(/failed/i);
  });

  it("throws when the wallet returns no transaction hash", async () => {
    const w = setup({ status: { SuccessValue: "" } });
    await w.connect();
    await expect(w.signAndSend(req)).rejects.toThrow(/no transaction id/i);
  });

  it("returns the hash on success", async () => {
    const w = setup({ transaction: { hash: "H" }, status: { SuccessValue: "" } });
    await w.connect();
    await expect(w.signAndSend(req)).resolves.toEqual({ txHash: "H" });
  });
});

describe("NearConnectWallet balance with staking", () => {
  it("counts locked (staked) NEAR toward the storage cost", async () => {
    // storage costs 1000 * 10^19; 600*10^19 is covered by the locked stake, so 400*10^19 comes off
    const w = setup(
      {},
      {
        amount: parseNear("1").toString(),
        locked: (600n * 10n ** 19n).toString(),
        storage_usage: 1000,
      },
    );
    const s = await w.connect();
    expect(s).toMatchObject({ balance: parseNear("1") - 400n * 10n ** 19n });
  });
});
