import { describe, expect, it } from "vitest";
import { DemoChain } from "../../../chain/DemoChain";
import { DEMO_BUYER, DEMO_SHOP } from "../../../chain/demo/shop";
import { callMethod } from "../../../chain/ops";
import { formatTgas, tgas } from "../../../chain/units";
import { callFromOutcome, contractHops, gasUse, illustrateFailure, varsFor } from "./call";
import { meterParts } from "./parts";
import { RECORDED } from "./recorded";

async function order(outOfStock = false) {
  const chain = new DemoChain({ pace: "instant" });
  const out = await callMethod(
    chain,
    DEMO_BUYER,
    "order",
    { item: "notebook", out_of_stock: outOfStock },
    { gas: tgas(30), pace: "instant" },
  );
  return { chain, call: callFromOutcome(out, "demo") };
}

describe("a cross-contract call read from the chain", () => {
  it("runs as receipts in order across later blocks, on different shards", async () => {
    const { call } = await order();
    expect(call.ok).toBe(true);
    expect(call.caller).toBe(DEMO_BUYER);
    expect(call.callee).toBe(DEMO_SHOP);
    const hops = contractHops(call);
    expect(hops.map((h) => [h.to, h.method, h.kind])).toEqual([
      [DEMO_BUYER, "order", "call"],
      [DEMO_SHOP, "buy", "call"],
      [DEMO_BUYER, "on_order_completed", "callback"],
    ]);
    // Each hop waits for a later block.
    const heights = [call.hops[0]!.blockHeight, ...hops.map((h) => h.blockHeight)];
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1]!);
    // Caller and shop sit on different shards.
    expect(hops[0]!.shardId).not.toBe(hops[1]!.shardId);
    expect(call.receiptHops).toBe(2);
  });

  it("adds up the gas each contract burnt (all of it burned: no 30% contract reward since protocol 87)", async () => {
    const { call } = await order();
    const g = gasUse(call);
    const sum = contractHops(call).reduce((s, h) => s + h.gasBurnt, 0n);
    expect(g.contractGas).toBe(sum);
    expect(g.byContract.map((c) => c.accountId).sort()).toEqual([DEMO_BUYER, DEMO_SHOP].sort());
    expect(g.byContract.reduce((s, c) => s + c.gas, 0n)).toBe(sum);
    for (const c of g.byContract) expect(c.gas).toBeGreaterThan(0n);
    expect(g).not.toHaveProperty("rebate");
    expect(g.total).toBeGreaterThanOrEqual(sum);
  });

  it("a failing shop leaves the caller's receipt committed; the callback undoes the reservation", async () => {
    const { chain, call } = await order(true);
    const [a, b, cb] = contractHops(call);
    expect(a!.ok).toBe(true);
    expect(b!.ok).toBe(false);
    expect(b!.note).toMatch(/Out of stock/);
    expect(cb!.ok).toBe(true);
    expect(cb!.note).toMatch(/undid/);
    expect((await chain.viewCall(DEMO_BUYER, "last_order")).result).toBe("refunded");
    expect((await chain.viewCall(DEMO_BUYER, "reserved")).result).toBeNull();
  });

  it("the gas meter has one burned part per contract, sized by its gas, A first", async () => {
    const { call } = await order();
    const parts = meterParts(call);
    const g = gasUse(call);
    expect(parts).toHaveLength(2);
    expect(parts[0]!.label).toMatch(/^A · buyer burned \d+\.\d\d Tgas$/);
    expect(parts[1]!.label).toMatch(/^B · shop burned \d+\.\d\d Tgas$/);
    expect(parts.reduce((s, p) => s + p.frac, 0)).toBeCloseTo(1);
    for (const p of parts) expect(p.frac).toBeGreaterThanOrEqual(0.2);
    expect(parts[0]!.label).toContain(formatTgas(g.byContract[0]!.gas));
    expect(parts.map((p) => [p.start, p.showLabel, p.align])).toEqual([
      [0, true, "start"],
      [parts[0]!.frac, true, "end"],
    ]);
  });

  it("gives a third contract its own letter and keeps its label off the crowded bar", async () => {
    const { call } = await order();
    const extra = { ...contractHops(call)[1]!, to: "third.demo.testnet", index: 99 };
    const parts = meterParts({ ...call, hops: [...call.hops, extra] });
    expect(parts.map((p) => p.label.split(" burned")[0])).toEqual(["A · buyer", "B · shop", "C · third"]);
    expect(parts.map((p) => p.showLabel)).toEqual([true, false, true]);
    expect(parts[2]!.start + parts[2]!.frac).toBeCloseTo(1);
  });

  it("gives the learner's numbers for the captions", async () => {
    const { call } = await order();
    const v = varsFor(call);
    const hops = contractHops(call);
    expect(v.firstBlock).toBe(hops[1]!.blockHeight.toLocaleString("en-US"));
    expect(v.secondBlock).toBe(hops[2]!.blockHeight.toLocaleString("en-US"));
    expect(v.gasSpent).toMatch(/^\d+\.\d\d$/);
    expect(v).not.toHaveProperty("rebate");
  });
});

describe("the recorded testnet call", () => {
  it("is a real call across three shards with a callback", () => {
    const hops = contractHops(RECORDED);
    expect(RECORDED.source).toBe("recorded");
    expect(hops.map((h) => h.kind)).toEqual(["call", "call", "callback"]);
    expect(new Set(hops.map((h) => h.shardId)).size).toBe(2);
    expect(RECORDED.hops[0]!.shardId).toBe(9);
    expect(RECORDED.receiptHops).toBe(2);
  });

  it("its failure is only an illustration, marked as such", () => {
    const f = illustrateFailure(RECORDED);
    expect(f.source).toBe("illustration");
    expect(f.ok).toBe(false);
    const [, b, cb] = contractHops(f);
    expect(b!.ok).toBe(false);
    expect(cb!.ok).toBe(true);
  });
});
