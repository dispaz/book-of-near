import { describe, expect, it, vi } from "vitest";
import { createProgress, STORAGE_KEY, type KeyValueStorage } from "./store";
import type { CompletionRecord } from "./types";

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
