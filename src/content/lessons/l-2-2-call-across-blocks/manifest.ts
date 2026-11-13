import type { LessonManifest } from "../../../app/types";
import { ORDER_COPY } from "./steps";

// Topic: docs/lessons/stage-2/2.2-topic.md. Lesson script: docs/lessons/stage-2/2.2.md.
// Template: docs/lesson-template.md.
// Shape: hook (contracts send receipts) → the receipt hop → do (a cross-contract order) → where the gas
// went (all burned) → do (a failing shop and its callback) → check → honest take. Keep steps.ts in sync.
// Demo mode runs the call on DemoChain (buyer.demo.testnet → shop.demo.testnet, two shards). Testnet
// mode opens a recorded real testnet call (recorded.ts, values copied from the chain, not re-read): a
// deliberate choice to keep the lesson free and fast, so it sends nothing. Step 3's copy follows the mode
// through the order* vars (steps.ts ORDER_COPY).
export default {
  id: "l-2-2-call-across-blocks",
  stage: 2,
  order: 2,
  title: "A call that takes several blocks",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useCrossCall); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Watch one call split into receipts that run over several blocks.",
  // Every value comes from the call's own receipts; these show only before it has run.
  vars: {
    firstBlock: "N + 2",
    secondBlock: "N + 3",
    gasSpent: "a few",
    // Step 3's words: demo mode by default; the scene swaps in the testnet ones in testnet mode.
    ...ORDER_COPY.demo,
  },
  steps: [
    {
      caption:
        "What happens when one contract calls another? On NEAR, they do not share memory. They send receipts.",
      explain:
        "On Ethereum, contracts call each other in one go, inside one transaction. On NEAR, each contract works on its own. When contract A calls contract B, the network writes a receipt: a delivery slip that reaches contract B in a later block.",
      explainAt: "contracts",
    },
    {
      caption: "A call makes an action receipt. It runs in a later block, often on another shard.",
      explain:
        "An action receipt is a slip that carries the method call and its gas budget (gas: the unit of work a call may spend). Contract B runs it in its own shard's chunk. Its answer travels back as a data receipt to a callback: a method of contract A that waits for the answer.",
      explainAt: "slip",
    },
    {
      caption: "{orderTask} Watch the receipts hop from block to block.",
      explain:
        "{orderIntro} Contract B runs it in block #{firstBlock}. In block #{secondBlock} a data receipt brings the answer back to contract A's callback.",
      explainAt: "blocks",
      action: { label: "{orderAction}", gate: true },
    },
    {
      caption: "The contracts burnt {gasSpent} Tgas of gas, and the NEAR paid for it was destroyed.",
      explain:
        "Each receipt burns the gas its work used, and that gas is paid for in NEAR. The NEAR is destroyed: no account receives it, not even the contract whose code ran. Up to and including protocol version 86 (a version of NEAR's rules), the contract got 30% of it. From version 87, none.",
      explainAt: "meter",
      action: { label: "inspect the gas", gate: true },
    },
    {
      caption: "Separate receipts do not roll back together. What happens when the shop fails?",
      explain:
        "Within one receipt, a failure undoes all its actions. Across receipts it does not. If the shop panics, contract A's reservation, made in an earlier block, stays. A's callback is told the call failed and must undo the reservation itself.",
      explainAt: "slip",
      action: { label: "simulate an out-of-stock failure", gate: true },
    },
    {
      caption: "Three quick questions on receipts, asynchronous calls and burnt gas.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: asynchronous contract calls compared with Ethereum's calls in one go.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
