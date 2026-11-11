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
    payloadHash: "the payload hash",
    signer: "v1.signer-prod.testnet",
  },
  steps: [
    {
      caption:
        "Ethereum needs its own wallet and its own private key. Could one NEAR account control the Ethereum address instead?",
      explain:
        "Normally, controlling an Ethereum address means holding its private key, so each chain needs its own wallet and seed phrase. On NEAR, an account can get signatures for an Ethereum address through Chain Signatures, with no Ethereum key stored anywhere.",
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
      caption: "Pack a transfer on Sepolia, Ethereum's test network. Your new address starts with 0 ETH.",
      explain:
        "This is a normal Ethereum transaction: who it goes to, how much, gas, fees and a nonce (a counter, 0 for a new address). The app hashes it into 32 bytes, the payload. That payload, {payloadHash}, is the only thing the signing network signs. Nothing is signed yet.",
      explainAt: "parcel",
      action: { label: "pack the transaction", gate: true },
    },
    {
      caption: "Ask the signing network ({signer}) to sign the Ethereum payload hash.",
      explain:
        "You call sign() with the payload, the path and the key type (ECDSA on secp256k1, the curve Ethereum uses), plus 1 yoctoNEAR (the smallest unit of NEAR) and gas. Each signing node holds a key share, one piece of the key. Once enough shares agree (the threshold), r, s and v come back. No machine ever holds the whole key.",
      explainAt: "ring",
      action: { label: "request the signature", gate: true },
    },
    {
      caption:
        "Attach r, s and v to the transaction, then recover the signer address with viem. If the address matches, your NEAR account signed for Ethereum.",
      explain:
        "From r, s and v, Ethereum software works out the signer's public key, hashes it with Keccak-256 (Ethereum's hash function) and keeps the last 20 bytes: the address. If that equals {derivedEthAddress}, the signing network signed for your address, and no one holds an Ethereum private key.",
      explainAt: "address",
      action: { label: "verify the signer", gate: true },
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
