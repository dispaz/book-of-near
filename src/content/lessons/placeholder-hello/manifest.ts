import type { LessonManifest } from "../../../app/types";

export default {
  id: "placeholder-hello",
  stage: 0,
  order: 90,
  title: "Hello, ledger",
  status: "ready",
  needsChain: false,
  hidden: true,
  summary: "A placeholder lesson that shows the stage bar.",
  steps: [
    {
      caption: "A ledger is a list of who owns what.",
      explain: "Think of a notebook where every line says who paid whom.",
    },
    {
      caption: "Each new line is added to the end. Old lines stay.",
      explain: "Nobody rubs out a line. A correction is a new line.",
    },
    {
      caption: "That is a blockchain at heart. The next lessons show why it is hard to cheat.",
      explain: "A blockchain is a ledger that many computers keep at once.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
