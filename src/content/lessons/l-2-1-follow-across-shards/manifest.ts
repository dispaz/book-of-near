import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-2/2.1.md. Template: docs/lesson-template.md.
// Shape: pick a transaction → shards, chunks, blocks → where it started → follow the receipts →
// where the time went → check → honest take. Keep the step numbers in useShardTrace.ts in sync.
// The lesson never sends or times a new transaction: it opens one that finished (your 0.3 one, or a recording).
export default {
  id: "l-2-1-follow-across-shards",
  stage: 2,
  order: 1,
  title: "Follow your transaction across shards",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useShardTrace); the 3D view (Scene3D) loads only when chosen.
  views: ["2d", "3d"],
  summary: "Open a finished transaction and follow it across NEAR's shards, chunks and blocks.",
  vars: {
    firstShard: "?",
    firstBlock: "?",
    hops: "several",
    touched: "some shards",
    blocks: "a few blocks",
    workTime: "a few seconds",
    finalSeen: "the wait for Final in 0.3",
  },
  steps: [
    {
      caption: "Pick a transaction to follow. Your own from 0.3 is the first choice.",
      explain:
        "The transaction ID is the hash from 0.3. The app asks an RPC node what happened to it. Nothing new is sent. If you skipped 0.3, use the recorded example: a real testnet transaction saved on 1 Nov 2026.",
      action: { label: "pick a transaction", gate: true },
    },
    {
      caption: "NEAR splits its work between shards. Every block holds one chunk per shard.",
      explain:
        "A shard is a slice of the network's accounts. A chunk is the work one shard did in one block. The grid shows one row per shard and one column per block, time running left to right. The number of shards changes when the network resplits, so the app reads it live.",
      explainAt: "grid",
    },
    {
      caption: "Your transaction started on shard {firstShard}, in block {firstBlock}.",
      explain:
        "An account lives on exactly one shard, picked by sorting account names against a list of boundary accounts. The transaction runs on the signer's shard, in the chunk that shard made in that block. There it becomes a receipt: a message the receiver's shard will act on.",
      explainAt: "hop",
    },
    {
      caption: "Follow each receipt: {hops} steps, {touched}, {blocks}.",
      explain:
        "A receipt is routed to the receiver's shard and runs there, in a later block. A refund of unused gas is a receipt too, and it goes back to the signer's shard. Even on one shard, each step waits for the next block.",
      explainAt: "hop",
      action: { label: "follow every receipt", gate: true },
    },
    {
      caption: "Remember {finalSeen}? Here is where it went: {workTime} of block-to-block steps.",
      explain:
        "Blocks come about half a second to a second apart, and each step waited for the next one. The rest of what you saw in 0.3 was the hand-over to the RPC node and waiting for finality. These times come from block timestamps.",
      explainAt: "time",
    },
    {
      caption: "Three quick questions. Then the honest take.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: what sharding gives NEAR, and what it costs.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
