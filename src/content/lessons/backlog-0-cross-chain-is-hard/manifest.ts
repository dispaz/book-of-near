import type { LessonManifest } from "../../../app/types";

// Backlog topic outside the MVP (docs/curriculum/topics.json). Shown as a locked card.
export default {
  id: "backlog-0-cross-chain-is-hard",
  stage: 0,
  order: 10,
  title: "Why moving money between chains is hard",
  status: "planned",
  needsChain: false,
  summary: "Two chains, one coin: see where trust creeps in when you move it.",
  steps: [],
} satisfies LessonManifest;
