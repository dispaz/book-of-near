/**
 * Runs the hand-written counter contract (contracts/counter/counter.wasm) in Node against a tiny
 * imitation of NEAR's host functions. The real network runs it in testnet.test.ts (opt-in).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const wasmPath = join(dirname(fileURLToPath(import.meta.url)), "../../../contracts/counter/counter.wasm");
const code = readFileSync(wasmPath);

interface Call {
  method: string;
  args?: unknown;
  self?: string;
  predecessor?: string;
  promiseResults?: (1 | 2)[];
}

class Panic extends Error {}

function harness() {
  const storage = new Map<string, Uint8Array>();
  const run = async (c: Call) => {
    const registers = new Map<bigint, Uint8Array>();
    const logs: string[] = [];
    const promises: { kind: string; account: string; method: string; gas: bigint; after?: bigint }[] = [];
    let returned: string | undefined;
    // eslint-disable-next-line prefer-const -- assigned once the module is instantiated below
    let mem!: WebAssembly.Memory;
    const bytes = (ptr: bigint, len: bigint) =>
      new Uint8Array(mem.buffer.slice(Number(ptr), Number(ptr) + Number(len)));
    const text = (ptr: bigint, len: bigint) => new TextDecoder().decode(bytes(ptr, len));
    const input = c.args === undefined ? new Uint8Array() : new TextEncoder().encode(JSON.stringify(c.args));
    const self = c.self ?? "counter.testnet";
    const env = {
      input: (r: bigint) => registers.set(r, input),
      register_len: (r: bigint) => BigInt(registers.get(r)?.length ?? -1),
      read_register: (r: bigint, ptr: bigint) =>
        new Uint8Array(mem.buffer).set(registers.get(r)!, Number(ptr)),
      value_return: (len: bigint, ptr: bigint) => (returned = text(ptr, len)),
      log_utf8: (len: bigint, ptr: bigint) => logs.push(text(ptr, len)),
      panic_utf8: (len: bigint, ptr: bigint) => {
        throw new Panic(text(ptr, len));
      },
      storage_write: (kl: bigint, kp: bigint, vl: bigint, vp: bigint) => {
        const had = storage.has(text(kp, kl));
        storage.set(text(kp, kl), bytes(vp, vl));
        return had ? 1n : 0n;
      },
      storage_read: (kl: bigint, kp: bigint, r: bigint) => {
        const v = storage.get(text(kp, kl));
        if (!v) return 0n;
        registers.set(r, v);
        return 1n;
      },
      current_account_id: (r: bigint) => registers.set(r, new TextEncoder().encode(self)),
      predecessor_account_id: (r: bigint) =>
        registers.set(r, new TextEncoder().encode(c.predecessor ?? "alice.testnet")),
      promise_create: (
        al: bigint,
        ap: bigint,
        ml: bigint,
        mp: bigint,
        _l: bigint,
        _p: bigint,
        amt: bigint,
        gas: bigint,
      ) => {
        expect(bytes(amt, 16n).every((b) => b === 0)).toBe(true);
        promises.push({ kind: "create", account: text(ap, al), method: text(mp, ml), gas });
        return BigInt(promises.length - 1);
      },
      promise_then: (
        idx: bigint,
        al: bigint,
        ap: bigint,
        ml: bigint,
        mp: bigint,
        _l: bigint,
        _p: bigint,
        _a: bigint,
        gas: bigint,
      ) => {
        promises.push({ kind: "then", account: text(ap, al), method: text(mp, ml), gas, after: idx });
        return BigInt(promises.length - 1);
      },
      promise_results_count: () => BigInt(c.promiseResults?.length ?? 0),
      promise_result: (i: bigint) => BigInt(c.promiseResults?.[Number(i)] ?? 0),
      promise_return: () => undefined,
    };
    const { instance } = await WebAssembly.instantiate(code, { env });
    mem = instance.exports.memory as WebAssembly.Memory;
    (instance.exports[c.method] as () => void)();
    return {
      returned: returned === undefined ? undefined : (JSON.parse(returned) as unknown),
      logs,
      promises,
    };
  };
  return { run, storage };
}

describe("counter contract (Wasm)", () => {
  it("is small and exports the counter's methods", async () => {
    expect(code.length).toBeLessThan(4096);
    const mod = await WebAssembly.compile(code);
    const names = WebAssembly.Module.exports(mod).map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining(["increment", "get_num", "fail", "call_other", "on_other_done", "last_result"]),
    );
  });

  it("counts up by 1 or by `by`, logs, and returns the count", async () => {
    const h = harness();
    expect((await h.run({ method: "get_num" })).returned).toBe(0);
    const a = await h.run({ method: "increment", args: {} });
    expect(a.returned).toBe(1);
    expect(a.logs).toEqual(["Count is now 1"]);
    const b = await h.run({ method: "increment", args: { by: 1234567 } });
    expect(b.returned).toBe(1234568);
    expect(b.logs).toEqual(["Count is now 1234568"]);
    expect((await h.run({ method: "increment" })).returned).toBe(1234569);
    expect((await h.run({ method: "get_num" })).returned).toBe(1234569);
  });

  it("fails on purpose", async () => {
    await expect(harness().run({ method: "fail" })).rejects.toThrow("This method always fails");
  });

  it("calls another contract, then itself back", async () => {
    const out = await harness().run({
      method: "call_other",
      args: { account_id: "other.testnet", method_name: "fail" },
    });
    expect(out.logs).toEqual(["Calling fail on other.testnet"]);
    expect(out.promises).toEqual([
      { kind: "create", account: "other.testnet", method: "fail", gas: 20_000_000_000_000n },
      {
        kind: "then",
        account: "counter.testnet",
        method: "on_other_done",
        gas: 20_000_000_000_000n,
        after: 0n,
      },
    ]);
    const dflt = await harness().run({ method: "call_other", args: { account_id: "other.testnet" } });
    expect(dflt.promises[0]!.method).toBe("increment");
    await expect(harness().run({ method: "call_other", args: {} })).rejects.toThrow("expected account_id");
  });

  it("records the other call's result in the callback, which only it may call", async () => {
    const h = harness();
    expect((await h.run({ method: "last_result" })).returned).toBe(null);
    const self = { self: "counter.testnet", predecessor: "counter.testnet" };
    const bad = await h.run({ method: "on_other_done", ...self, promiseResults: [2] });
    expect(bad.returned).toBe(false);
    expect(bad.logs).toEqual(["The other call failed, so nothing changed there"]);
    expect((await h.run({ method: "last_result" })).returned).toBe("failed");
    const good = await h.run({ method: "on_other_done", ...self, promiseResults: [1] });
    expect(good.returned).toBe(true);
    expect((await h.run({ method: "last_result" })).returned).toBe("ok");
    await expect(h.run({ method: "on_other_done", promiseResults: [1] })).rejects.toThrow(
      "Only the contract itself may call this",
    );
  });
});
