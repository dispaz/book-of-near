import type { LessonManifest } from "../../../app/types";

// Backlog topic outside the MVP (docs/curriculum/topics.json). Shown as a locked card.
export default {
  id: "backlog-3-aurora",
  stage: 3,
  order: 11,
  title: "Aurora: Ethereum apps on NEAR",
  status: "planned",
  needsChain: false,
  summary: "How Ethereum-style contracts run on NEAR through Aurora.",
  steps: [],
} satisfies LessonManifest;
