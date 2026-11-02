import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-0/0.1.md. Template: docs/lesson-template.md.
// Shape: hook → concept → do (gated) → check (gated) → honest take. Keep the step numbers in Scene.tsx in sync.
export default {
  id: "l-0-1-blockchain-basics",
  stage: 0,
  order: 1,
  title: "How a blockchain and a transaction work",
  status: "ready",
  needsChain: false,
  summary: "Move coins on a toy ledger, watch blocks link by hash, then try to change history.",
  // The scene replaces these with what the learner actually sent (see SceneProps.setVars).
  vars: { sent: "3", tamper: "9" },
  steps: [
    {
      caption: "Ana, Ben and Cy keep one notebook of who owns how many coins. Everyone holds a copy.",
      explain:
        "A ledger is a list of who owns what. Banks keep their own ledger and you trust them. Here the three friends each keep an identical copy. Nobody is in charge, so they must agree on every new line.",
      action: { label: "open a notebook", gate: true },
    },
    {
      caption: "Send 3 coins from Ana to Ben. A request to change the ledger is called a transaction.",
      explain:
        'A transaction is a request to change the ledger, such as "Ana pays Ben 3". It is checked first: Ana must own at least 3 coins. If the check fails, the transaction is rejected and nothing changes.',
      action: { label: "press Send", gate: true },
    },
    {
      caption: "Transactions are packed into a block. A new block is added to the end of the chain.",
      explain:
        "A block is a page of the notebook: a batch of transactions written down together. Block #0, the genesis block, holds the starting balances. Blocks are only ever added to the end. Bitcoin aims for one block about every 10 minutes. NEAR makes one about every second or less.",
      action: { label: "open block #1", gate: true },
    },
    {
      caption:
        "Each block gets a hash: a short fingerprint of everything inside it. Change one letter and the fingerprint changes.",
      explain:
        "A hash is a short code computed from data. The same data always gives the same hash. Any small change gives a completely different hash. You cannot work backwards from the hash to the data. This toy uses SHA-256 and shows the first 8 characters.",
      action: { label: "change the text", gate: true },
    },
    {
      caption: 'Each block also stores the hash of the block before it. That is the chain in "blockchain".',
      explain:
        'Every block records the previous block\'s hash ("prev"). So block #2 depends on block #1, which depends on block #0. Send two more transactions and watch each new block point back. Bitcoin works this way too.',
      action: { label: "add blocks #2 and #3", gate: true },
    },
    {
      caption:
        "Pretend you are Ben. Change block #1 so Ana sent you {tamper} coins, not {sent}. Watch what happens.",
      explain:
        "Block #1's hash changes. Block #2 still stores the old hash, so the link breaks. Fixing block #2 changes its hash, which breaks block #3, and so on. To hide the edit you must redo every later block.",
      action: { label: "change block #1", gate: true },
    },
    {
      caption:
        "Ana and Cy compare their copies with Ben's. The hashes do not match, so they reject Ben's version.",
      explain:
        "Everyone can check the chain by recomputing hashes. A changed copy stands out at once. Real networks add rules for who may add the next block and what makes a block valid. Those rules are called consensus. Stage 2 shows NEAR's version.",
      action: { label: "compare copies", gate: true },
    },
    {
      caption: "Three quick questions. Then the honest take.",
      action: { label: "answer the check", gate: true },
    },
    {
      caption: "Honest take: what blockchains, NEAR included, do well and do badly.",
    },
  ],
  // Both views draw one shared state (useLedgerLesson); 3D loads lazily from Scene.tsx.
  views: ["2d", "3d"],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
