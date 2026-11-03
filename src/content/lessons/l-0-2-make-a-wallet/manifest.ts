import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-0/0.2.md. Template: docs/lesson-template.md.
// Keep the step numbers in Scene.tsx (STEP) in sync with this list.
export default {
  id: "l-0-2-make-a-wallet",
  stage: 0,
  order: 2,
  title: "Make a wallet",
  status: "ready",
  needsChain: false,
  summary: "Make a practice key pair and seed phrase in your browser, then sign and check a message.",
  steps: [
    {
      caption:
        "Never type a real seed phrase into any website, including this one. We will only make throwaway keys.",
      explain:
        "A seed phrase is a list of words that can rebuild your keys. Anyone who sees it can take everything the keys control. Real wallets never ask you to paste it into a page. If a site asks, it is a scam.",
      action: { label: "Tick the box", gate: true },
    },
    {
      caption: "Press Generate. Your browser makes a private key and a public key. Nothing leaves this page.",
      explain:
        "A key pair is two linked numbers. The private key is secret and is used to sign. The public key is shared and lets others check your signatures. You cannot work out the private key from the public one. NEAR mostly uses the ed25519 key type.",
      action: { label: "Generate", gate: true },
    },
    {
      caption:
        "These 12 words can rebuild the same keys on any wallet. Lose them and you lose the keys. Share them and you lose everything.",
      explain:
        "The words follow a standard called BIP-39: 12 words from a fixed list of 2,048. A second standard, SLIP-10, turns the words into a key along a route called a derivation path. NEAR's path is m/44'/397'/0'; 397 is NEAR's registered number.",
      action: { label: "Rebuild from words", gate: true },
    },
    {
      caption:
        "On NEAR, your public key written in hex is already an account address. This is called an implicit account.",
      explain:
        "An address is where others send you tokens. A NEAR implicit account is the 32-byte public key written as 64 hex characters (0–9, a–f). It exists on chain only after someone sends it some NEAR, even 0 NEAR.",
      action: { label: "Turn it into an address", gate: true },
    },
    {
      caption:
        "Ethereum hashes the public key and keeps the last 20 bytes. NEAR also lets you use a readable name like ana.testnet.",
      explain:
        "On Ethereum, an address is the last 20 bytes of the Keccak-256 hash of the public key: 0x plus 40 hex characters. A hash is a short fingerprint of some data. On NEAR, a named account like ana.testnet is a readable name. It can hold several keys and change them later.",
      action: { label: "Show all three rules", gate: true },
    },
    {
      caption: "Type a short message and sign it with your private key. The result is a signature.",
      explain:
        "A signature is a code made from the message and the private key. Only the private key can make it. With ed25519, the same key and message always give the same signature. Signing a transaction works the same way, as you will see in lesson 0.3.",
      action: { label: "Sign", gate: true },
    },
    {
      caption: "Anyone can check the signature with your public key. Now change one letter and check again.",
      explain:
        "Verifying uses the message, the signature and the public key. If anything changed, the check fails. This is how a blockchain knows a transaction really came from the account owner and was not changed on the way.",
      action: { label: "Verify, change one letter, verify again", gate: true },
    },
    {
      caption:
        "No bank can reset this key. Holding your own keys is called self-custody. It is freedom and responsibility.",
      explain:
        "Self-custody means only you hold the private key. Nobody can freeze it, and nobody can recover it for you. A wallet is an app that stores your keys and signs for you, but the rule stays the same. The NEAR docs say: “Anyone with access to them can control your account.”",
      action: { label: "Throw the keys away", gate: true },
    },
    {
      caption: "Three quick questions. Then the honest take.",
      action: { label: "Answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: what NEAR does well with keys and addresses, and what it does badly.",
    },
  ],
  scene: () => import("./Scene"),
  // Both views draw one shared state (useWallet.ts). The 3D view (Scene3D.tsx) loads only when chosen.
  views: ["2d", "3d"],
} satisfies LessonManifest;
