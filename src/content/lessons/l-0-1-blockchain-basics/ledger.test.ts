import { describe, expect, it } from "vitest";
import {
  balances,
  blockHash,
  compareCopies,
  DEFAULT_TXS,
  fillTo,
  genesisChain,
  hashOfText,
  repairNext,
  restampAll,
  send,
  shortHash,
  tamperAmount,
  verify,
  ZERO_HASH,
  type Chain,
} from "./ledger";

/** The default chain from the script: genesis + Ana->Ben 3, Ben->Cora 2, Cora->Ana 1. */
function defaultChain(): Chain {
  let c = genesisChain();
  for (const tx of DEFAULT_TXS) {
    const r = send(c, tx);
    if (!r.ok) throw new Error(r.reason);
    c = r.chain;
  }
  return c;
}

describe("toy ledger hashes (fixtures from docs/lessons/stage-0/0.1.md)", () => {
  it("hashes sha256(height|prev|txText) as lowercase hex", () => {
    const h = blockHash(0, ZERO_HASH, "genesis: Ana=10, Ben=5, Cora=0");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(shortHash(h)).toBe("ec402b30");
  });

  it("matches the script's recorded hashes for the default chain", () => {
    const { computed } = verify(defaultChain());
    expect(computed.map(shortHash)).toEqual(["ec402b30", "cfb1f067", "744f6e9c", "c9d091cb"]);
  });

  it("matches Web Crypto SHA-256", async () => {
    const input = `1|${blockHash(0, ZERO_HASH, "genesis: Ana=10, Ben=5, Cora=0")}|Ana->Ben 3`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(hex).toBe(verify(defaultChain()).computed[1]);
  });

  it("matches the tamper fixture: every hash after #0 changes and every later link breaks", () => {
    const bad = tamperAmount(defaultChain(), 1, 9);
    expect(bad[1]!.text).toBe("Ana->Ben 9");
    const v = verify(bad);
    expect(v.computed.map(shortHash)).toEqual(["ec402b30", "c0fed3ed", "10805a80", "cba6509e"]);
    // links[i] is the link from block i-1 to block i.
    expect(v.links).toEqual([true, true, false, false]);
    expect(v.allLaterBroken(1)).toBe(true);
  });

  it("the sandbox hash of block #1's text matches the block, and changes with the text", () => {
    const c = defaultChain();
    expect(shortHash(hashOfText(c, 1, "Ana->Ben 3"))).toBe("cfb1f067");
    expect(shortHash(hashOfText(c, 1, "Ana->Ben 4"))).not.toBe("cfb1f067");
  });
});

describe("sending", () => {
  it("moves coins and adds one block per transaction", () => {
    const r = send(genesisChain(), { from: "Ana", to: "Ben", amount: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chain).toHaveLength(2);
    expect(r.chain[1]!.prev).toBe(verify(genesisChain()).computed[0]);
    expect(balances(r.chain)).toEqual({ Ana: 7, Ben: 8, Cora: 0 });
    expect(balances(defaultChain())).toEqual({ Ana: 8, Ben: 6, Cora: 1 });
  });

  it("rejects an amount above the sender's balance and changes nothing", () => {
    const c = genesisChain();
    const r = send(c, { from: "Ana", to: "Ben", amount: 11 });
    expect(r).toEqual({ ok: false, reason: "Rejected: Ana only has 10" });
  });

  it("rejects nonsense kindly", () => {
    const c = genesisChain();
    expect(send(c, { from: "Ana", to: "Ana", amount: 1 })).toMatchObject({ ok: false });
    expect(send(c, { from: "Ana", to: "Ben", amount: 0 })).toMatchObject({ ok: false });
    expect(send(c, { from: "Ana", to: "Ben", amount: 1.5 })).toMatchObject({ ok: false });
    expect(send(c, { from: "Ana", to: "Ben", amount: Number.NaN })).toMatchObject({ ok: false });
  });

  it("fillTo adds the default transactions, or a 1-coin one when a default is rejected", () => {
    expect(fillTo(genesisChain(), 4).map((b) => b.text)).toEqual([
      "genesis: Ana=10, Ben=5, Cora=0",
      "Ana->Ben 3",
      "Ben->Cora 2",
      "Cora->Ana 1",
    ]);
    const r = send(genesisChain(), { from: "Ben", to: "Ana", amount: 5 });
    if (!r.ok) throw new Error(r.reason);
    const filled = fillTo(r.chain, 4);
    expect(filled).toHaveLength(4);
    expect(verify(filled).links.every(Boolean)).toBe(true);
  });
});

describe("repairing and comparing copies", () => {
  it("repairNext fixes one link at a time until the chain is consistent again", () => {
    let c = tamperAmount(defaultChain(), 1, 9);
    c = repairNext(c);
    expect(verify(c).links).toEqual([true, true, true, false]);
    c = repairNext(c);
    expect(verify(c).links).toEqual([true, true, true, true]);
    expect(restampAll(tamperAmount(defaultChain(), 1, 9))).toEqual(c);
  });

  it("a tampered copy, even a repaired one, does not match the honest copies", () => {
    const honest = defaultChain();
    const ben = restampAll(tamperAmount(honest, 1, 9));
    expect(compareCopies(honest, honest)).toBe(true);
    expect(compareCopies(honest, ben)).toBe(false);
  });
});
