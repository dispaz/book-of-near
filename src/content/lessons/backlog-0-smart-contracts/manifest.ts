import type { LessonManifest } from "../../../app/types";

// Backlog topic outside the MVP (docs/curriculum/topics.json). Shown as a locked card.
export default {
  id: "backlog-0-smart-contracts",
  stage: 0,
  order: 11,
  title: "Smart contracts",
  status: "planned",
  needsChain: false,
  summary: "What a program that lives on a blockchain can and cannot do.",
  steps: [],
} satisfies LessonManifest;
