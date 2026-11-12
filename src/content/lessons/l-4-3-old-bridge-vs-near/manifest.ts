import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-4/4.3.md (topic: 4.3-topic.md). Template: docs/lesson-template.md.
// Shape: hook → the two timelines side by side → inspect the wrapped token → simulated vault exploit →
// confidential intents → check → honest take. Keep the step numbers in steps.ts in sync.
// No chain access: the bridge figures are labelled estimates; the intent's time and fee come from a 1Click
// quote (recorded in demo mode, a live dry quote in testnet mode, through src/chain/intents.ts).
export default {
  id: "l-4-3-old-bridge-vs-near",
  stage: 4,
  order: 3,
  title: "Old bridge vs the NEAR way",
  status: "ready",
  needsChain: false,
  // Both views draw one state (useBridgeCompare); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Compare a classic token bridge with NEAR's approach.",
  vars: {
    intentTime: "about 27 s",
  },
  steps: [
    {
      caption: "Over $2.8 billion has been stolen in bridge hacks. Why are bridges so fragile?",
      explain:
        'A bridge moves tokens from one chain to another. A classic bridge locks your coins in a vault (a smart contract that holds money) on one chain and mints "wrapped tokens" on the other. A wrapped token is an IOU: a claim on the coins in the vault. If the vault is hacked, the IOUs lose their backing.',
      explainAt: "vault",
    },
    {
      caption: "Count the steps: 6 for the old bridge, 2 for an intent ({intentTime}).",
      explain:
        "The old way: approve the token, lock it in the vault, wait for the bridge's signers, mint the wrapped token, swap it, and later burn it to get your coins back. The NEAR way: sign an intent (a message that says what you want), and a solver delivers native coins. A solver is a market maker that fills orders with its own money. Figures marked est. are estimates; the intent's time and fee come from a 1Click quote.",
      explainAt: "timelines",
      action: { label: "compare the two paths", gate: true },
    },
    {
      caption: "Look at what a wrapped token really is: an IOU, not the real coin.",
      explain:
        "If you hold wETH or USDC.e on another chain, you do not hold real ether or real USDC. You hold a claim ticket on a bridge vault. A native asset is the token issued directly on its home chain, like native USDC on Arbitrum. The intent path delivers that one.",
      explainAt: "slip",
      action: { label: "inspect asset backing", gate: true },
    },
    {
      caption: "An attacker finds a bug in the bridge vault. See what happens to each path.",
      explain:
        "This is a simulation. The attacker drains the vault on Ethereum. On the old bridge path, every wrapped token loses its backing and its value falls to zero. On the intent path you hold native USDC, which no bridge vault backs, so you lose nothing. A vault this full is called a honeypot: a big pool of locked money that draws attackers.",
      explainAt: "vault",
      action: { label: "trigger the simulated vault exploit", gate: true },
    },
    {
      caption: "Confidential intents hide the size of your order from front-runners.",
      explain:
        "On a public chain, bots can see a large trade before it runs and trade ahead of it. This is front-running. NEAR Intents can also run as confidential intents: the trade's numbers stay encrypted until a solver is matched, so bots cannot see the size.",
      explainAt: "shield",
      action: { label: "inspect the confidential shield", gate: true },
    },
    {
      caption: "Three questions on bridge risks, wrapped tokens and native delivery.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: solver spreads compared with bridge vault risk.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
