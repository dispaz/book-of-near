import { describe, expect, it, vi } from "vitest";
import { parseNear } from "../units";
import { checkFunds } from "./funds";
import { DEMO_MAINNET_ACCOUNT, DemoWallet } from "./DemoWallet";

describe("DemoWallet", () => {
  it("starts disconnected and connects a simulated account with a balance, no network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const w = new DemoWallet();
    expect(w.kind).toBe("demo");
    expect(w.state()).toEqual({ status: "disconnected" });
    const s = await w.connect();
    expect(s).toEqual({ status: "connected", accountId: DEMO_MAINNET_ACCOUNT, balance: parseNear("25") });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("notifies subscribers and stops after unsubscribe", async () => {
    const w = new DemoWallet();
    const seen: string[] = [];
    const off = w.subscribe((s) => seen.push(s.status));
    await w.connect();
    await w.disconnect();
    off();
    await w.connect();
    expect(seen).toEqual(["connected", "disconnected"]);
  });

  it("can be set up as too poor, so the funds check can be shown", async () => {
    const w = new DemoWallet({ balance: parseNear("0.001") });
    await w.connect();
    expect(checkFunds(w.state(), { amount: parseNear("0.1") }).kind).toBe("not-enough");
  });

  it("a simulated send lowers the balance and returns a demo hash", async () => {
    const w = new DemoWallet({ balance: parseNear("2") });
    await w.connect();
    const { txHash } = await w.signAndSend({
      summary: "x",
      receiverId: "a.near",
      actions: [{ type: "Transfer", deposit: parseNear("0.5") }],
    });
    expect(txHash).toMatch(/^demo-/);
    expect(w.state()).toMatchObject({ status: "connected", balance: parseNear("1.5") });
  });
});
