import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-6/6.2.md (topic: 6.2-topic.md). Template: docs/lesson-template.md.
// Shape: the money map → native USDC (gated) → the oracle (gated) → one trade, two pools (gated) → the
// intent flows → check → honest take. Keep the step numbers in steps.ts in sync.
// Nothing here touches a chain: every figure is RECORDED data from 13 Nov 2026 (money.ts), labelled so on
// the page, and the trade is worked out from recorded pool quotes. Demo and testnet mode behave the same.
export default {
  id: "l-6-2-live-money-map",
  stage: 6,
  order: 2,
  title: "The live money map",
  status: "ready",
  needsChain: false,
  // Both views draw one state (useMoneyMap); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Stablecoins, pools, lending and oracles on NEAR, from data recorded on 13 Nov 2026.",
  steps: [
    {
      caption: "What turns a blockchain into an economy? Stable money, swaps, loans and prices.",
      explain:
        "DeFi (decentralized finance) is money services run by smart contracts that anyone can use, with no bank in the middle. On NEAR the four corners are stablecoins, an exchange (Rhea Dex, which was Ref Finance), lending (Rhea Lend, which was Burrow) and oracles. Together they held about $162 million on 13 Nov 2026: that is the TVL, total value locked. Pick any corner.",
      explainAt: "map",
    },
    {
      caption: "Two tokens are called USDC on NEAR. Only one is issued by Circle.",
      explain:
        "A stablecoin is a token meant to stay worth one dollar. Circle issues USDC on NEAR itself, so no bridge stands between you and Circle. USDC.e is a copy a bridge mints when USDC is locked on Ethereum: it is only as safe as that bridge (lesson 4.3). They are different tokens. Compare them, or pick the mailbox.",
      explainAt: "usdc",
      action: { label: "compare the two USDCs", gate: true },
    },
    {
      caption: "A contract cannot open a website. How does it learn NEAR's price?",
      explain:
        "An oracle is a service that writes outside data, like prices, onto the chain, signed. Pyth works by pull: an app fetches a signed price and sends it with its transaction, so the stored price is as old as the last update. Pyth no longer supports NEAR. Read what its contract still holds.",
      explainAt: "oracle",
      action: { label: "read the oracle", gate: true },
    },
    {
      caption: "Trade USDC in two Rhea pools. Watch the price as the trade grows.",
      explain:
        "An AMM (automated market maker) is an exchange where a pool of tokens and a formula set the price. A simple pool keeps X × Y the same, so a big trade moves the price against you: that is slippage. A stable pool uses a curve that keeps same-value tokens near 1:1. These quotes were recorded from the pools on 13 Nov 2026. Nothing is sent. Try up to 100,000 USDC.",
      explainAt: "pools",
      action: { label: "trade 100,000 USDC", gate: true },
    },
    {
      caption: "NEAR Intents settle on NEAR. More money passes through than sits in its pools.",
      explain:
        "In stage 4 you met intents: you say what you want, solvers compete to fill it, and the trade settles on NEAR. DefiLlama counted $176 million of NEAR Intents trades in the 24 hours to 13 Nov 2026, more than all of NEAR's DeFi TVL. Where each solver finds its money is up to the solver.",
      explainAt: "intents",
    },
    {
      caption: "Three questions on stablecoins, oracles and pools.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: NEAR DeFi next to Ethereum and Solana.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
