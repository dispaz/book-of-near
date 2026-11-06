import { describe, expect, it, vi } from "vitest";
import { parseNear } from "../units";
import { DemoWallet } from "./DemoWallet";
import { describeSigning, signWithConfirmation } from "./signing";
import type { SigningRequest } from "./types";

const transfer = (near: string): SigningRequest => ({
  summary: "Send a tiny test payment.",
  receiverId: "book-of-near.near",
  actions: [{ type: "Transfer", deposit: parseNear(near) }],
});

describe("describeSigning", () => {
  it("states the total amount, the receiver and each action", () => {
    const p = describeSigning("mainnet", {
      summary: "Swap",
      receiverId: "intents.near",
      actions: [
        { type: "Transfer", deposit: parseNear("0.25") },
        {
          type: "FunctionCall",
          methodName: "ft_transfer",
          args: {},
          gas: 30n * 10n ** 12n,
          deposit: parseNear("0.5"),
        },
      ],
    });
    expect(p.amountNear).toBe("0.75");
    expect(p.receiverId).toBe("intents.near");
    expect(p.lines).toHaveLength(2);
    expect(p.lines[0]).toContain("0.25 NEAR");
    expect(p.lines[1]).toContain("ft_transfer");
    expect(p.warning).toMatch(/real money/i);
  });

  it("labels demo requests as a simulation", () => {
    expect(describeSigning("demo", transfer("1")).warning).toMatch(/simulat/i);
  });
});

describe("signWithConfirmation", () => {
  it("shows the amount first and only then asks the wallet", async () => {
    const wallet = new DemoWallet();
    await wallet.connect();
    const order: string[] = [];
    const sign = vi.spyOn(wallet, "signAndSend").mockImplementation(async () => {
      order.push("wallet");
      return { txHash: "demo-hash" };
    });
    const result = await signWithConfirmation(wallet, transfer("0.5"), async (preview) => {
      order.push(`confirm:${preview.amountNear}`);
      return true;
    });
    expect(order).toEqual(["confirm:0.5", "wallet"]);
    expect(sign).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, txHash: "demo-hash" });
  });

  it("never asks the wallet when the learner declines", async () => {
    const wallet = new DemoWallet();
    await wallet.connect();
    const sign = vi.spyOn(wallet, "signAndSend");
    const result = await signWithConfirmation(wallet, transfer("0.5"), async () => false);
    expect(result).toEqual({ ok: false, reason: "declined" });
    expect(sign).not.toHaveBeenCalled();
  });

  it("refuses without a connected wallet, before showing any confirmation", async () => {
    const wallet = new DemoWallet();
    const confirm = vi.fn(async () => true);
    const sign = vi.spyOn(wallet, "signAndSend");
    const result = await signWithConfirmation(wallet, transfer("0.5"), confirm);
    expect(result).toEqual({ ok: false, reason: "no-wallet" });
    expect(confirm).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });

  it("refuses a request with no actions or no amount to show", async () => {
    const wallet = new DemoWallet();
    await wallet.connect();
    const confirm = vi.fn(async () => true);
    const empty = { ...transfer("1"), actions: [] };
    expect(await signWithConfirmation(wallet, empty, confirm)).toEqual({
      ok: false,
      reason: "invalid-request",
    });
    const noReceiver = { ...transfer("1"), receiverId: "" };
    expect(await signWithConfirmation(wallet, noReceiver, confirm)).toEqual({
      ok: false,
      reason: "invalid-request",
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("refuses an amount bigger than the balance without asking the wallet", async () => {
    const wallet = new DemoWallet({ balance: parseNear("1") });
    await wallet.connect();
    const sign = vi.spyOn(wallet, "signAndSend");
    const result = await signWithConfirmation(wallet, transfer("5"), async () => true);
    expect(result).toEqual({ ok: false, reason: "not-enough" });
    expect(sign).not.toHaveBeenCalled();
  });
});
