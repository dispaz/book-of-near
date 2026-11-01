import type { LessonManifest } from "../../../app/types";

// Planned card for issue #16. The lesson agent replaces this file in place (keep the id).
export default {
  id: "l-1-3-inside-a-transaction",
  stage: 1,
  order: 3,
  title: "Inside a NEAR transaction",
  status: "planned",
  needsChain: false,
  summary: "Open a NEAR transaction and see each part: signer, receiver, actions and nonce.",
  steps: [],
} satisfies LessonManifest;
