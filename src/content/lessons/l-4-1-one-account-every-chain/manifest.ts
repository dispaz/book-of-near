import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-4/4.1.md (topic: 4.1-topic.md). Template: docs/lesson-template.md.
// Shape: hook → derive an address → pack a Sepolia transfer → the signing network signs → check who
// signed → check → honest take. Keep the step numbers in steps.ts in sync.
// The signed transaction is NOT broadcast to Sepolia: every derived address starts with 0 ETH (spike 5),
// so the lesson stops at "signed and verified" and says why.
export default {
  id: "l-4-1-one-account-every-chain",
  stage: 4,
  order: 1,
  title: "One account, every chain",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useChainSig); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "See how one NEAR account can control addresses on other chains.",
  vars: {
    name: "your account",
    path: "ethereum-1",
    derivedEthAddress: "your new address",
    signer: "v1.signer-prod.testnet",
  },
  steps: [
    {
      caption:
        "Ethereum, Bitcoin, Solana. Why should you need a separate wallet and seed phrase for each one?",
      explain:
        "Each chain has its own wallets and keys, so using several chains means several seed phrases and several kinds of gas money. On NEAR, one account can sign transactions for other chains too. The feature is called Chain Signatures.",
      explainAt: "mailbox",
    },
    {
      caption: 'Derive an Ethereum address from your NEAR name ({name}) and the path "{path}".',
      explain:
        "Your address on another chain is worked out from three things: your NEAR account ID, a derivation path (any label you pick) and the signing network's master public key. It is math done in your browser: no transaction, no fee. Another path gives another address.",
      explainAt: "address",
      action: { label: "derive your Ethereum address", gate: true },
    },
    {
      caption: "Pack a transfer on Sepolia, Ethereum's test network. Your new address holds 0 ETH.",
      explain:
        "This is a normal Ethereum transaction: who it goes to, how much, gas, fees and a nonce (a counter, 0 for a new address). The app hashes it into 32 bytes, the payload. That payload is what must be signed. Nothing is signed yet.",
      explainAt: "parcel",
      action: { label: "pack the transaction", gate: true },
    },
    {
      caption: "Ask the signing network ({signer}) to sign the payload for your address.",
      explain:
        "You call sign() on the signer contract and attach 1 yoctoNEAR (the smallest unit of NEAR) plus gas. Your request waits while the signing nodes work. Each node holds a key share, one piece of the key. Once enough shares agree (the threshold), the signature comes back. No machine ever holds the whole key.",
      explainAt: "ring",
      action: { label: "request the signature", gate: true },
    },
    {
      caption: "Check the signature with Ethereum's own math: who signed this transaction?",
      explain:
        "Ethereum works out the signer from the signature alone. The app does the same with the viem library. If it gives {derivedEthAddress}, your NEAR account controls that address. The app does not send it to Sepolia: the address has 0 ETH to pay Ethereum's gas.",
      explainAt: "address",
      action: { label: "check who signed", gate: true },
    },
    {
      caption: "Three quick questions on Chain Signatures, signing nodes and derived addresses.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: Chain Signatures compared with bridges and smart contract wallets.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
