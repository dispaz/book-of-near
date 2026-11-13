import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-7/7.1.md (topic: 7.1-topic.md). Template: docs/lesson-template.md.
// Shape: the map → authorize (account + key + transaction) → shards and receipts → the Wasm contract →
// settlement (solver; Chain Signatures only as a side note) → check → honest take. Keep the step numbers in steps.ts in sync.
// A replay: it reads what earlier lessons left in progress (the learner's own 4.2 swap, else a recorded
// intent) and sends nothing, so demo and testnet mode behave the same.
export default {
  id: "l-7-1-trace-an-intent",
  stage: 7,
  order: 1,
  title: "Trace one intent end to end",
  status: "ready",
  needsChain: false,
  // Both views draw one state (useCapstone); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Follow one cross-chain intent from request to result.",
  vars: { name: "learner.testnet" },
  steps: [
    {
      caption:
        "Every concept you learned is part of one engine. Watch them work together to move money across chains.",
      explain:
        "You started with ledgers and keys. Now you replay one cross-chain intent through five layers: account, scoped key, shards, smart contract and Chain Signatures. Each stop links back to the lesson that taught it. Where you did that lesson, the replay uses your own results.",
      explainAt: "account",
    },
    {
      caption: "Layers 1 and 2: your named account ({name}) signs the intent with a function-call key.",
      explain:
        "You do not risk your full-access key. A function-call key (Stage 1) may call only one contract, here the intent verifier, and its gas allowance is capped. The signed intent is a transaction, like the one you sent in lesson 0.3.",
      explainAt: "account",
      action: { label: "authorize the intent", gate: true },
    },
    {
      caption: "Layer 3: the parcel enters your shard and becomes a receipt that moves on in a later block.",
      explain:
        "NEAR is split into shards (Nightshade). Your transaction is processed on your account's shard. It creates a receipt, a message to the verifier contract, which runs on the verifier's shard in a later block. Validators check each chunk with a state witness, so no shard waits for a global lock.",
      explainAt: "shards",
    },
    {
      caption: "Layer 4: the contract runs as Wasm, and the NEAR paid for its gas is destroyed.",
      explain:
        "The verifier contract checks the intent's terms. It is WebAssembly (Wasm) code, like the contract you deployed in Stage 3. Its storage is paid for with staked NEAR that can be returned (storage staking). The NEAR paid for the gas the call uses is destroyed. Up to and including protocol version 86 (a version of NEAR's rules), the contract's account got 30% of it; from version 87, none.",
      explainAt: "verifier",
    },
    {
      caption: "Layer 5: a solver fills the order. Chain Signatures sign only if a payout must leave NEAR.",
      explain:
        "Solvers compete to fill the intent; 1Click shows only the winning quote. The winner pays out from its own funds, and the verifier contract settles the trade. A real swap from this app keeps the USDC in your NEAR Intents account (intents.near), not on Arbitrum, so no chain signature is needed. Only when a NEAR account must sign on another chain does the signing network (the v1.signer contract) sign with key shares, for a 1 yoctoNEAR deposit.",
      explainAt: "destination",
      action: { label: "verify the foreign settlement", gate: true },
    },
    {
      caption: "Three questions on how NEAR's layers fit together.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: one NEAR stack compared with rollups and single-chain blockchains.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
