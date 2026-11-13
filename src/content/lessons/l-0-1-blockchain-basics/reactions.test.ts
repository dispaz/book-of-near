import { describe, expect, it } from "vitest";
import { Object3D } from "three";
import { genesisChain, send, START, verify, type Chain } from "./ledger";
import {
  balancesDetail,
  blockDetail,
  blockMotion,
  blockPick,
  BLOCK_PICK_SECONDS,
  NOTEBOOK_PICK_SECONDS,
  notebookMotion,
} from "./reactions";
import { BLOCKS, CHECK, COMPARE, HASH, HONEST, LINKS, NOTEBOOK, SEND, TAMPER } from "./useLedgerLesson";

function chainOf(n: number): Chain {
  let c = genesisChain();
  const txs = [
    { from: "Ana", to: "Ben", amount: 3 },
    { from: "Ben", to: "Cora", amount: 2 },
    { from: "Cora", to: "Ana", amount: 1 },
  ] as const;
  for (const tx of txs.slice(0, n - 1)) {
    const r = send(c, tx);
    if (!r.ok) throw new Error(r.reason);
    c = r.chain;
  }
  return c;
}

describe("balancesDetail", () => {
  it("reads the balances in a short line", () => {
    expect(balancesDetail(START)).toBe("Balances: Ana 10, Ben 5, Cora 0");
    expect(balancesDetail({ Ana: 7, Ben: 8, Cora: 0 })).toBe("Balances: Ana 7, Ben 8, Cora 0");
  });
});

describe("blockDetail", () => {
  it("names block #1's transaction, its hash and the hash it stores (the script's fixtures)", () => {
    const c = chainOf(2);
    const { computed } = verify(c);
    expect(blockDetail(c[1]!, computed[1]!)).toBe(
      "Block #1: Ana->Ben 3, hash cfb1f067, previous hash ec402b30",
    );
  });

  it("calls block #0 the genesis block with the starting balances", () => {
    const c = chainOf(1);
    const { computed } = verify(c);
    expect(blockDetail(c[0]!, computed[0]!)).toBe(
      `Block #0, the genesis block: Ana 10, Ben 5, Cora 0, hash ${computed[0]!.slice(0, 8)}`,
    );
  });
});

describe("blockPick", () => {
  it("says 'not yet' before the first transaction is sent", () => {
    expect(blockPick(SEND, 0, false)).toEqual({ kind: "not-yet", hint: "Send the transaction first" });
  });

  it("asks for the next page once sent but before blocks are opened", () => {
    expect(blockPick(SEND, 1, true)).toEqual({ kind: "not-yet", hint: "Press Next to open the block" });
  });

  it("opens blocks at steps 3 and 4 and peeks at the honest take", () => {
    expect(blockPick(BLOCKS, 1, true).kind).toBe("open");
    expect(blockPick(HASH, 1, true)).toEqual({ kind: "open", detail: true });
    expect(blockPick(HONEST, 2, true).kind).toBe("peek");
  });

  it("shows a detail once its step is done", () => {
    for (const step of [LINKS, CHECK]) expect(blockPick(step, 2, true)).toEqual({ kind: "detail" });
    expect(blockPick(TAMPER, 2, true)).toEqual({ kind: "detail" });
  });

  it("leaves block #1 at the tamper step to its amount field (no pick, so one ring)", () => {
    expect(blockPick(TAMPER, 1, true)).toEqual({ kind: "none" });
  });

  it("has no pick where no chain is drawn", () => {
    expect(blockPick(NOTEBOOK, 0, false).kind).toBe("none");
    expect(blockPick(COMPARE, 0, true).kind).toBe("none");
  });
});

describe("pick motions", () => {
  for (const [name, motion, seconds] of [
    ["notebook", notebookMotion, NOTEBOOK_PICK_SECONDS],
    ["block", blockMotion, BLOCK_PICK_SECONDS],
  ] as const) {
    it(`${name}: moves the object while it plays, then stops`, () => {
      const o = new Object3D();
      expect(motion(o, seconds / 2)).toBe(true);
      expect(o.position.length() + Math.abs(o.rotation.x)).toBeGreaterThan(0.05);
      expect(motion(new Object3D(), seconds + 0.01)).toBe(false);
    });

    it(`${name}: adds to the hover pose instead of replacing it`, () => {
      const o = new Object3D();
      o.position.y = 0.14;
      motion(o, 0.0001);
      expect(o.position.y).toBeCloseTo(0.14, 2);
    });
  }
});
