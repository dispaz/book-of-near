import type { LessonManifest } from "../../../app/types";

// Topic: docs/lessons/stage-3/3.3-topic.md. Lesson script: docs/lessons/stage-3/3.3.md.
// Template: docs/lesson-template.md.
// Shape: hook (an RPC node is your window) → do (race three providers) → do (switch FastNEAR off) →
// do (failover) → do (an old block: regular vs archival node) → check → honest take. Keep steps.ts in sync.
// Every request goes through Chain.probeRpc. Demo mode answers after round trips recorded once on
// 12 Nov 2026 (src/chain/rpcEndpoints.ts); testnet mode times real requests from the learner's browser.
// The outage is simulated in the browser: the lesson never sends anything to a blocked provider.
export default {
  id: "l-3-3-race-the-rpc",
  stage: 3,
  order: 3,
  title: "Race the RPC nodes",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useRace); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Send the same question to several RPC nodes, compare the answers and watch failover.",
  // The learner's own numbers; these show only before the race has run.
  vars: {
    fastest: "The fastest provider",
    fastestMs: "a few hundred",
    slowest: "the slowest",
    slowestMs: "more",
    backup: "NEAR Foundation",
    backupMs: "its own",
  },
  steps: [
    {
      caption: "Your wallet does not talk to every validator. It talks to one RPC node.",
      explain:
        "An RPC node (RPC: Remote Procedure Call) is a server your app sends its questions and transactions to. It is a window into the blockchain, not the blockchain itself. If your app uses one provider and that provider goes down, your users are locked out, even while the chain keeps making blocks.",
      explainAt: "windows",
    },
    {
      caption: "Send the same block question to three providers at the same moment.",
      explain:
        "A client can ask several providers at once and use the first good answer; the slower answers are dropped. Each bar is a round trip: the time from asking to getting the answer, in milliseconds (ms).",
      explainAt: "bars",
      action: { label: "race the nodes", gate: true },
    },
    {
      caption:
        "{fastest} answered first, in {fastestMs} ms. What if FastNEAR, first in your app's list, goes down?",
      explain:
        "Busy public providers can answer 429 Too Many Requests or 503 Service Unavailable. Resilient apps keep a fallback list (in near-kit: fallbackRpcUrls), other providers to try next. Switch FastNEAR off. The lesson blocks it inside your browser, so nothing is sent to it.",
      explainAt: "windows",
      action: { label: "disable FastNEAR", gate: true },
    },
    {
      caption: "Send a new question. The client gets an error and moves to the next provider.",
      explain:
        "The question goes to FastNEAR first and comes back 503. The client tries the next provider in its list, and {backup} answers after {backupMs} ms. It may be slower, but your app keeps working.",
      explainAt: "windows",
      action: { label: "send a query via failover", gate: true },
    },
    {
      caption: "Ask for block #100,000,000, made in September 2022. A regular node no longer has it.",
      explain:
        "Regular RPC nodes keep only the last 5 epochs of history (an epoch is a stretch of blocks with a fixed set of validators), so a few days at most. Older blocks live on archival nodes, which keep every block since the first one.",
      explainAt: "archive",
      action: { label: "query the historical block", gate: true },
    },
    {
      caption: "Three quick questions on RPC nodes, failover and archival data.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: many open RPC providers, and the work of keeping a list of them.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
