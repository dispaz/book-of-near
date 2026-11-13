import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-7/7.2.md (topic: 7.2-topic.md). Template: docs/lesson-template.md.
// Shape: no perfect chain → accounts → scalability → speed → liquidity (each opens one card) → check →
// honest take. Keep the step numbers in steps.ts in sync. No chain access: the board is recorded data
// from the topic's sources (board.ts, RECORDED_ON), the same in demo and testnet mode.
export default {
  id: "l-7-2-honest-scoreboard",
  stage: 7,
  order: 2,
  title: "The honest scoreboard",
  status: "ready",
  needsChain: false,
  // Both views draw one state (useScoreboard); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Weigh NEAR against Ethereum, Solana and Cosmos, strengths and weak spots alike.",
  steps: [
    {
      caption: "Every chain says it is the best. In engineering, every choice is a trade-off.",
      explain:
        "No blockchain wins at everything. Run everything on one chain, like Solana, and validators need big machines. Scale with rollups (separate chains that post to a base chain), like Ethereum, and money splits across them. Shard, like NEAR, and calls between contracts stop being atomic (all-or-nothing). Pick a pillar to see each chain's core idea.",
    },
    {
      caption:
        "Dimension 1: accounts. Readable names and scoped keys, or hex addresses and contract wallets?",
      explain:
        "On NEAR, account names and function-call keys are part of the protocol. On Ethereum, smart-account features need contract wallets and extra services called bundlers (ERC-4337). Open the Accounts card to see the board.",
      action: { label: "open the Accounts card", gate: true },
    },
    {
      caption: "Dimension 2: scalability. Shards, rollups, or one big state?",
      explain:
        "NEAR splits state and work across shards. Ethereum gave up on shards that run code; its plan adds cheap data space for rollups. Solana runs one large shared state, which asks a lot of validator hardware. Cosmos adds whole new chains.",
      action: { label: "open the Scalability card", gate: true },
    },
    {
      caption: "Dimension 3: speed and atomicity. Here NEAR accepts a real trade-off.",
      explain:
        "Solana runs a call across many accounts in one fast transaction. On NEAR, a call to another contract travels as a receipt and runs in a later block. That rules out reentrancy (a contract being called again before it finishes), but a chain of calls takes several blocks and cannot roll back as one.",
      action: { label: "open the Speed card", gate: true },
    },
    {
      caption: "Dimension 4: liquidity. Ethereum is far ahead on money locked in DeFi.",
      explain:
        "Liquidity is how much money is ready to trade. Ethereum holds the most by far. NEAR's own DeFi is much smaller, which is why NEAR builds chain abstraction: NEAR Intents and Chain Signatures let a NEAR account use other chains' liquidity. The figures were recorded on one day; they are not live.",
      action: { label: "open the Liquidity card", gate: true },
    },
    {
      caption: "Three questions on the trade-offs between these chains.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: why knowing the weak spots makes you a better builder.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
