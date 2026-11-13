import { describe, expect, it, vi } from "vitest";
import { createProgress, examKey, keepBest, STORAGE_KEY, type KeyValueStorage } from "./store";
import type { CompletionRecord, ExamRecord } from "./types";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const record = (lessonId: string, extra: Partial<CompletionRecord> = {}): CompletionRecord => ({
  lessonId,
  stage: 0,
  route: "newcomer",
  mode: "demo",
  completedAt: "2026-11-01T10:00:00.000Z",
  ...extra,
});

describe("progress store", () => {
  it("records completions and answers isComplete", () => {
    const p = createProgress(memoryStorage());
    expect(p.isComplete("a")).toBe(false);
    p.recordCompletion(record("a"));
    expect(p.isComplete("a")).toBe(true);
    expect(p.completions()).toEqual([record("a")]);
  });

  it("keeps one record per lesson, the latest wins", () => {
    const p = createProgress(memoryStorage());
    p.recordCompletion(record("a"));
    p.recordCompletion(record("a", { mode: "testnet" }));
    expect(p.completions()).toHaveLength(1);
    expect(p.completions()[0]!.mode).toBe("testnet");
  });

  it("persists under a versioned key and reloads", () => {
    const s = memoryStorage();
    const p = createProgress(s);
    p.setRoute("veteran");
    p.recordCompletion(record("a"));
    p.recordPosition("a", 2);
    expect(s.data.has(STORAGE_KEY)).toBe(true);
    const again = createProgress(s);
    expect(again.route()).toBe("veteran");
    expect(again.isComplete("a")).toBe(true);
    expect(again.resumeTarget()).toEqual({ lessonId: "a", step: 2 });
  });

  it("works when storage throws", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const p = createProgress(broken);
    p.setRoute("developer");
    p.recordCompletion(record("a"));
    expect(p.route()).toBe("developer");
    expect(p.isComplete("a")).toBe(true);
  });

  it("ignores corrupt or old stored data", () => {
    const s = memoryStorage();
    s.data.set(STORAGE_KEY, "{not json");
    expect(createProgress(s).completions()).toEqual([]);
    s.data.set(STORAGE_KEY, JSON.stringify({ v: 0, route: "veteran" }));
    expect(createProgress(s).route()).toBeNull();
  });

  it("attaches reported evidence to the next completion of that lesson", () => {
    const p = createProgress(memoryStorage());
    p.reportEvidence("a", { txHash: "abc" });
    p.reportEvidence("a", { explorer: "https://example" });
    p.recordCompletion(record("a"));
    expect(p.completions()[0]!.evidence).toEqual({ txHash: "abc", explorer: "https://example" });
  });

  it("keeps the mode the evidence was made in, even if the learner switched mode before Finish", () => {
    const p = createProgress(memoryStorage());
    p.reportEvidence("a", { txHash: "abc", mode: "testnet" });
    p.recordCompletion({ ...record("a"), mode: "demo" });
    expect(p.completions()[0]!.mode).toBe("testnet");
  });

  it("notifies subscribers and gives a stable snapshot between changes", () => {
    const p = createProgress(memoryStorage());
    const fn = vi.fn();
    const off = p.subscribe(fn);
    const a = p.snapshot();
    expect(p.snapshot()).toBe(a);
    p.setRoute("newcomer");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(p.snapshot()).not.toBe(a);
    off();
    p.setRoute("developer");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resumeTarget is null before any lesson was opened", () => {
    expect(createProgress(memoryStorage()).resumeTarget()).toBeNull();
  });
});

describe("final exam records (issue #28)", () => {
  const receipt = (score: number, extra: Partial<ExamRecord> = {}) => ({
    contractId: "c",
    accountId: extra.accountId ?? "me.testnet",
    route: extra.route ?? ("general" as const),
    score,
    total: 15,
    passedAtMs: 1,
    signature: `s${score}${extra.mode ?? "demo"}`,
  });
  const attempt = (score: number, passed: boolean, extra: Partial<ExamRecord> = {}) => ({
    route: "general" as const,
    accountId: "me.testnet",
    mode: "demo" as const,
    score,
    total: 15,
    passed,
    takenAt: "2026-11-13T10:00:00.000Z",
    ...(passed ? { receipt: receipt(score, extra) } : {}),
    ...extra,
  });
  const demo = ["demo", "me.testnet"] as const;

  it("stores attempts per route, keeps a pass over a later fail or lower pass, and counts attempts", () => {
    const p = createProgress(memoryStorage());
    expect(p.exam("general", ...demo)).toBeNull();
    expect(p.recordExam(attempt(9, false))).toMatchObject({ score: 9, attempts: 1 });
    expect(p.recordExam(attempt(13, true))).toMatchObject({ score: 13, passed: true, attempts: 2 });
    expect(p.recordExam(attempt(5, false))).toMatchObject({ score: 13, passed: true, attempts: 3 });
    expect(p.recordExam(attempt(12, true))).toMatchObject({ score: 13, attempts: 4 });
    expect(p.recordExam(attempt(15, true))).toMatchObject({
      score: 15,
      attempts: 5,
      receipt: { signature: "s15demo" },
    });
    expect(p.exam("general", ...demo)).toMatchObject({ score: 15, attempts: 5 });
    expect(p.exam("developer", ...demo)).toBeNull();
  });

  it("keeps a lower testnet pass beside a higher demo pass, with its own receipt", () => {
    const p = createProgress(memoryStorage());
    p.recordExam(attempt(15, true));
    expect(p.recordExam(attempt(13, true, { mode: "testnet" }))).toMatchObject({
      mode: "testnet",
      score: 13,
      attempts: 1,
      receipt: { signature: "s13testnet" },
    });
    expect(p.exam("general", "testnet", "me.testnet")).toMatchObject({
      score: 13,
      receipt: { signature: "s13testnet" },
    });
    expect(p.exam("general", ...demo)).toMatchObject({ score: 15, receipt: { signature: "s15demo" } });
  });

  it("keeps each account's result apart", () => {
    const p = createProgress(memoryStorage());
    p.recordExam(attempt(15, true));
    expect(p.recordExam(attempt(12, true, { accountId: "other.testnet" }))).toMatchObject({
      accountId: "other.testnet",
      score: 12,
      attempts: 1,
    });
    expect(p.exam("general", "demo", "other.testnet")).toMatchObject({ score: 12 });
    expect(p.exam("general", ...demo)).toMatchObject({ score: 15, attempts: 1 });
  });

  it("does not let a lower pass in the same mode and account replace a higher one", () => {
    const p = createProgress(memoryStorage());
    p.recordExam(attempt(14, true, { mode: "testnet" }));
    expect(p.recordExam(attempt(12, true, { mode: "testnet" }))).toMatchObject({
      score: 14,
      attempts: 2,
      receipt: { signature: "s14testnet" },
    });
  });

  it("keeps the newest of two fails", () => {
    expect(keepBest({ ...attempt(10, false), attempts: 1 }, attempt(8, false))).toMatchObject({
      score: 8,
      attempts: 2,
    });
  });

  it("survives a reload and drops malformed or misfiled exam records", () => {
    const s = memoryStorage();
    createProgress(s).recordExam(attempt(13, true));
    expect(createProgress(s).exam("general", ...demo)).toMatchObject({
      score: 13,
      passed: true,
      attempts: 1,
    });

    const raw = JSON.parse(s.data.get(STORAGE_KEY)!) as Record<string, unknown>;
    raw.exams = {
      [examKey("general", ...demo)]: { route: "general", score: "lots" },
      // Filed under another route's key, or under the old route-only key: dropped.
      [examKey("developer", ...demo)]: attempt(1, false),
      general: attempt(2, false),
    };
    s.data.set(STORAGE_KEY, JSON.stringify(raw));
    const p = createProgress(s);
    expect(p.exam("general", ...demo)).toBeNull();
    expect(p.exam("developer", ...demo)).toBeNull();
    expect(p.snapshot().exams).toBeUndefined();
  });
});
