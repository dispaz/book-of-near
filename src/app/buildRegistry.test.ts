import { describe, expect, it } from "vitest";
import { buildRegistry } from "./buildRegistry";
import type { LessonManifest, StageManifest } from "./types";

const stage = (id: number): { default: StageManifest } => ({
  default: { id, name: `S${id}`, title: `Stage ${id}`, accent: "#000" },
});
const lesson = (id: string, stageId: number, order: number): { default: LessonManifest } => ({
  default: {
    id,
    stage: stageId,
    order,
    title: id,
    status: "ready",
    needsChain: false,
    steps: [{ caption: "x" }],
  },
});

describe("buildRegistry", () => {
  it("sorts stages by id and lessons by order", () => {
    const r = buildRegistry(
      { a: stage(1), b: stage(0) },
      { x: lesson("b", 0, 2), y: lesson("a", 0, 1), z: lesson("c", 1, 1) },
    );
    expect(r.stages.map((s) => s.id)).toEqual([0, 1]);
    expect(r.stages[0]!.lessons.map((l) => l.id)).toEqual(["a", "b"]);
    expect(r.stageOf("c")?.id).toBe(1);
  });

  it("picks up a new lesson module with no other change", () => {
    const before = buildRegistry({ a: stage(0) }, { x: lesson("one", 0, 1) });
    const after = buildRegistry({ a: stage(0) }, { x: lesson("one", 0, 1), y: lesson("two", 0, 2) });
    expect(before.stages[0]!.lessons).toHaveLength(1);
    expect(after.stages[0]!.lessons.map((l) => l.id)).toEqual(["one", "two"]);
    expect(after.lessons.get("two")?.title).toBe("two");
  });

  it("rejects a lesson pointing at an unknown stage", () => {
    expect(() => buildRegistry({ a: stage(0) }, { x: lesson("l", 3, 1) })).toThrow(/unknown stage 3/);
  });

  it("rejects duplicate lesson ids", () => {
    expect(() => buildRegistry({ a: stage(0) }, { x: lesson("l", 0, 1), y: lesson("l", 0, 2) })).toThrow(
      /Duplicate lesson id/,
    );
  });
});
