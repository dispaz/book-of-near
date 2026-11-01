import type { LessonManifest } from "../../../app/types";

// Backlog topic outside the MVP (docs/curriculum/topics.json). Shown as a locked card.
export default {
  id: "backlog-2-post-quantum-keys",
  stage: 2,
  order: 12,
  title: "Post-quantum keys and key rotation",
  status: "planned",
  needsChain: false,
  summary: "Why keys may need to change one day, and how an account can swap them.",
  steps: [],
} satisfies LessonManifest;
