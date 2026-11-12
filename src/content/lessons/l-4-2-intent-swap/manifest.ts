import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-4/4.2.md (topic: 4.2-topic.md). Template: docs/lesson-template.md.
// Shape: hook → declare the intent (quote) → inspect the quote → the solver fills it → finish on the
// dry quote or an optional tiny real swap → check → honest take. Keep the step numbers in steps.ts in sync.
// 1Click has no testnet (spike 6): demo mode uses a recorded quote, testnet mode a live DRY quote through
// the Worker. 1Click returns one winning quote, so the other solvers in the scene are a drawing.
export default {
  id: "l-4-2-intent-swap",
  stage: 4,
  order: 2,
  title: "Swap across chains with an intent",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useIntentSwap); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Ask for a cross-chain swap and see who offers to fill it.",
  vars: {
    usdcOutput: "about 20",
    timeEstimate: "30",
  },
  steps: [
    {
      caption: "Why spend 20 minutes bridging tokens when you can just say what you want?",
      explain:
        'With a bridge (a service that moves tokens between chains), you approve tokens, wrap them, bridge them, pay gas in two coins and wait. With NEAR Intents, you sign what you want, for example "Trade 5 NEAR for USDC on Arbitrum". An intent is a signed message that states the result you want, not the steps to get there.',
      explainAt: "origin",
    },
    {
      caption: "Choose your trade: swap 5 NEAR for native USDC on Arbitrum.",
      explain:
        "You name only what you give and what you want back. You do not pick a bridge or an exchange. Competing market makers, called solvers, work out the route. A solver is a company or bot that fills orders with its own money.",
      explainAt: "parcel",
      action: { label: "fetch a live intent quote", gate: true },
    },
    {
      caption:
        "Inspect the winning solver quote: {usdcOutput} USDC delivered in under {timeEstimate} seconds.",
      explain:
        "The 1Click API (NEAR Intents' web service) asks the solvers and returns the best quote. The quote guarantees a minimum output (minAmountOut), so a price move cannot give you less. Slippage tolerance is how far the final price may move from the quote; here it is 1%.",
      explainAt: "parcel",
      action: { label: "inspect the quote breakdown", gate: true },
    },
    {
      caption: "Watch the solver fill the order: USDC on Arbitrum at once, with no bridge delay.",
      explain:
        "The solver does not wait for a bridge. It already holds USDC on Arbitrum. It sends native USDC straight to your Arbitrum address, then claims your NEAR from the verifier contract on NEAR (intents.near). The verifier releases your NEAR only once it has proof that you were paid.",
      explainAt: "solver",
      action: { label: "simulate the solver", gate: true },
    },
    {
      caption:
        "Finish safely on the dry-run quote, or try a tiny real swap if you have a funded mainnet wallet.",
      explain:
        "A dry-run quote is a real, signed price with no deposit, so no money moves. If your connected mainnet wallet can pay, the app also offers an optional tiny real swap, capped at $1. Otherwise you finish on the quote and spend nothing.",
      explainAt: "destination",
      action: { label: "choose how to finish", gate: true },
    },
    {
      caption: "Three questions on intents, solvers and 1Click swaps.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: intent swaps compared with automated market makers (AMMs).",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
