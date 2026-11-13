import { describe, expect, it } from "vitest";
import { AUTHORIZE, CONTRACT, MAP, SETTLE, SHARDS } from "./steps";
import {
  buildTrail,
  DEFAULT_NAME,
  evidenceBook,
  evidenceFor,
  intentFrom,
  LESSONS,
  pickResult,
  RECORDED_INTENT_ID,
  spotOf,
  STEP_LAYERS,
  stopsFor,
  type PickState,
} from "./trail";

const OWN = {
  [LESSONS.account]: { accountId: "ana.testnet", txHash: "acct1", mode: "testnet" },
  [LESSONS.transaction]: { txHash: "TxHashOfLesson03xxxxxxx", mode: "testnet" },
  [LESSONS.key]: { txHash: "KeyTxHashxxxxxxxxxxxx" },
  [LESSONS.shards]: { txHash: "t", source: "yours", shards: "9,4" },
  [LESSONS.contract]: { contractId: "counter.ana.testnet" },
  [LESSONS.signature]: { signatureReturned: "true", mpcTxHash: "MpcTxHashxxxxxxxxxx" },
  [LESSONS.solver]: { realSwapTxHash: "SwapTxHashxxxxxxxxxx", realSwapExecuted: "true", amountOut: "0.41" },
};

describe("intentFrom", () => {
  it("replays the recorded intent when the learner made no swap", () => {
    const i = intentFrom(undefined);
    expect(i.source).toBe("recorded");
    expect(i.txHash).toBe(RECORDED_INTENT_ID);
    expect(i.amountOut).toBe("20.27");
    expect(i.where).toMatch(/no trade happened/);
    // A dry-quote finish is not a swap either.
    expect(intentFrom({ finishedOn: "dry-run quote", realSwapExecuted: "false" }).source).toBe("recorded");
  });

  it("replays the learner's real swap, and says the USDC stays in NEAR Intents", () => {
    const i = intentFrom(OWN[LESSONS.solver]);
    expect(i.source).toBe("yours");
    expect(i.txHash).toBe("SwapTxHashxxxxxxxxxx");
    expect(i.where).toMatch(/NEAR Intents account \(intents\.near\), not on Arbitrum/);
  });

  it("marks a demo-wallet swap as simulated", () => {
    const i = intentFrom({
      realSwapTxHash: "demo-0001",
      realSwapExecuted: "false",
      simulatedSwap: "true (demo wallet, no real money)",
    });
    expect(i.source).toBe("demo-wallet");
    expect(i.where).toMatch(/No real money moved/);
  });
});

describe("buildTrail", () => {
  it("covers every stage from 0 to 4, each stop linking to a real lesson", () => {
    const t = buildTrail({});
    expect([...new Set(t.stops.map((s) => s.stage))]).toEqual([0, 1, 2, 3, 4]);
    for (const s of t.stops) {
      expect(s.lessonId).toMatch(/^l-\d-\d-/);
      expect(s.mine).toBe(false);
    }
    expect(t.name).toBe(DEFAULT_NAME);
  });

  it("uses the learner's own evidence where it exists", () => {
    const t = buildTrail(OWN);
    expect(t.name).toBe("ana.testnet");
    expect(t.stops.every((s) => s.mine)).toBe(true);
    expect(t.stops.find((s) => s.layer === "shards")!.value).toContain("9 → 4");
  });

  it("every step before the check stops at some layer, and the map at all of them", () => {
    const t = buildTrail({});
    expect(stopsFor(t, MAP)).toHaveLength(t.stops.length);
    for (const step of [AUTHORIZE, SHARDS, CONTRACT, SETTLE])
      expect(STEP_LAYERS[step]!.length).toBeGreaterThan(0);
  });
});

describe("evidenceBook", () => {
  it("merges early reports with the finished record", () => {
    const book = evidenceBook({
      evidence: { a: { x: "1", y: "1" } },
      completions: [
        { lessonId: "a", stage: 0, route: "newcomer", mode: "demo", completedAt: "", evidence: { y: "2" } },
      ],
    });
    expect(book.a).toEqual({ x: "1", y: "2" });
  });
});

describe("pickResult", () => {
  const base: PickState = {
    step: MAP,
    authorized: false,
    settle: "idle",
    name: "ana.testnet",
    intent: intentFrom(undefined),
  };
  it("the key and the mailbox sign at the authorize step", () => {
    expect(pickResult("key", { ...base, step: AUTHORIZE }).act).toBe("authorize");
    expect(pickResult("account", { ...base, step: AUTHORIZE }).act).toBe("authorize");
    expect(pickResult("key", { ...base, step: AUTHORIZE, authorized: true }).act).toBeUndefined();
  });
  it("says 'not yet' too early, and gives a detail after", () => {
    expect(pickResult("shards", base).notYet).toBe(true);
    expect(pickResult("verifier", base).notYet).toBe(true);
    expect(pickResult("destination", { ...base, step: CONTRACT, authorized: true }).notYet).toBe(true);
    const done = { ...base, step: SETTLE, authorized: true, settle: "done" as const };
    expect(pickResult("destination", done).act).toBeUndefined();
    expect(pickResult("destination", done).note).toContain("20.27 USDC");
  });
  it("the verifier says all its gas is burned (the 30% contract reward ended with protocol version 87)", () => {
    const note = pickResult("verifier", { ...base, step: CONTRACT, authorized: true }).note;
    expect(note).toMatch(/all the gas it burns is burned/i);
    expect(note).not.toMatch(/30%|70%/);
  });
  it("where the USDC lands starts the settlement at step 5", () => {
    expect(pickResult("destination", { ...base, step: SETTLE, authorized: true }).act).toBe("settle");
  });
  it("the signing nodes are a side note: they never act, and sign only when a payout must leave NEAR", () => {
    for (const step of [MAP, CONTRACT, SETTLE]) {
      const r = pickResult("signers", { ...base, step, authorized: step > MAP });
      expect(r.act).toBeUndefined();
      expect(r.notYet).toBeFalsy();
      expect(r.note).toMatch(/only when a payout must leave NEAR/);
    }
  });
});

describe("spotOf", () => {
  it("moves the parcel along the trail", () => {
    expect(spotOf(MAP, false, "idle")).toBe("home");
    expect(spotOf(AUTHORIZE, false, "idle")).toBe("home");
    expect(spotOf(AUTHORIZE, true, "idle")).toBe("shardA");
    expect(spotOf(SHARDS, true, "idle")).toBe("shardB");
    expect(spotOf(CONTRACT, true, "idle")).toBe("verifier");
    expect(spotOf(SETTLE, true, "idle")).toBe("verifier");
    expect(spotOf(SETTLE, true, "solver")).toBe("verifier");
    expect(spotOf(SETTLE, true, "done")).toBe("landed");
  });
});

describe("evidenceFor", () => {
  it("records the capstone, the intent and which layers were the learner's own", () => {
    expect(evidenceFor(buildTrail({}), "demo")).toEqual({
      capstoneComplete: "true",
      mode: "demo",
      txHash: RECORDED_INTENT_ID,
      intentSource: "recorded",
      mpcVerified: "false",
      stagesTraced: "0,1,2,3,4",
      ownLayers: "none",
    });
    const own = evidenceFor(buildTrail(OWN), "testnet");
    expect(own.mpcVerified).toBe("true");
    expect(own.ownLayers).toBe("transaction,account,key,shards,contract,solver,signature");
  });
});
