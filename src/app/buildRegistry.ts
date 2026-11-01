import type { LessonManifest, Registry, StageEntry, StageManifest } from "./types";

type Modules<T> = Record<string, { default: T }>;

/**
 * Turns the manifest modules found by `import.meta.glob` into the menu tree and route table.
 * Pure, so tests can feed it fake modules.
 */
export function buildRegistry(
  stageModules: Modules<StageManifest>,
  lessonModules: Modules<LessonManifest>,
): Registry {
  const stages = new Map<number, StageEntry>();
  for (const [path, mod] of Object.entries(stageModules)) {
    const s = mod.default;
    if (stages.has(s.id)) throw new Error(`Duplicate stage id ${s.id} in ${path}`);
    stages.set(s.id, { ...s, lessons: [] });
  }

  const lessons = new Map<string, LessonManifest>();
  for (const [path, mod] of Object.entries(lessonModules)) {
    const l = mod.default;
    if (lessons.has(l.id)) throw new Error(`Duplicate lesson id "${l.id}" in ${path}`);
    const stage = stages.get(l.stage);
    if (!stage) throw new Error(`Lesson "${l.id}" in ${path} points at unknown stage ${l.stage}`);
    if (l.status !== "planned" && l.steps.length === 0) throw new Error(`Lesson "${l.id}" has no steps`);
    lessons.set(l.id, l);
    stage.lessons.push(l);
  }

  const sorted = [...stages.values()].sort((a, b) => a.id - b.id);
  for (const s of sorted) s.lessons.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return {
    stages: sorted,
    lessons,
    stageOf: (id) => {
      const l = lessons.get(id);
      return l ? stages.get(l.stage) : undefined;
    },
  };
}
