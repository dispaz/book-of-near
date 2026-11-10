import { buildRegistry } from "./buildRegistry";
import type { LessonManifest, StageManifest } from "./types";
import { TOPIC_CARDS } from "../content/backlog";
import { withTopicCards } from "../content/backlog/topicCards";

const stageModules = import.meta.glob<{ default: StageManifest }>("../content/stages/*/stage.ts", {
  eager: true,
});
const lessonModules = import.meta.glob<{ default: LessonManifest }>("../content/lessons/*/manifest.ts", {
  eager: true,
});

/** Lessons from their manifests, plus a locked card for every curriculum topic no lesson teaches yet. */
export const registry = buildRegistry(
  stageModules,
  withTopicCards(
    lessonModules,
    TOPIC_CARDS,
    Object.values(stageModules).map((m) => m.default.id),
  ),
);
