import { describe, expect, it, vi } from "vitest";
import { parseNear } from "../units";
import { DemoWallet } from "./DemoWallet";
import { describeSigning, signWithConfirmation } from "./signing";
import type { MainnetWallet, SigningRequest, WalletState } from "./types";

const transfer = (near: string): SigningRequest => ({
  summary: "Send a tiny test payment.",
  receiverId: "book-of-near.near",
  actions: [{ type: "Transfer", deposit: parseNear(near) }],
});

const connectedWallet = async (opts?: ConstructorParameters<typeof DemoWallet>[0]) => {
  const w = new DemoWallet(opts);
  await w.connect();
  return w;
};

describe("signWithConfirmation: failures, single flight, fee reserve", () => {
  it("returns failed with a plain message when the wallet rejects (popup closed, RPC down)", async () => {
    const wallet = await connectedWallet();
    vi.spyOn(wallet, "signAndSend").mockRejectedValue(new Error("User closed the popup"));
    const r = await signWithConfirmation(wallet, transfer("0.5"), async () => true);
    expect(r).toMatchObject({ ok: false, reason: "failed" });
    expect(!r.ok && r.message).toContain("User closed the popup");
  });

  it("allows only one signing at a time per wallet, even while waiting for the wallet", async () => {
    const wallet = await connectedWallet();
    let release!: () => void;
    const sign = vi
      .spyOn(wallet, "signAndSend")
      .mockImplementation(() => new Promise((res) => (release = () => res({ txHash: "H1" }))));
    const first = signWithConfirmation(wallet, transfer("0.5"), async () => true);
    await new Promise((r) => setTimeout(r, 0));
    const second = await signWithConfirmation(wallet, transfer("0.5"), async () => true);
    expect(second).toMatchObject({ ok: false, reason: "busy" });
    release();
    expect(await first).toEqual({ ok: true, txHash: "H1" });
    expect(sign).toHaveBeenCalledOnce();
    sign.mockResolvedValue({ txHash: "H2" });
    expect(await signWithConfirmation(wallet, transfer("0.5"), async () => true)).toEqual({
      ok: true,
      txHash: "H2",
    });
  });

  it("releases the lock after a failure", async () => {
    const wallet = await connectedWallet();
    const sign = vi.spyOn(wallet, "signAndSend").mockRejectedValueOnce(new Error("x"));
    await signWithConfirmation(wallet, transfer("0.5"), async () => true);
    sign.mockResolvedValue({ txHash: "ok" });
    expect((await signWithConfirmation(wallet, transfer("0.5"), async () => true)).ok).toBe(true);
  });

  it("uses the same needed amount as checkFunds: amount plus the fee reserve", async () => {
    const wallet = await connectedWallet({ balance: parseNear("1") });
    const sign = vi.spyOn(wallet, "signAndSend");
    const r = await signWithConfirmation(wallet, transfer("0.995"), async () => true);
    expect(r).toMatchObject({ ok: false, reason: "not-enough" });
    expect(sign).not.toHaveBeenCalled();
  });

  it("re-reads the balance after the learner confirms and refuses if it dropped", async () => {
    // The fake only learns the new balance when refresh() is called, so the second check can
    // only see it if signWithConfirmation really re-reads.
    const fake = new FakeWallet(parseNear("1"));
    const r = await signWithConfirmation(fake, transfer("0.5"), async () => {
      fake.remoteBalance = parseNear("0.1"); // balance falls while the dialog is open
      return true;
    });
    expect(fake.refreshCalls).toBe(1);
    expect(r).toMatchObject({ ok: false, reason: "not-enough" });
    expect(fake.sendCalls).toBe(0);
  });

  it("does not drop the wallet when the re-read fails before signing: refuses with a clear message", async () => {
    const fake = new FakeWallet(parseNear("1"));
    fake.refreshFails = true;
    const r = await signWithConfirmation(fake, transfer("0.5"), async () => true);
    expect(r).toMatchObject({ ok: false, reason: "failed" });
    expect(!r.ok && r.message).toMatch(/could not check your balance/i);
    expect(fake.sendCalls).toBe(0);
    expect(fake.state().status).toBe("connected");
  });

  it("reports success and keeps the wallet connected when the re-read after a send fails", async () => {
    const fake = new FakeWallet(parseNear("1"));
    fake.failRefreshAfterSend = true;
    const r = await signWithConfirmation(fake, transfer("0.5"), async () => true);
    expect(r).toEqual({ ok: true, txHash: "FAKE" });
    expect(fake.state().status).toBe("connected");
  });

  it("reports unconfirmed (not failed) when the wallet gives no result", async () => {
    const fake = new FakeWallet(parseNear("1"));
    fake.nextTxHash = null;
    const r = await signWithConfirmation(fake, transfer("0.5"), async () => true);
    expect(r).toMatchObject({ ok: false, reason: "unconfirmed" });
    expect(!r.ok && r.message).toMatch(/check your wallet/i);
  });
});

/** A wallet whose balance only changes when refresh() is called. */
class FakeWallet implements MainnetWallet {
  readonly kind = "demo" as const;
  remoteBalance: bigint;
  refreshCalls = 0;
  sendCalls = 0;
  refreshFails = false;
  failRefreshAfterSend = false;
  nextTxHash: string | null = "FAKE";
  private current: WalletState;
  constructor(balance: bigint) {
    this.remoteBalance = balance;
    this.current = { status: "connected", accountId: "ana.near", balance };
  }
  state() {
    return this.current;
  }
  subscribe() {
    return () => {};
  }
  async connect() {
    return this.current;
  }
  async disconnect() {}
  async refresh() {
    this.refreshCalls += 1;
    if (this.refreshFails) throw new Error("rpc down");
    this.current = { status: "connected", accountId: "ana.near", balance: this.remoteBalance };
    return this.current;
  }
  async signAndSend() {
    this.sendCalls += 1;
    if (this.failRefreshAfterSend) this.refreshFails = true;
    return { txHash: this.nextTxHash };
  }
}

describe("describeSigning", () => {
  it("never shows 0 NEAR for a non-zero deposit, and notes the fee and call arguments", () => {
    const p = describeSigning("mainnet", {
      summary: "s",
      receiverId: "x.near",
      actions: [
        { type: "Transfer", deposit: 1n },
        { type: "FunctionCall", methodName: "do_it", args: { a: 1 }, gas: 1n, deposit: 0n },
      ],
    });
    expect(p.amountText).toBe("less than 0.000001 NEAR");
    expect(p.lines[0]).not.toMatch(/\b0 NEAR/);
    expect(p.lines[0]).toContain("less than 0.000001 NEAR");
    expect(p.lines[1]).toContain('{"a":1}');
    expect(p.feeNote).toMatch(/network fee/i);
    expect(describeSigning("demo", transfer("0.5")).amountText).toBe("0.5 NEAR");
    expect(describeSigning("demo", transfer("0")).amountText).toBe("0 NEAR");
  });
});

describe("DemoWallet limits", () => {
  it("refuses to send more than it has", async () => {
    const w = await connectedWallet({ balance: parseNear("1") });
    await expect(w.signAndSend(transfer("2"))).rejects.toThrow(/not enough/i);
    expect(w.state()).toMatchObject({ balance: parseNear("1") });
  });
});
