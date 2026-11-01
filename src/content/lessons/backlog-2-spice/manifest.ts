import type { LessonManifest } from "../../../app/types";

// Backlog topic outside the MVP (docs/curriculum/topics.json). Shown as a locked card.
export default {
  id: "backlog-2-spice",
  stage: 2,
  order: 11,
  title: "Roadmap: SPICE",
  status: "planned",
  needsChain: false,
  summary: "A planned change that separates agreeing on blocks from running them.",
  steps: [],
} satisfies LessonManifest;
