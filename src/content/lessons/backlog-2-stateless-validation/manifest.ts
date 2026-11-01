import type { LessonManifest } from "../../../app/types";

// Backlog topic outside the MVP (docs/curriculum/topics.json). Shown as a locked card.
export default {
  id: "backlog-2-stateless-validation",
  stage: 2,
  order: 10,
  title: "Stateless validation, resharding and staking",
  status: "planned",
  needsChain: false,
  summary: "How NEAR checks blocks, splits shards and picks validators.",
  steps: [],
} satisfies LessonManifest;
