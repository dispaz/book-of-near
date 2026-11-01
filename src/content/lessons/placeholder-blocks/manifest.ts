import type { LessonManifest } from "../../../app/types";

export default {
  id: "placeholder-blocks",
  stage: 0,
  order: 91,
  title: "Add a line",
  status: "ready",
  needsChain: false,
  hidden: true,
  summary: "A placeholder lesson with a gated step.",
  steps: [
    { caption: "Here is an empty page of the ledger." },
    { caption: "Your turn: add a line to the page.", action: { label: "Add a line", gate: true } },
    { caption: "Well done. The line is written and stays there." },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
