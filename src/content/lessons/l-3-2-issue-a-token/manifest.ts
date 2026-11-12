import type { LessonManifest } from "../../../app/types";

// Topic: docs/lessons/stage-3/3.2-topic.md. Lesson script: docs/lessons/stage-3/3.2.md.
// Template: docs/lesson-template.md.
// Shape: hook (your own token) → do (mint, a refused transfer, the storage deposit, a gasless transfer
// through the relayer) → check → honest take. Keep the step numbers in steps.ts in sync.
export default {
  id: "l-3-2-issue-a-token",
  stage: 3,
  order: 2,
  title: "Issue your own token",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useToken); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Create a practice token and send some to a friend.",
  vars: { symbol: "BOOK", supply: "1,000" },
  steps: [
    {
      caption: "Create your own fungible token. On NEAR, tokens follow the NEP-141 standard.",
      explain:
        "A fungible token is a token where every unit is the same, like coins. NEP-141 is NEAR's standard for them, as ERC-20 is on Ethereum. You pick a name, a ticker symbol (like BOOK) and a total supply. The token contract keeps a table of balances: who holds how many.",
      explainAt: "stamp",
    },
    {
      caption: "Mint {supply} {symbol} tokens into your account.",
      explain:
        "One transaction creates the token's own account, deploys the token contract and calls new. new writes your balance record: you hold the whole supply. Here the token contract is a demo stand-in that follows NEP-141 and NEP-145.",
      explainAt: "stamp",
      action: { label: "mint your tokens", gate: true },
    },
    {
      caption: "Try to send 50 {symbol} to friend.testnet. Watch the token contract refuse.",
      explain:
        "Every balance record takes storage, and on NEAR storage needs locked NEAR (lesson 3.1). If anyone could send tokens to any account, an attacker could make millions of tiny records and drain the contract's NEAR. So the contract refuses a transfer to an account that is not registered with it.",
      explainAt: "padlock",
      action: { label: "send to an unregistered friend", gate: true },
    },
    {
      caption: "Pay a small storage deposit (0.00125 NEAR) to register your friend with your token.",
      explain:
        "NEP-145 is NEAR's storage management standard. storage_deposit pays for the bytes of one balance record, once per account and per token. Anyone can pay it for someone else. The NEAR stays locked in the token contract, and the account gets it back if it empties its balance and unregisters.",
      explainAt: "padlock",
      action: { label: "register your friend", gate: true },
    },
    {
      caption: "Send 50 {symbol} without spending any NEAR. A relayer pays the gas for you.",
      explain:
        "A meta-transaction (NEP-366) lets someone else pay. You sign the transfer off-chain as a SignedDelegateAction: no NEAR needed. A relayer, a server with its own account, wraps it in a transaction and pays the gas. The network checks your signature and runs the transfer as you. This demo relayer pays for up to 3 transfers per visit, then refuses. It keeps its count in memory, so reloading the page resets it.",
      explainAt: "parcel",
      action: { label: "send a gasless transfer", gate: true },
    },
    {
      caption: "Three quick questions on NEP-141 tokens, storage deposits and relayers.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: storage registration friction, and meta-transactions built into the protocol.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
