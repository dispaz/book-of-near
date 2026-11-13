import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ed25519 } from "@noble/curves/ed25519.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base58, base64 } from "@scure/base";
import { describe, expect, it, vi } from "vitest";
import { registry } from "../app/registry";
import { DemoChain } from "../chain/DemoChain";
import { DEMO_CLAIM_PUBLIC_KEY } from "../chain/demo/badges";
import type { Chain } from "../chain/types";
import { ANSWER_KEY } from "./answerKey";
import { EXAM_QUESTIONS, questionsFor } from "./bank";
import { submitExam, readExamGate } from "./examFlow";
import { examMessage, gradeExam, validPicks, type Picks } from "./grade";
import { badgeList, EXAM_ROUTE_INFO, EXAM_ROUTES, examGate, examRouteFor, passMark } from "./routes";

const rightPicks = (route: "general" | "developer"): Picks =>
  questionsFor(route).map((q) => ANSWER_KEY[q.id]!.answer);
/** The right picks with the first `wrong` questions answered wrongly. */
const withWrong = (route: "general" | "developer", wrong: number): Picks =>
  rightPicks(route).map((p, i) => (i < wrong ? (p! + 1) % questionsFor(route)[i]!.options.length : p));

describe("question bank and answer key", () => {
  it("gives each route 15 questions and no question to both routes", () => {
    for (const r of EXAM_ROUTES) expect(questionsFor(r)).toHaveLength(15);
    expect(new Set(EXAM_QUESTIONS.map((q) => q.id)).size).toBe(EXAM_QUESTIONS.length);
  });

  it("has one key entry per question, with a valid answer and a reason for every option", () => {
    expect(Object.keys(ANSWER_KEY).sort()).toEqual(EXAM_QUESTIONS.map((q) => q.id).sort());
    for (const q of EXAM_QUESTIONS) {
      const k = ANSWER_KEY[q.id]!;
      expect(k.answer, q.id).toBeGreaterThanOrEqual(0);
      expect(k.answer, q.id).toBeLessThan(q.options.length);
      expect(k.why, q.id).toHaveLength(q.options.length);
      for (const w of k.why) expect(w.trim().length, q.id).toBeGreaterThan(0);
    }
  });

  it("does not always put the right answer in the same place", () => {
    for (const r of EXAM_ROUTES) {
      const places = new Set(rightPicks(r));
      expect(places.size, r).toBeGreaterThanOrEqual(3);
    }
  });

  it("carries no answers: the shipped questions are prompts and option texts only", () => {
    for (const q of EXAM_QUESTIONS) {
      expect(Object.keys(q).sort()).toEqual(["id", "lessonId", "options", "prompt", "route", "stage"]);
      for (const o of q.options) expect(typeof o).toBe("string");
    }
  });

  it("asks only about lessons a learner can open, from the route's stages", () => {
    const open = new Map(
      registry.stages.flatMap((s) =>
        s.lessons.filter((l) => l.status !== "planned").map((l) => [l.id, s.id]),
      ),
    );
    for (const q of EXAM_QUESTIONS) {
      expect(open.get(q.lessonId), `${q.id} → ${q.lessonId}`).toBe(q.stage);
      expect(EXAM_ROUTE_INFO[q.route].questionStages, q.id).toContain(q.stage);
    }
    // Only the developer route asks about the builder stage.
    expect(questionsFor("general").some((q) => q.stage === 3)).toBe(false);
    expect(questionsFor("developer").filter((q) => q.stage === 3).length).toBeGreaterThan(0);
  });

  it("does not bring back facts the lessons corrected", () => {
    const right = EXAM_QUESTIONS.map((q) => q.options[ANSWER_KEY[q.id]!.answer]!).join("\n");
    expect(right).not.toMatch(/30%/);
  });
});

describe("answerKey.ts stays out of the app bundle", () => {
  const src = join(dirname(fileURLToPath(import.meta.url)), "..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
    });

  /** A static, non-type import or re-export of answerKey: `import x from`, `export … from`, `import "…"`. */
  const staticKeyImport = (text: string) =>
    /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["'][^"']*answerKey(?:\.tsx?)?["']/m.test(text) ||
    /^\s*import\s+["'][^"']*answerKey(?:\.tsx?)?["']/m.test(text);

  it("catches every form of static import", () => {
    expect(staticKeyImport('import { ANSWER_KEY } from "./answerKey";')).toBe(true);
    expect(staticKeyImport('import {\n  ANSWER_KEY,\n} from "../exam/answerKey.ts";')).toBe(true);
    expect(staticKeyImport('export { ANSWER_KEY } from "./answerKey";')).toBe(true);
    expect(staticKeyImport('export * from "./answerKey";')).toBe(true);
    expect(staticKeyImport('import "./answerKey";')).toBe(true);
    expect(staticKeyImport('import type { KeyEntry } from "./answerKey";')).toBe(false);
    expect(staticKeyImport('export type { KeyEntry } from "./answerKey";')).toBe(false);
    expect(staticKeyImport('const k = await import("./answerKey");')).toBe(false);
  });

  it("is only ever imported with import() or as types, outside tests", () => {
    const offenders = files(src)
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => staticKeyImport(readFileSync(f, "utf8")))
      .map((f) => relative(src, f));
    expect(offenders).toEqual([]);
  });
});

describe("grading", () => {
  const qs = questionsFor("general");

  it("passes at 12 of 15 and not at 11", () => {
    expect(passMark(15)).toBe(12);
    expect(gradeExam(qs, ANSWER_KEY, rightPicks("general"))).toMatchObject({ score: 15, passed: true });
    expect(gradeExam(qs, ANSWER_KEY, withWrong("general", 3))).toMatchObject({
      score: 12,
      total: 15,
      passMark: 12,
      passed: true,
    });
    expect(gradeExam(qs, ANSWER_KEY, withWrong("general", 4))).toMatchObject({ score: 11, passed: false });
  });

  it("explains each answer, and a wrong pick too", () => {
    const g = gradeExam(qs, ANSWER_KEY, withWrong("general", 1));
    const [first, second] = g.results;
    expect(first).toMatchObject({ correct: false, why: expect.any(String), whyPicked: expect.any(String) });
    expect(first!.whyPicked).not.toBe(first!.why);
    expect(second).toMatchObject({ correct: true });
    expect(second!.whyPicked).toBeUndefined();
  });

  it("counts a blank answer as wrong", () => {
    const picks = rightPicks("general");
    picks[0] = null;
    const g = gradeExam(qs, ANSWER_KEY, picks);
    expect(g.score).toBe(14);
    expect(g.results[0]).toMatchObject({ picked: null, correct: false });
  });

  it("accepts only one pick (or null) per question, in range", () => {
    expect(validPicks(qs, rightPicks("general"))).toBe(true);
    expect(validPicks(qs, rightPicks("general").slice(1))).toBe(false);
    expect(
      validPicks(
        qs,
        qs.map(() => 7),
      ),
    ).toBe(false);
    expect(
      validPicks(
        qs,
        qs.map(() => "0"),
      ),
    ).toBe(false);
    expect(
      validPicks(
        qs,
        qs.map(() => null),
      ),
    ).toBe(true);
  });

  it("signs a fixed receipt line", () => {
    expect(examMessage("badges.x.testnet", "me.testnet", "developer", 13, 15, 1700000000000)).toBe(
      "bon-exam-v1|badges.x.testnet|me.testnet|developer|13|15|1700000000000",
    );
  });
});

describe("gate", () => {
  it("needs stages 0 to 2 for the general route and 0 to 4 for the developer route", () => {
    expect(examGate("general", [0, 1, 2])).toEqual({ open: true, missing: [] });
    expect(examGate("general", [0, 2])).toEqual({ open: false, missing: [1] });
    expect(examGate("developer", [0, 1, 2])).toEqual({ open: false, missing: [3, 4] });
    expect(examGate("developer", [4, 3, 2, 1, 0])).toEqual({ open: true, missing: [] });
  });

  it("requires a run of stages from 0, since the contract mints stage n only after n - 1", () => {
    for (const r of EXAM_ROUTES) {
      const req = EXAM_ROUTE_INFO[r].requiredBadges;
      expect(req).toEqual(req.map((_, i) => i));
    }
  });

  it("picks the route from the reading path", () => {
    expect(examRouteFor("developer")).toBe("developer");
    expect(examRouteFor("newcomer")).toBe("general");
    expect(examRouteFor("veteran")).toBe("general");
    expect(examRouteFor(null)).toBe("general");
  });

  it("names the missing badges in plain words", () => {
    expect(badgeList([3])).toBe("stage 3 badge");
    expect(badgeList([0, 1, 2])).toBe("stage 0, 1 and 2 badges");
  });
});

async function demoChainWith(stages: number[]) {
  const me = (await new DemoChain({ pace: "instant" }).practiceAccount()).accountId;
  return new DemoChain({
    pace: "instant",
    badges: stages.map((stage) => ({ owner: me, stage, mintedAtMs: 1 })),
  });
}

describe("exam flow in demo mode (no Worker, no network)", () => {
  it("is locked without the badges and refuses to grade", async () => {
    const chain = await demoChainWith([0, 1]);
    expect(await readExamGate(chain, "general")).toMatchObject({ open: false, missing: [2] });
    expect(await submitExam(chain, "general", rightPicks("general"))).toEqual({
      ok: false,
      error: "Claim the stage 2 badge first.",
    });
  });

  it("opens with the badges, grades a fail with no receipt and a pass with a signed one", async () => {
    const chain = await demoChainWith([0, 1, 2]);
    const gate = await readExamGate(chain, "general");
    expect(gate.open).toBe(true);

    const fail = await submitExam(chain, "general", withWrong("general", 5));
    expect(fail).toMatchObject({ ok: true, score: 10, passed: false });
    expect(fail.ok && fail.receipt).toBeFalsy();

    const pass = await submitExam(chain, "general", withWrong("general", 1));
    expect(pass).toMatchObject({ ok: true, score: 14, passed: true });
    if (!pass.ok || !pass.receipt) throw new Error("no receipt");
    const r = pass.receipt;
    expect(r).toMatchObject({ accountId: gate.accountId, route: "general", score: 14, total: 15 });
    const text = examMessage(r.contractId, r.accountId, r.route, r.score, r.total, r.passedAtMs);
    const pub = base58.decode(DEMO_CLAIM_PUBLIC_KEY.slice(8));
    expect(ed25519.verify(base64.decode(r.signature), utf8ToBytes(text), pub)).toBe(true);
  });

  it("keeps the developer route locked until stages 3 and 4 are held", async () => {
    expect(await readExamGate(await demoChainWith([0, 1, 2]), "developer")).toMatchObject({
      open: false,
      missing: [3, 4],
    });
    expect((await readExamGate(await demoChainWith([0, 1, 2, 3, 4]), "developer")).open).toBe(true);
  });
});

describe("exam flow in testnet mode (the Worker grades)", () => {
  const testnetChain = (held: number[]) =>
    ({
      network: "testnet",
      practiceAccount: async () => ({ accountId: "me.testnet", publicKey: "ed25519:x" }),
      hasBadge: async (_: string, s: number) => held.includes(s),
    }) as unknown as Chain;

  it("sends the answers, never grades in the browser, and returns the Worker's result", async () => {
    const reply = {
      score: 13,
      total: 15,
      passMark: 12,
      passed: true,
      results: [],
      receipt: { signature: "sig" },
    };
    const fetch = vi.fn(async () => new Response(JSON.stringify(reply), { status: 200 }));
    const picks = questionsFor("general").map(() => 0);
    const r = await submitExam(testnetChain([0, 1, 2]), "general", picks, {
      workerUrl: "https://w.example/",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    expect(r).toMatchObject({ ok: true, score: 13, passed: true, receipt: { signature: "sig" } });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://w.example/exam");
    expect(JSON.parse(String(init.body))).toEqual({
      accountId: "me.testnet",
      route: "general",
      answers: picks,
    });
  });

  it("says so when no Worker is set up, and passes on the Worker's refusal", async () => {
    const picks = questionsFor("general").map(() => 0);
    expect(await submitExam(testnetChain([0, 1, 2]), "general", picks)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not set up here/),
    });
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: "Claim the stage 2 badge first." }), { status: 403 }),
    );
    expect(
      await submitExam(testnetChain([0, 1, 2]), "general", picks, {
        workerUrl: "https://w.example",
        fetch: fetch as unknown as typeof globalThis.fetch,
      }),
    ).toEqual({ ok: false, error: "Claim the stage 2 badge first." });
  });
});
