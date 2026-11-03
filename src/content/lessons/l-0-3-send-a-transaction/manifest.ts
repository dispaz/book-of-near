import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-0/0.3.md. Template: docs/lesson-template.md.
// Shape: hook (your account) → concept + do (build, fee, sign, send) → watch (included, final) →
// explorer → check → honest take. Keep the step numbers in useTransaction.ts in sync.
export default {
  id: "l-0-3-send-a-transaction",
  stage: 0,
  order: 3,
  title: "Send a transaction and watch it",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useTransaction); the 3D view (Scene3D) loads only when chosen.
  views: ["2d", "3d"],
  summary: "Send a tiny practice transfer and follow it from build to final.",
  steps: [
    {
      caption:
        "This is your practice account. Testnet coins are free and worth nothing, so mistakes cost nothing.",
      explain:
        "Testnet is a copy of NEAR for practice. Its tokens have no value. Mainnet is the real network. Your practice account is an implicit account, like in 0.2. The app funded it from a faucet: a service that gives out free testnet tokens. In demo mode it all runs in your browser.",
      action: { label: "wait for your balance", gate: true },
    },
    {
      caption: "Fill in who sends, who receives and how much. The app adds a nonce and a recent block hash.",
      explain:
        "A transaction names the sender, the receiver and the actions, here one transfer. The nonce is a counter: each new transaction from a key must use a higher number, so an old one cannot be sent again. The recent block hash makes the transaction expire if it waits too long.",
      action: { label: "press Build", gate: true },
    },
    {
      caption:
        "Every transaction pays a small fee for the work it causes. On NEAR a simple transfer costs about 0.000045 NEAR.",
      explain:
        "Gas measures the work a transaction makes the network do. Each action has a fixed gas cost. The fee is gas times the gas price. NEAR takes a bit more up front and gives the extra back about a block later. So your balance dips slightly more, then recovers.",
      action: { label: "press Got it", gate: true },
    },
    {
      caption:
        "Your private key signs the transaction, just like the message in 0.2. Its hash becomes the transaction ID.",
      explain:
        "The wallet hashes the transaction (SHA-256) and signs that hash with the private key. Anyone can check it with your public key. The hash is also the transaction ID: a unique name you can look up later. Signing happens on your device, with no network.",
      action: { label: "press Sign", gate: true },
    },
    {
      caption:
        "The signed transaction goes to an RPC node: a server that passes it into the network and answers questions about it.",
      explain:
        "An RPC node is a computer connected to the network that apps talk to. It forwards your transaction to the validators, the computers that make blocks. It can also report status. You trust it to answer honestly, so apps often keep a backup node.",
      action: { label: "press Send", gate: true },
    },
    {
      caption: "A validator put your transaction in a block. The coins move, but the block is not final yet.",
      explain:
        "Included means the transaction is written in a new block. The transfer runs and balances change. A brand-new block could in rare cases still be replaced, so careful apps wait one more step. On NEAR a new block comes about every 0.6 to 1 second.",
      action: { label: "wait for Final", gate: true },
    },
    {
      caption:
        "Final: the network has agreed this block will never change. NEAR docs put this at about 1.2 seconds.",
      explain:
        "Finality is the point where a transaction cannot be reversed. NEAR's docs give about 1.2 seconds. Ethereum's site says about 15 minutes. Bitcoin has no fixed point; people wait for more blocks on top. The small gas refund also lands now.",
      action: { label: "wait for Final", gate: true },
    },
    {
      caption: "A block explorer is a public website that shows every transaction. Open yours on NearBlocks.",
      explain:
        "A block explorer reads the chain and shows it as web pages: blocks, accounts and transactions. Anyone can look up any transaction. That is the public side of a blockchain, from 0.1. NearBlocks is a popular NEAR explorer.",
      action: { label: "open the explorer", gate: true },
    },
    {
      caption: "Three quick questions. Then the honest take.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: what NEAR does well and badly when you send a transaction.",
      action: { label: "send a transfer first", gate: true },
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
