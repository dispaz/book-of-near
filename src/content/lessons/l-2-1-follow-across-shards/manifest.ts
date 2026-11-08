import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-2/2.1.md (topic: 2.1-topic.md). Template: docs/lesson-template.md.
// Shape: pick a transaction → shards, chunks, blocks → where it started → follow the receipts →
// where the time went → check → honest take. Keep the step numbers in useShardTrace.ts and tour.ts in sync.
// The lesson never sends or times a new transaction: it opens one that finished (your 0.3 one, or a recording).
export default {
  id: "l-2-1-follow-across-shards",
  stage: 2,
  order: 1,
  title: "Follow your transaction across shards",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useShardTrace); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Open a finished transaction and follow it across NEAR's shards, chunks and blocks.",
  vars: {
    firstShard: "?",
    firstBlock: "?",
    hops: "several",
    shardsTouched: "some shards",
    blocksCount: "a few blocks",
    workTime: "a few seconds",
    finalSeen: "the wait for Final in 0.3",
  },
  steps: [
    {
      caption:
        "Where did your transaction go after you pressed Send? Watch it travel across parallel shards.",
      explain:
        "In lesson 0.3 you sent a transaction and saw Final after a few seconds. The app asks an RPC node for the full record of what happened. Nothing new is sent. If you skipped 0.3, open the recorded example: a real testnet transaction with several hops.",
      explainAt: "mailbox",
      action: { label: "load the transaction path", gate: true },
    },
    {
      caption:
        "NEAR splits accounts across parallel tracks called shards. Every block holds one chunk per shard.",
      explain:
        "A shard is a slice of the network's accounts. A chunk is the work one shard packed for one block. Each ribbon is a shard; each column is a block, time running left to right. The number of shards changes when the network splits again, so the app reads the layout live.",
      explainAt: "grid",
    },
    {
      caption: "Your transaction started on shard {firstShard}, in block #{firstBlock}.",
      explain:
        "An account lives on exactly one shard, picked by sorting account names against a list of boundary accounts. The transaction runs on the signer's shard, in the chunk that shard made for that block. There it turns into a receipt: a delivery slip for the receiver's shard.",
      explainAt: "hop",
    },
    {
      caption: "Follow each receipt: {hops} steps across {shardsTouched} and {blocksCount}.",
      explain:
        "A receipt travels to the receiver's shard and runs there in a later block. A refund of unused gas is a receipt too, going back to the signer's shard. Every step waits for the next block, even on the same shard.",
      explainAt: "hop",
      action: { label: "follow every receipt", gate: true },
    },
    {
      caption:
        "Remember {finalSeen}? Here is where it went: {workTime} of block-to-block hops, plus finality.",
      explain:
        "A new block comes about every second or less, and each receipt waited for the next one. The rest of the time was handing the transaction to the RPC node and waiting for finality: the point where validators agree a block can no longer change. The hop times come from block timestamps.",
      explainAt: "time",
    },
    {
      caption: "Three quick questions on shards, chunks and receipts.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: what sharding gives NEAR, and what it costs.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
