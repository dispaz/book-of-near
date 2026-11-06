import { describe, expect, it } from "vitest";
import { parseNear } from "../../../chain/units";
import type { TxOutcome } from "../../../chain/types";
import {
  fates,
  hasAllKinds,
  move,
  readAmount,
  readLabel,
  toActions,
  workshopLabel,
  type Item,
} from "./batch";

const items = (...kinds: Item["kind"][]): Item[] => kinds.map((kind, i) => ({ id: i + 1, kind }));

describe("workshop account name", () => {
  it("takes the first six letters or digits of the practice account", () => {
    expect(workshopLabel("98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de")).toBe(
      "tx-98793c",
    );
    expect(workshopLabel("bon-mvxj55ov.testnet")).toBe("tx-bonmvx");
  });
  it("adds a number when the first try is taken", () => {
    expect(workshopLabel("bon-mvxj55ov.testnet", 2)).toBe("tx-bonmvx-2");
  });
});

describe("the new account's name", () => {
  it("makes a sub-account of the workshop account", () => {
    expect(readLabel("shop", "tx-abc.testnet")).toEqual({ ok: true, id: "shop.tx-abc.testnet" });
    expect(readLabel("  Cafe ", "tx-abc.testnet")).toEqual({ ok: true, id: "cafe.tx-abc.testnet" });
  });
  it("says what is wrong in plain words", () => {
    expect(readLabel("", "tx-abc.testnet")).toMatchObject({ ok: false });
    const dot = readLabel("a.b", "tx-abc.testnet");
    expect(dot.ok).toBe(false);
    expect(!dot.ok && dot.problem).toMatch(/dot/);
    expect(readLabel("bad name", "tx-abc.testnet").ok).toBe(false);
  });
});

describe("the amount", () => {
  it("accepts 0.01 to 0.05 NEAR", () => {
    expect(readAmount("0.02")).toEqual({ ok: true, amount: parseNear("0.02") });
    expect(readAmount("0.05").ok).toBe(true);
    expect(readAmount("0.001").ok).toBe(false);
    expect(readAmount("1").ok).toBe(false);
    expect(readAmount("abc").ok).toBe(false);
  });
});

describe("the builder", () => {
  it("moves an action up or down, and not past the ends", () => {
    const list = items("transfer", "create", "addkey");
    expect(move(list, 1, -1).map((i) => i.kind)).toEqual(["create", "transfer", "addkey"]);
    expect(move(list, 0, -1)).toEqual(list);
    expect(move(list, 2, 1)).toEqual(list);
  });

  it("knows when the batch has all three kinds", () => {
    expect(hasAllKinds(items("create", "transfer", "addkey"))).toBe(true);
    expect(hasAllKinds(items("create", "addkey"))).toBe(false);
  });

  it("turns items into chain actions, and 'again' repeats the last key", () => {
    const keys = ["ed25519:A", "ed25519:B"];
    const a = toActions(items("create", "transfer", "addkey", "again"), parseNear("0.02"), keys);
    expect(a.map((x) => x.type)).toEqual(["CreateAccount", "Transfer", "AddKey", "AddKey"]);
    expect(a[1]).toMatchObject({ deposit: parseNear("0.02") });
    expect(a[2]).toMatchObject({ publicKey: "ed25519:A" });
    expect(a[3]).toMatchObject({ publicKey: "ed25519:A" });
  });
});

describe("what happened to each action", () => {
  const ok = { status: { type: "SuccessValue", value: "" } } as TxOutcome;
  const failedAt = (index: number) =>
    ({
      status: {
        type: "Failure",
        error: {
          type: "ActionError",
          index,
          kind: { type: "FunctionCallError", message: "x" },
          message: "x",
        },
      },
    }) as TxOutcome;

  it("all done when the transaction succeeds", () => {
    expect(fates(3, ok)).toEqual(["done", "done", "done"]);
  });
  it("undone before the failure, failed at it, never ran after it", () => {
    expect(fates(4, failedAt(2))).toEqual(["undone", "undone", "failed", "skipped"]);
    expect(fates(3, failedAt(0))).toEqual(["failed", "skipped", "skipped"]);
  });
});
