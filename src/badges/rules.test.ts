import { describe, expect, it } from "vitest";
import { registry } from "../app/registry";
import { isOpen } from "../progress/routes";
import type { CompletionRecord } from "../progress/types";
import { DEMO_STAGE_COUNT } from "../chain/demo/badges";
import { CLAIMABLE_BADGES, claimReadiness, STAGE_RULES } from "./rules";

const rec = (
  lessonId: string,
  mode: "demo" | "testnet",
  evidence?: Record<string, string>,
): CompletionRecord => ({
  lessonId,
  stage: Number(lessonId.split("-")[1]),
  route: "newcomer",
  mode,
  completedAt: "2026-11-12T00:00:00.000Z",
  ...(evidence ? { evidence } : {}),
});

const stage0 = (mode: "demo" | "testnet") => [
  rec("l-0-1-blockchain-basics", mode),
  rec("l-0-2-make-a-wallet", mode),
  rec("l-0-3-send-a-transaction", mode, { txHash: "H0" }),
];

describe("STAGE_RULES: the required lessons, in one place", () => {
  it("lists every lesson a learner can open in stages 0 to 7, and nothing planned", () => {
    for (const rule of STAGE_RULES) {
      const stage = registry.stages.find((s) => s.id === rule.stage)!;
      const open = stage.lessons.filter(isOpen).map((l) => l.id);
      expect(rule.lessons).toEqual(open);
    }
    expect(STAGE_RULES.map((r) => r.stage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("asks each evidence lesson for keys it really reports", () => {
    expect(STAGE_RULES[0]!.evidence).toEqual([
      { lessonId: "l-0-3-send-a-transaction", keys: ["txHash"], todo: expect.any(String) },
    ]);
    expect(STAGE_RULES[1]!.evidence.map((e) => [e.lessonId, e.keys])).toEqual([
      ["l-1-1-claim-your-name", ["txHash", "accountId"]],
      ["l-1-2-function-call-key", ["addKeyTxHash", "txHash"]],
    ]);
  });
});

describe("CLAIMABLE_BADGES: the total My book and the checker show", () => {
  it("counts the stages with a rule (0 to 6), the same stages the demo contract knows", () => {
    expect(CLAIMABLE_BADGES).toBe(8);
    expect(STAGE_RULES.map((r) => r.stage)).toEqual([...Array(CLAIMABLE_BADGES).keys()]);
    expect(DEMO_STAGE_COUNT).toBe(CLAIMABLE_BADGES);
  });
});

describe("claimReadiness", () => {
  it("is ready for stage 0 once its lessons are done and 0.3 has its transaction", () => {
    expect(claimReadiness(0, stage0("demo"), "demo")).toEqual({ ready: true, missing: [] });
  });

  it("names the lessons still to finish", () => {
    const r = claimReadiness(0, [rec("l-0-1-blockchain-basics", "demo")], "demo");
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => [m.lessonId, m.reason])).toEqual([
      ["l-0-2-make-a-wallet", "not-finished"],
      ["l-0-3-send-a-transaction", "not-finished"],
    ]);
    expect(r.missing[0]!.text).toMatch(/Finish lesson 0\.2/);
  });

  it("asks for the transaction when 0.3 was tested out (no evidence)", () => {
    const tested = stage0("demo").map((c) => ({ ...c, testedOut: true, evidence: undefined }));
    const r = claimReadiness(0, tested, "demo");
    expect(r.missing).toEqual([
      { lessonId: "l-0-3-send-a-transaction", reason: "no-evidence", text: expect.stringMatching(/0\.3/) },
    ]);
  });

  it("refuses a testnet badge for a stage done only in demo mode, and says why", () => {
    const r = claimReadiness(0, stage0("demo"), "testnet");
    expect(r.ready).toBe(false);
    expect(r.missing[0]).toMatchObject({ lessonId: "l-0-3-send-a-transaction", reason: "demo-only" });
    expect(r.missing[0]!.text).toMatch(/demo mode/);
    expect(claimReadiness(0, stage0("testnet"), "testnet").ready).toBe(true);
  });

  it("stage 1 needs the name (1.1) and the key's add and delete (1.2)", () => {
    const base = [
      rec("l-1-1-claim-your-name", "demo", { txHash: "A", accountId: "me.testnet" }),
      rec("l-1-3-inside-a-transaction", "demo"),
    ];
    const noKey = claimReadiness(
      1,
      [...base, rec("l-1-2-function-call-key", "demo", { txHash: "D" })],
      "demo",
    );
    expect(noKey.missing.map((m) => m.reason)).toEqual(["no-evidence"]);
    const all = claimReadiness(
      1,
      [...base, rec("l-1-2-function-call-key", "demo", { txHash: "D", addKeyTxHash: "K" })],
      "demo",
    );
    expect(all.ready).toBe(true);
  });

  it("stage 5 needs lessons 5.1 and 5.2 and nothing on chain: neither lesson sends a transaction", () => {
    expect(STAGE_RULES[5]).toEqual({
      stage: 5,
      lessons: ["l-5-1-private-ai", "l-5-2-agent-with-no-owner"],
      evidence: [],
    });
    const one = claimReadiness(5, [rec("l-5-1-private-ai", "demo")], "demo");
    expect(one.missing).toEqual([
      { lessonId: "l-5-2-agent-with-no-owner", reason: "not-finished", text: "Finish lesson 5.2." },
    ]);
    const both = [rec("l-5-1-private-ai", "demo"), rec("l-5-2-agent-with-no-owner", "demo")];
    expect(claimReadiness(5, both, "demo")).toEqual({ ready: true, missing: [] });
    // No evidence to redo on testnet; the badge contract still needs the stage 4 badge first.
    expect(claimReadiness(5, both, "testnet").ready).toBe(true);
  });
});

describe("stage 6: a practice vote and recorded data, accepted in demo mode", () => {
  const stage6 = (mode: "demo" | "testnet") => [
    rec("l-6-1-vote-on-a-proposal", mode, {
      proposalId: "42",
      voteCast: "true",
      choice: "yes",
      power: "300",
      kind: "practice",
    }),
    rec("l-6-2-live-money-map", mode, { pair: "USDC/USDt", amountIn: "100000", kind: "recorded" }),
  ];

  it("is ready once 6.1's practice vote and 6.2's trade are recorded", () => {
    expect(claimReadiness(6, stage6("demo"), "demo")).toEqual({ ready: true, missing: [] });
  });

  it("asks for each lesson's step when it was tested out", () => {
    const tested = stage6("demo").map((c) => ({ ...c, evidence: undefined }));
    expect(claimReadiness(6, tested, "demo").missing.map((m) => m.text)).toEqual([
      "Cast your practice vote in lesson 6.1.",
      "Trade 100,000 USDC in the two pools in lesson 6.2.",
    ]);
  });

  it("names lesson 6.2 when only 6.1 is done", () => {
    const r = claimReadiness(6, stage6("demo").slice(0, 1), "demo");
    expect(r.missing).toEqual([
      { lessonId: "l-6-2-live-money-map", reason: "not-finished", text: "Finish lesson 6.2." },
    ]);
  });
});

describe("stage 7: the settled trace and the read scoreboard, no testnet transaction", () => {
  const stage7 = (mode: "demo" | "testnet") => [
    rec("l-7-1-trace-an-intent", mode, {
      capstoneComplete: "true",
      mode,
      txHash: "recorded-demo-intent",
      intentSource: "recorded",
      mpcVerified: "false",
      stagesTraced: "0,1,2,3,4",
      ownLayers: "none",
    }),
    rec("l-7-2-honest-scoreboard", mode, { scoreboardReviewed: "true", recordedOn: "2026-11-13" }),
  ];

  it("needs lessons 7.1 and 7.2 and asks for no transaction hash", () => {
    const rule = STAGE_RULES.find((r) => r.stage === 7)!;
    expect(rule.lessons).toEqual(["l-7-1-trace-an-intent", "l-7-2-honest-scoreboard"]);
    expect(rule.evidence.map((e) => [e.lessonId, e.keys])).toEqual([
      ["l-7-1-trace-an-intent", ["capstoneComplete"]],
      ["l-7-2-honest-scoreboard", ["scoreboardReviewed"]],
    ]);
  });

  it("is ready once 7.1 is settled and 7.2 is read, even with the recorded intent", () => {
    expect(claimReadiness(7, stage7("demo"), "demo")).toEqual({ ready: true, missing: [] });
    expect(claimReadiness(7, stage7("testnet"), "testnet")).toEqual({ ready: true, missing: [] });
  });

  it("asks for each lesson's step when it was tested out, and names 7.2 when only 7.1 is done", () => {
    const tested = stage7("demo").map((c) => ({ ...c, evidence: undefined }));
    expect(claimReadiness(7, tested, "demo").missing.map((m) => m.text)).toEqual([
      "Trace the intent to its settlement in lesson 7.1.",
      "Open all four scoreboard cards in lesson 7.2.",
    ]);
    expect(claimReadiness(7, stage7("demo").slice(0, 1), "demo").missing).toEqual([
      { lessonId: "l-7-2-honest-scoreboard", reason: "not-finished", text: "Finish lesson 7.2." },
    ]);
  });
});
