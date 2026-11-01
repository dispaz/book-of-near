import { buildRegistry } from "./buildRegistry";
import type { LessonManifest, StageManifest } from "./types";

const stageModules = import.meta.glob<{ default: StageManifest }>("../content/stages/*/stage.ts", {
  eager: true,
});
const lessonModules = import.meta.glob<{ default: LessonManifest }>("../content/lessons/*/manifest.ts", {
  eager: true,
});

export const registry = buildRegistry(stageModules, lessonModules);
