import type { LessonManifest } from "../../../app/types";

// Backlog topic outside the MVP (docs/curriculum/topics.json). Shown as a locked card.
export default {
  id: "backlog-3-wallet-architecture",
  stage: 3,
  order: 10,
  title: "Building a public non-custodial wallet",
  status: "planned",
  needsChain: false,
  summary: "The parts of a wallet app where only the user holds the keys.",
  steps: [],
} satisfies LessonManifest;
