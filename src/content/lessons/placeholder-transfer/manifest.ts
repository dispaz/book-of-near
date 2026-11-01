import type { LessonManifest } from "../../../app/types";

/** Developer placeholder: proves the Chain interface end to end (#2). Lesson 0.3 (#10) replaces it. */
export default {
  id: "placeholder-transfer",
  stage: 0,
  order: 92,
  title: "Send a test transfer",
  status: "ready",
  needsChain: true,
  hidden: true,
  summary: "A placeholder lesson that sends 1 NEAR through the Chain interface.",
  steps: [
    {
      caption: "This is your practice account. In demo mode it holds 5 pretend NEAR.",
      explain:
        "Demo mode runs a small copy of NEAR inside your browser. Nothing goes over the network and nothing costs real money.",
    },
    {
      caption: "Send 1 NEAR and watch each stage light up.",
      explain:
        "A transaction is a signed request to change the chain. This one moves 1 NEAR to the app's account.",
      action: { label: "Send 1 NEAR", gate: true },
    },
    {
      caption: "Final. The transfer can no longer be undone.",
      explain:
        "The card shows the transaction ID, the block that holds it, the shard that ran it and the gas it burnt. Gas is the measure of work a transaction causes.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
