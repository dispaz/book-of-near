import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-6/6.1.md (topic: 6.1-topic.md). Template: docs/lesson-template.md.
// Shape: who decides → staking → the veNEAR lock (gated) → read the proposal (gated) → vote (gated) →
// check → honest take. Keep the step numbers in steps.ts in sync.
// Nothing here touches a chain: the proposal is an example written for the lesson (labelled so on the
// page) and the vote is a practice vote, so demo and testnet mode behave the same.
export default {
  id: "l-6-1-vote-on-a-proposal",
  stage: 6,
  order: 1,
  title: "Read and vote on a proposal",
  status: "ready",
  needsChain: false,
  // Both views draw one state (useGovernance); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Lock NEAR for veNEAR voting power, read a proposal and cast a practice vote.",
  steps: [
    {
      caption: "A network with no CEO still has to make decisions. Who decides how NEAR changes?",
      explain:
        "On NEAR, decisions about protocol settings, treasury grants and ecosystem rewards are made by governance: rules that let many people decide together. Token holders, validators and DAOs take part. A DAO (decentralized autonomous organization) is a group that runs shared funds by vote, with its rules in a smart contract.",
      explainAt: "hall",
    },
    {
      caption: "Delegate your NEAR to a validator: you earn rewards and help secure the network.",
      explain:
        "A validator runs a node that keeps NEAR's Proof of Stake network secure. You can delegate (lend the weight of) your NEAR to any validator's staking pool and earn rewards of a few percent a year. Your NEAR stays in the pool's contract, not with the validator. When you unstake, it unlocks after 4 epochs (an epoch is a fixed run of blocks), a little over a day.",
      explainAt: "pool",
    },
    {
      caption: "Why should long-term believers have a louder voice than day traders?",
      explain:
        "The House of Stake is NEAR's governance for people who lock their NEAR. Locking gives you veNEAR (vote-escrow NEAR), its voting power. There is no lock length to pick: 100 NEAR locked gives 100 veNEAR at once. While it stays locked, extra veNEAR grows. On mainnet the extra grows by half the locked NEAR each year, and the docs say it stops at 4 years. Unlock any amount and you lose all the extra, and the NEAR waits 45 days before you can take it out. Move the slider or pick the gauge.",
      explainAt: "gauge",
      action: { label: "set a lock", gate: true },
    },
    {
      caption: 'Read Proposal #42: "Allocate 50,000 NEAR for Open Source Tooling Grants".',
      explain:
        "This is an example proposal, made up for this lesson. Read who asks, how much, where the money goes and the quorum: the least voting power that must take part before the result counts. So far 62% voted yes and 38% no.",
      explainAt: "scroll",
      action: { label: "review the proposal", gate: true },
    },
    {
      caption: "Cast your weighted vote. This is a practice vote: it changes this page only.",
      explain:
        "Your vote counts with the veNEAR you set on step 3. On a real DAO, each vote is a transaction recorded on chain. Here it is a practice vote: it moves this page's tally and quorum bar, and sends nothing.",
      explainAt: "stamps",
      action: { label: "cast your vote", gate: true },
    },
    {
      caption: "Three questions on veNEAR, staking and DAOs.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: on-chain governance compared with rough consensus.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
