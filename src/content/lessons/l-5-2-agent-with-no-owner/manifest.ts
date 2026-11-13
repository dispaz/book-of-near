import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-5/5.2.md (topic: 5.2-topic.md). Template: docs/lesson-template.md.
// Shape: hook (a bot's key in .env) → the agent makes its key in the enclave → it registers with the
// agent contract → the developer tries and is refused → the agent signs for Ethereum → check → honest
// take. Keep steps.ts in sync.
// No Shade Agent runs here: the agent contract's checks run in the browser, written from the reference
// contract, and the page says so. The only chain access is one free view call through the Chain
// interface: the signing network's root key, for the contract's Ethereum address.
export default {
  id: "l-5-2-agent-with-no-owner",
  stage: 5,
  order: 2,
  title: "An agent with no owner",
  status: "ready",
  needsChain: false,
  // Both views draw one state (useAgent); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "An agent that makes its own key in a sealed chip, and a contract that refuses its developer.",
  steps: [
    {
      caption: "Most bots sign with a key that sits in a file.",
      explain:
        "A typical bot runs on an ordinary server. The private key that signs for its account sits in a file, often called .env. Whoever can read that file can sign anything as the bot: the developer, an attacker or the cloud host. Open the file and see.",
      explainAt: "laptop",
      action: { label: "open the .env file", gate: true },
    },
    {
      caption: "A Shade Agent makes its key inside a TEE.",
      explain:
        "A Shade Agent has two parts. The agent is a program that runs in a TEE (a sealed area of a chip, lesson 5.1). The agent contract is a NEAR smart contract. When the agent starts, it makes a fresh key pair inside the enclave. Its NEAR account is an implicit account: a 64-character hex name made from the public key. The private key is never saved, so it changes every time the agent restarts.",
      explainAt: "enclave",
      action: { label: "start the agent", gate: true },
    },
    {
      caption: "The agent registers: the contract checks its attestation.",
      explain:
        "The agent calls register_agent on the agent contract and hands over its attestation quote. The contract checks four things: the quote is genuine; its measurements (hashes of the code, lesson 5.1) are on the approved list; its PPID (an id of the physical chip) is approved; and the quote's report data holds the agent's own account name, so nobody can reuse someone else's quote.",
      explainAt: "contract",
      action: { label: "register the agent", gate: true },
    },
    {
      caption: "Can the developer who wrote the agent take its funds?",
      explain:
        "The developer never saw the agent's key. First they call request_signature on the agent contract from their own account. Then they run a changed copy of the agent in a TEE and try to register it. Try both.",
      explainAt: "key",
      action: { label: "try both as the developer", gate: true },
    },
    {
      caption: "The agent asks its contract for an Ethereum signature.",
      explain:
        "The agent calls request_signature with the path ethereum-1 and the hash of an Ethereum transaction. The agent contract checks that the agent is still valid, then calls sign on the signer contract (v1.signer-prod.testnet on testnet). The contract is the caller, so the Ethereum address belongs to the agent contract and the path, not to the agent's key. The funds stay put when an agent restarts or is replaced, and several agents can share them.",
      explainAt: "signer",
      action: { label: "run the agent", gate: true },
    },
    {
      caption: "Three questions on agents, keys and agent contracts.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: an agent in a TEE compared with a bot or a multisig.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
