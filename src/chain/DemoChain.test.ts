import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58, base64 } from "@scure/base";
import { COUNTER_WASM_BASE64 } from "./counterWasm";
import { describe, expect, it } from "vitest";
import { recordScenario, runChainContract } from "./contract.test-kit";
import { COUNTER_WASM_SHA256 } from "./demo/contracts";
import { DEMO_RETURN_ACCOUNT, DemoChain, demoContractCode, GENESIS_HEIGHT } from "./DemoChain";
import { actions, callMethod, createNamedAccount, totalGasBurnt, totalTokensBurnt, transfer } from "./ops";
import type { PhaseEvent } from "./types";
import { formatNear, formatTgas, parseNear } from "./units";

const counterCode = demoContractCode("counter");

runChainContract(() => new DemoChain({ pace: "instant" }), { counterCode });

describe("DemoChain determinism", () => {
  it("gives identical results when the same checks run twice", async () => {
    const a = await recordScenario(new DemoChain({ pace: "instant" }), counterCode);
    const b = await recordScenario(new DemoChain({ pace: "instant" }), counterCode);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(1000);
  });

  it("gives different hashes for a different seed", async () => {
    const a = await recordScenario(new DemoChain({ pace: "instant", seed: "one" }), counterCode);
    const b = await recordScenario(new DemoChain({ pace: "instant", seed: "two" }), counterCode);
    expect(a).not.toBe(b);
  });
});

describe("DemoChain demo data (docs/lessons/stage-0/0.3.md)", () => {
  it("matches the 0.3 transfer: 0.45 Tgas, ~0.000045 NEAR fee, timings 250/850/1450/3250 ms", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const me = await chain.practiceAccount();
    expect(me.accountId).toBe("cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5");
    const out = await transfer(chain, "book-of-near.testnet", parseNear("0.01"));
    expect(formatTgas(totalGasBurnt(out))).toBe("0.45");
    expect(formatNear(totalTokensBurnt(out), 6)).toBe("0.000044");
    expect(out.transactionOutcome.blockHeight).toBe(GENESIS_HEIGHT + 1);
    expect(out.timings).toEqual({
      built: 0,
      signed: 0,
      broadcast: 250,
      included: 850,
      executed: 1450,
      final: 3250,
    });
    expect(formatNear((await chain.viewAccount(me.accountId)).amount, 5)).toBe("4.98995");
  });

  it("waits the recorded timings in realtime mode", async () => {
    const waits: number[] = [];
    const chain = new DemoChain({
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    const events: PhaseEvent[] = [];
    await transfer(chain, "book-of-near.testnet", 1n, { onPhase: (e) => events.push(e) });
    expect(waits).toEqual([250, 600, 600, 1800]);
    expect(events.map((e) => e.atMs)).toEqual([0, 0, 250, 850, 1450, 3250]);
  });

  it("spreads accounts over six shards", async () => {
    const layout = await new DemoChain().shardLayout();
    expect(layout.shardIds).toHaveLength(6);
  });
});

describe("returnAccount", () => {
  it("is the app's return account in demo mode", async () => {
    expect(await new DemoChain({ seed: "r" }).returnAccount()).toBe(DEMO_RETURN_ACCOUNT);
  });
});

describe("DemoChain runs the real counter.wasm (lesson 3.1)", () => {
  const wasm = new Uint8Array(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../contracts/counter/counter.wasm")),
  );

  it("knows the committed Wasm by its hash", () => {
    expect(COUNTER_WASM_SHA256).toBe(base58.encode(sha256(wasm)));
  });

  it("bundles the same bytes for lessons (src/chain/counterWasm.ts)", () => {
    expect(base64.decode(COUNTER_WASM_BASE64)).toEqual(wasm);
  });

  it("installs the counter when the real Wasm is deployed, and stakes storage for its bytes", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const parentKey = await chain.newKeyPair();
    await createNamedAccount(chain, "maker.testnet", parentKey, parseNear("1"), { pace: "instant" });
    const key = await chain.newKeyPair();
    const id = "counter.maker.testnet";
    const out = await chain.sendTransaction(
      {
        signerId: "maker.testnet",
        receiverId: id,
        actions: [
          actions.createAccount(),
          actions.transfer(parseNear("0.1")),
          actions.addFullAccessKey(key),
          actions.deployContract(wasm),
        ],
      },
      { pace: "instant" },
    );
    expect(out.status.type).not.toBe("Failure");
    const before = await chain.viewAccount(id);
    expect(before.storageUsage).toBeGreaterThan(wasm.length);
    await callMethod(chain, id, "increment", {}, { pace: "instant" });
    expect((await chain.viewCall(id, "get_num")).result).toBe(1);
    const grown = await chain.viewAccount(id);
    expect(grown.storageUsage).toBeGreaterThan(before.storageUsage);
    const reset = await callMethod(chain, id, "reset", {}, { pace: "instant" });
    expect(reset.receipts.flatMap((r) => r.logs)).toContain("State cleared");
    expect((await chain.viewCall(id, "get_num")).result).toBe(0);
    expect((await chain.viewAccount(id)).storageUsage).toBe(before.storageUsage);
  });
});
