/**
 * The final exam's questions, WITHOUT answers (issue #28). This file ships to every browser. Which
 * option is right lives only in `answerKey.ts`: the Worker grades testnet exams with it, and demo mode
 * loads it as a separate chunk only when a demo exam is graded (`examFlow.ts`). That keeps answers off
 * the page before grading; it does not make them secret (see `answerKey.ts`).
 *
 * Every question comes from a lesson's own check (the `QUESTIONS` array in the lesson's Scene.tsx,
 * written from docs/lessons/stage-<n>/<order>.md), so it only tests what a lesson teaches. Options are
 * in a different order than in the lesson, so the right answer is not always first.
 *
 * Fixed sets, no random draw: each route asks the same 15 questions every time, so tests and
 * explanations stay stable. The two routes share no question.
 */
import type { ExamRoute } from "./routes";

export interface ExamQuestion {
  /** Stable id, also the answer key's key. */
  id: string;
  stage: number;
  lessonId: string;
  route: ExamRoute;
  prompt: string;
  options: string[];
}

export const EXAM_QUESTIONS: ExamQuestion[] = [
  // ---------- General route ----------
  {
    id: "q-0-1-hash-link",
    stage: 0,
    lessonId: "l-0-1-blockchain-basics",
    route: "general",
    prompt: "Why does changing an old block break the chain?",
    options: [
      "The network deletes any block older than one hour.",
      "The block's hash changes, and the next block still stores the old hash.",
      "Old blocks are locked with a password.",
    ],
  },
  {
    id: "q-0-2-seed-phrase",
    stage: 0,
    lessonId: "l-0-2-make-a-wallet",
    route: "general",
    prompt: 'A website asks you to paste your seed phrase to "verify your wallet". What should you do?',
    options: [
      "Paste only the first six words.",
      "Paste it; the site only reads it.",
      "Close the page. Real wallets never need your seed phrase on a website.",
    ],
  },
  {
    id: "q-0-3-nonce",
    stage: 0,
    lessonId: "l-0-3-send-a-transaction",
    route: "general",
    prompt: "Why does each transaction carry a nonce (a counter)?",
    options: [
      "So the same signed transaction cannot be sent again to move coins twice.",
      "To pay the fee.",
      "To hide the amount.",
    ],
  },
  {
    id: "q-1-1-valid-id",
    stage: 1,
    lessonId: "l-1-1-claim-your-name",
    route: "general",
    prompt: "Which account id is valid?",
    options: ["Ana.testnet", "ana..testnet", "ana-1.testnet"],
  },
  {
    id: "q-1-2-fc-key-cannot",
    stage: 1,
    lessonId: "l-1-2-function-call-key",
    route: "general",
    prompt: "What can a function-call key not do?",
    options: [
      "Call a method on the one contract it names.",
      "Send NEAR to another account.",
      "Pay gas from its allowance.",
    ],
  },
  {
    id: "q-1-3-atomic-actions",
    stage: 1,
    lessonId: "l-1-3-inside-a-transaction",
    route: "general",
    prompt:
      "A transaction creates an account, sends it NEAR, then adds a key the account already has. What is left afterwards?",
    options: [
      "The account exists with the NEAR, but without the key.",
      "No new account. The NEAR came back; only the fee is spent.",
      "Nothing at all, not even the fee.",
    ],
  },
  {
    id: "q-2-1-chunk",
    stage: 2,
    lessonId: "l-2-1-follow-across-shards",
    route: "general",
    prompt: "What is a chunk on NEAR?",
    options: [
      "A piece of your private key.",
      "Another word for the whole blockchain.",
      "The transactions and receipts one shard ran for one block.",
    ],
  },
  {
    id: "q-2-2-gas-burned",
    stage: 2,
    lessonId: "l-2-2-call-across-blocks",
    route: "general",
    prompt: "What happens to the gas a contract's code burns?",
    options: [
      "30% goes to the contract's account.",
      "All of it is burned. No account receives it.",
      "It goes back to the user as a discount.",
    ],
  },
  {
    id: "q-4-1-who-holds-key",
    stage: 4,
    lessonId: "l-4-1-one-account-every-chain",
    route: "general",
    prompt: "Who holds the private key for the Ethereum address derived from your NEAR account?",
    options: [
      "Nobody holds the whole key. It exists only as shares spread across the signing nodes.",
      "The NEAR Foundation keeps it in a safe.",
      "Your browser stores it next to your NEAR key.",
    ],
  },
  {
    id: "q-4-2-intent-vs-tx",
    stage: 4,
    lessonId: "l-4-2-intent-swap",
    route: "general",
    prompt: "What is the main difference between an intent and a normal transaction?",
    options: [
      "An intent needs no signature.",
      "An intent spells out every step and every contract call in advance.",
      "An intent states the result you want; solvers find and carry out the best route.",
    ],
  },
  {
    id: "q-4-3-wrapped-backing",
    stage: 4,
    lessonId: "l-4-3-old-bridge-vs-near",
    route: "general",
    prompt: "A bridge vault holding real USDC is hacked. What happens to the wrapped tokens on other chains?",
    options: [
      "A central bank pays every holder back.",
      "They lose their backing and their value falls towards zero.",
      "Nothing. The other chain still records them, so they keep their value.",
    ],
  },
  {
    id: "q-5-1-tee",
    stage: 5,
    lessonId: "l-5-1-private-ai",
    route: "general",
    prompt: "What makes a TEE (a secure enclave in the processor) different from ordinary cloud hosting?",
    options: [
      "The processor encrypts its memory in hardware, so even root admins cannot read it.",
      "It deletes your data after 30 days.",
      "It makes users pay with Bitcoin instead of credit cards.",
    ],
  },
  {
    id: "q-6-1-venear",
    stage: 6,
    lessonId: "l-6-1-vote-on-a-proposal",
    route: "general",
    prompt: "What is the main purpose of the veNEAR (vote-escrow) model?",
    options: [
      "To make users pay extra fees to validators.",
      "To give more voting power to people who keep their NEAR locked longer.",
      "To burn half of all liquid NEAR.",
    ],
  },
  {
    id: "q-7-1-fc-key-intent",
    stage: 7,
    lessonId: "l-7-1-trace-an-intent",
    route: "general",
    prompt: "In the capstone, why is the intent authorized with a function-call key?",
    options: [
      "Because full-access keys cannot connect to the internet.",
      "Because a function-call key pays no gas.",
      "So that even if the app is compromised, the account's full-access key and main funds stay safe.",
    ],
  },
  {
    id: "q-7-2-sharding-tradeoff",
    stage: 7,
    lessonId: "l-7-2-honest-scoreboard",
    route: "general",
    prompt: "What is the main trade-off of NEAR's sharded design?",
    options: [
      "Calls between contracts are asynchronous: they take several blocks and do not roll back as one.",
      "Transactions can never be private.",
      "The chain must stop every Sunday for maintenance.",
    ],
  },

  // ---------- Developer route ----------
  {
    id: "q-0-2-signature",
    stage: 0,
    lessonId: "l-0-2-make-a-wallet",
    route: "developer",
    prompt: "You change one letter of a signed message. What happens when someone verifies it?",
    options: [
      "It still passes, because the public key is the same.",
      "Verification fails, because the signature no longer matches the message.",
      "The signature updates itself.",
    ],
  },
  {
    id: "q-0-3-rpc",
    stage: 0,
    lessonId: "l-0-3-send-a-transaction",
    route: "developer",
    prompt: "What does an RPC node do?",
    options: [
      "It holds your private key and signs for you.",
      "It is the website where you look up transactions.",
      "It passes your signed transaction into the network and answers questions about the chain.",
    ],
  },
  {
    id: "q-1-2-revoke",
    stage: 1,
    lessonId: "l-1-2-function-call-key",
    route: "developer",
    prompt: "How do you take back a key you gave to an app?",
    options: [
      "Delete the key with a transaction signed by your full-access key.",
      "Ask the app to forget it.",
      "Move all your NEAR to another account.",
    ],
  },
  {
    id: "q-1-3-one-receiver",
    stage: 1,
    lessonId: "l-1-3-inside-a-transaction",
    route: "developer",
    prompt: "Can one NEAR transaction act on two different accounts?",
    options: ["Yes, each action can name its own account.", "No. All its actions go to its one receiver."],
  },
  {
    id: "q-2-1-first-shard",
    stage: 2,
    lessonId: "l-2-1-follow-across-shards",
    route: "developer",
    prompt: "Which shard runs your transaction first?",
    options: [
      "The shard that holds the receiver's account.",
      "A random shard picked by lottery.",
      "The shard that holds the signer's account.",
    ],
  },
  {
    id: "q-2-2-callback-failure",
    stage: 2,
    lessonId: "l-2-2-call-across-blocks",
    route: "developer",
    prompt:
      "Your contract calls another contract, which panics and fails. What happens to your contract's earlier changes?",
    options: [
      "They stay committed. Your callback must see the failure and undo them itself.",
      "Every change reverts automatically, as on Ethereum.",
      "The whole blockchain stops and rolls the block back.",
    ],
  },
  {
    id: "q-3-1-storage",
    stage: 3,
    lessonId: "l-3-1-deploy-a-contract",
    route: "developer",
    prompt: "How is data storage paid for on NEAR?",
    options: [
      "By paying a monthly fee to the network.",
      "Storage is free and unlimited.",
      "By locking a refundable deposit of 1 NEAR per 100 KB of data stored.",
    ],
  },
  {
    id: "q-3-1-wasm",
    stage: 3,
    lessonId: "l-3-1-deploy-a-contract",
    route: "developer",
    prompt: "What code format do NEAR smart contracts compile down to?",
    options: ["EVM bytecode.", "Standard WebAssembly (Wasm).", "Java bytecode for the JVM."],
  },
  {
    id: "q-3-2-unregistered",
    stage: 3,
    lessonId: "l-3-2-issue-a-token",
    route: "developer",
    prompt: "Why does sending a new token to an unregistered account fail by default?",
    options: [
      "The receiver has no storage deposit to pay for its balance record in the token contract.",
      "The receiver must sign the transfer too.",
      "The token contract only sends to accounts older than a day.",
    ],
  },
  {
    id: "q-3-2-meta-tx",
    stage: 3,
    lessonId: "l-3-2-issue-a-token",
    route: "developer",
    prompt: "How do meta-transactions (NEP-366) help new users?",
    options: [
      "They make transactions untraceable.",
      "They remove the need for private keys.",
      "They can send tokens without holding NEAR for gas first.",
    ],
  },
  {
    id: "q-3-3-archival",
    stage: 3,
    lessonId: "l-3-3-race-the-rpc",
    route: "developer",
    prompt: "What is the difference between a regular RPC node and an archival node?",
    options: [
      "Regular nodes cannot handle token transfers.",
      "A regular node keeps only the last 5 epochs of history; an archival node keeps every block since the first one.",
      "Archival nodes answer a different kind of request than regular nodes.",
    ],
  },
  {
    id: "q-4-1-derive-cost",
    stage: 4,
    lessonId: "l-4-1-one-account-every-chain",
    route: "developer",
    prompt: "How much does it cost to derive a new address on another chain from your NEAR account?",
    options: [
      "Nothing. It is math done in your browser, with no transaction.",
      "A small NEAR fee per address.",
      "1 ETH, paid on Ethereum.",
    ],
  },
  {
    id: "q-4-3-bridge-honeypot",
    stage: 4,
    lessonId: "l-4-3-old-bridge-vs-near",
    route: "developer",
    prompt: "How does NEAR's intent model avoid creating a bridge honeypot?",
    options: [
      "It makes all cross-chain transfers illegal.",
      "You receive native coins directly; the solvers carry the cross-chain inventory risk themselves.",
      "It deletes all smart contracts.",
    ],
  },
  {
    id: "q-6-1-flash-loan",
    stage: 6,
    lessonId: "l-6-1-vote-on-a-proposal",
    route: "developer",
    prompt: "A trader borrows 1,000,000 NEAR for 10 minutes to sway a House of Stake vote. What stops them?",
    options: [
      "Nothing: the richest account always wins.",
      "The loan contract blocks the vote.",
      "Voting power is fixed when the vote opens, and locked NEAR takes 45 days to come out.",
    ],
  },
  {
    id: "q-7-1-receipts",
    stage: 7,
    lessonId: "l-7-1-trace-an-intent",
    route: "developer",
    prompt: "How do NEAR's shards handle calls between contracts without locking the whole chain?",
    options: [
      "Through receipts that carry the call to the other shard and run in a later block.",
      "By stopping all transactions on all other shards.",
      "By running every contract on one shard.",
    ],
  },
];

/** The route's questions, in exam order. */
export const questionsFor = (route: ExamRoute): ExamQuestion[] =>
  EXAM_QUESTIONS.filter((q) => q.route === route);
