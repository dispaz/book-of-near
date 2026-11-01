import { describe, expect, it } from "vitest";
import { buildRegistry } from "../app/buildRegistry";
import type { LessonManifest, StageManifest } from "../app/types";
import { isOptionalStage, offersTestOut, routeFromAnswers, startLesson } from "./routes";
import { gradeTestOut, TEST_OUT_PASS, TEST_OUT_QUESTIONS, testOutRecords } from "./testOutQuiz";

const stage = (id: number): { default: StageManifest } => ({
  default: { id, name: `S${id}`, title: "t", accent: "#000" },
});
const lesson = (id: string, s: number, order: number, extra: Partial<LessonManifest> = {}) => ({
  default: {
    id,
    stage: s,
    order,
    title: id,
    status: "ready",
    needsChain: false,
    steps: [{ caption: "x" }],
    ...extra,
  } as LessonManifest,
});

const reg = buildRegistry(
  { a: stage(0), b: stage(1), c: stage(3) },
  {
    p0: lesson("planned-0", 0, 1, { status: "planned", steps: [] }),
    h0: lesson("hidden-0", 0, 2, { hidden: true }),
    r0: lesson("ready-0", 0, 3),
    r1: lesson("ready-1", 1, 1),
  },
);

describe("routeFromAnswers", () => {
  it("anyone who writes code takes the developer path", () => {
    expect(routeFromAnswers({ wallet: "never", sent: "no", code: "apps" })).toBe("developer");
    expect(routeFromAnswers({ wallet: "often", sent: "many", code: "contracts" })).toBe("developer");
  });
  it("wallet users who have sent transactions are veterans", () => {
    expect(routeFromAnswers({ wallet: "often", sent: "many", code: "no" })).toBe("veteran");
    expect(routeFromAnswers({ wallet: "few", sent: "once", code: "no" })).toBe("veteran");
  });
  it("everyone else, and missing answers, are newcomers", () => {
    expect(routeFromAnswers({ wallet: "few", sent: "no", code: "no" })).toBe("newcomer");
    expect(routeFromAnswers({})).toBe("newcomer");
  });
});

describe("route rules", () => {
  it("offers the test-out to people with crypto experience", () => {
    expect(offersTestOut({ wallet: "often", sent: "many", code: "no" })).toBe(true);
    expect(offersTestOut({ wallet: "often", sent: "many", code: "contracts" })).toBe(true);
    expect(offersTestOut({ wallet: "never", sent: "no", code: "contracts" })).toBe(false);
  });
  it("stage 3 is optional except on the developer path", () => {
    expect(isOptionalStage("newcomer", 3)).toBe(true);
    expect(isOptionalStage("veteran", 3)).toBe(true);
    expect(isOptionalStage("developer", 3)).toBe(false);
    expect(isOptionalStage("newcomer", 1)).toBe(false);
  });
  it("starts at the first open lesson from a stage, skipping planned and hidden ones", () => {
    expect(startLesson(reg, 0)?.id).toBe("ready-0");
    expect(startLesson(reg, 1)?.id).toBe("ready-1");
    expect(startLesson(reg, 4)).toBeUndefined();
  });
});

describe("stage 0 test-out", () => {
  it("has 3 to 5 questions, each with exactly one right answer", () => {
    expect(TEST_OUT_QUESTIONS.length).toBeGreaterThanOrEqual(3);
    expect(TEST_OUT_QUESTIONS.length).toBeLessThanOrEqual(5);
    for (const q of TEST_OUT_QUESTIONS) expect(q.options.filter((o) => o.correct)).toHaveLength(1);
  });
  it("passes at the pass mark and fails below it", () => {
    const right = TEST_OUT_QUESTIONS.map((q) => q.options.findIndex((o) => o.correct));
    expect(gradeTestOut(right)).toEqual({ score: right.length, passed: true });
    const oneWrong = right.map((r, i) => (i === 0 ? (r + 1) % 2 : r));
    expect(gradeTestOut(oneWrong).passed).toBe(TEST_OUT_PASS <= right.length - 1);
    expect(gradeTestOut([]).passed).toBe(false);
  });
  it("builds a tested-out record for every visible stage 0 lesson, planned ones included", () => {
    const rs = testOutRecords(reg, "veteran", "demo", "2026-11-01T00:00:00.000Z");
    expect(rs.map((r) => r.lessonId)).toEqual(["planned-0", "ready-0"]);
    expect(rs.every((r) => r.testedOut && r.stage === 0 && r.route === "veteran")).toBe(true);
  });
});
