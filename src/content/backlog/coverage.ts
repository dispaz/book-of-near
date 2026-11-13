import type { Coverage } from "./topicCards";

/**
 * Which curriculum topics (`docs/curriculum/topics.json`, matched by the start of the name) each lesson
 * teaches. Every other topic becomes a locked card. Mostly the showpiece's `covers` list from the map.
 * When a lesson lands that teaches a carded topic, add it here (or give the lesson the card's id).
 */
export const LESSON_TOPICS: Coverage = {
  "l-0-1-blockchain-basics": ["Money, ledgers", "Hashing and blocks"],
  "l-0-2-make-a-wallet": [
    "What a crypto wallet",
    "Wallet creation",
    "Key standards",
    "Public/private keys",
    "Self-custody",
  ],
  "l-0-3-send-a-transaction": [
    "Transaction lifecycle",
    "What RPCs",
    "How wallets interact",
    "Transactions, fees",
    "Reading a block explorer",
  ],
  "l-1-1-claim-your-name": ["Named accounts", "Implicit accounts", "NEAR token", "Wallets: Meteor"],
  "l-1-2-function-call-key": ["Access keys", "How NEAR apps connect"],
  "l-1-3-inside-a-transaction": ["NEAR transaction anatomy", "Storage staking"],
  "l-2-1-follow-across-shards": ["Sharding: Nightshade", "Doomslug"],
  "l-2-2-call-across-blocks": ["Receipts and", "Gas economics"],
  "l-3-1-deploy-a-contract": ["Contracts in WebAssembly", "Cross-contract calls", "Contract state"],
  "l-3-2-issue-a-token": ["Token standards", "Meta-transactions"],
  "l-3-3-race-the-rpc": ["RPC providers vs", "Data infrastructure"],
  "l-4-1-one-account-every-chain": ["Chain Signatures", "Multichain accounts"],
  "l-4-2-intent-swap": ["NEAR Intents"],
  "l-4-3-old-bridge-vs-near": ["Omni Bridge", "Confidential Intents"],
  "l-5-1-private-ai": ["TEEs and", "NEAR AI Cloud", "User-owned AI"],
  "l-5-2-agent-with-no-owner": ["Shade Agents"],
  "l-7-1-trace-an-intent": ["Capstone: trace"],
};
