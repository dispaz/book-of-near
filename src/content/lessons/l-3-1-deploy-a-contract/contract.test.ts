import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseNear } from "../../../chain/units";
import {
  availableOf,
  bytesText,
  contractIdFor,
  gaugeOf,
  nearText,
  newParentName,
  storageLock,
  wasmFacts,
} from "./contract";

const wasm = new Uint8Array(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../../contracts/counter/counter.wasm")),
);

describe("storage staking numbers", () => {
  it("locks 1 NEAR per 100 KB: 10^19 yoctoNEAR per byte", () => {
    expect(storageLock(100_000)).toBe(parseNear("1"));
    expect(storageLock(2_326)).toBe(parseNear("0.02326"));
  });

  it("available = balance minus the storage deposit not covered by staking", () => {
    const view = { amount: parseNear("0.05"), locked: 0n, storageUsage: 2_326 };
    expect(availableOf(view)).toBe(parseNear("0.02674"));
    expect(availableOf({ ...view, locked: parseNear("1") })).toBe(parseNear("0.05"));
  });

  it("splits the account's balance into locked and available shares for the gauge", () => {
    const g = gaugeOf({ amount: parseNear("0.05"), locked: 0n, storageUsage: 2_500 });
    expect(g.lock).toBe(parseNear("0.025"));
    expect(g.available).toBe(parseNear("0.025"));
    expect(g.share).toBeCloseTo(0.5, 3);
    expect(gaugeOf(null)).toEqual({ lock: 0n, available: 0n, share: 0 });
  });

  it("writes NEAR and bytes for people", () => {
    expect(nearText(parseNear("0.02326"))).toBe("0.02326");
    expect(nearText(parseNear("0.00051"))).toBe("0.00051");
    expect(bytesText(2134)).toBe("2,134 bytes");
    expect(bytesText(1)).toBe("1 byte");
  });
});

describe("where the contract lives", () => {
  it("puts it under a named account", () => {
    expect(contractIdFor("bon-abc123.testnet")).toBe("counter.bon-abc123.testnet");
  });

  it("cannot put it under a hex (implicit) account: the id would pass 64 characters", () => {
    expect(contractIdFor("cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5")).toBeNull();
    expect(contractIdFor(`${"a".repeat(60)}.testnet`)).toBeNull();
  });

  it("makes a short, valid parent name", () => {
    const id = newParentName(() => 0.5);
    expect(id).toMatch(/^bon-[a-z0-9]{8}\.testnet$/);
    expect(contractIdFor(id)).toBe(`counter.${id}`);
  });
});

describe("the Wasm file", () => {
  it("reads the real counter's size and its \\0asm header", () => {
    const f = wasmFacts(wasm);
    expect(f.size).toBe(wasm.length);
    expect(f.size).toBeGreaterThan(1000);
    expect(f.size).toBeLessThan(4096);
    expect(f.isWasm).toBe(true);
    expect(f.header).toBe("00 61 73 6d 01 00 00 00");
  });
});
