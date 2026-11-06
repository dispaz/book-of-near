import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-1/1.1.md. Template: docs/lesson-template.md.
// Shape: hook (a hex address) → concept (a name is an address) → do (pick a name, create it) →
// compare (named vs hex) → check → honest take. Keep the step numbers in useClaim.ts in sync.
export default {
  id: "l-1-1-claim-your-name",
  stage: 1,
  order: 1,
  title: "Claim your name",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useClaim); the 3D view (Scene3D) loads only when chosen.
  views: ["2d", "3d"],
  // The name the learner types is reported with setVars and used in the later captions.
  vars: { name: "your-name.testnet" },
  summary: "Pick a readable name and create it as your own testnet account.",
  steps: [
    {
      caption:
        "Most chains give you an address like 7f3a9c0d… that no one can say out loud. NEAR lets an account have a name.",
      explain:
        "An account id is the address of an account. Your practice account has a long hex one: 64 characters made from its public key. That kind is called an implicit account. It works, but nobody can remember it.",
      explainAt: "account",
    },
    {
      caption:
        "A NEAR account can have a readable id such as ana.testnet. The name is the account's address.",
      explain:
        "A named account has an id you choose. On testnet, a registrar (a contract called testnet) creates names that end in .testnet. You ask it, attach a little NEAR and give it a public key.",
      explainAt: "registrar",
    },
    {
      caption: "Type a name. The app checks, as you type, whether it is free.",
      explain:
        "Each id exists once, so it is first come, first served. The app asks the chain whether the account already exists. Free means nobody has it yet.",
      explainAt: "name-box",
      action: { label: "pick a free name", gate: true },
    },
    {
      caption: "Ask the registrar to create {name} and send it 0.1 NEAR from your practice account.",
      explain:
        "One transaction calls create_account on testnet with your name, a new public key and the deposit. The registrar makes the account, funds it and adds your key as a full-access key: a key that can do anything with the account. This app keeps the matching private key in this browser, for testnet only.",
      explainAt: "create",
      action: { label: "Create {name}", gate: true },
    },
    {
      caption: "{name} and a hex id can both be NEAR accounts. The name is easier to read, share and check.",
      explain:
        "The same public key could also be an implicit account with a hex id. That account would not exist until someone sent it NEAR. A named account exists because the registrar made it. The name belongs to the account, not to the key.",
      explainAt: "compare",
    },
    {
      caption: "Quick check. Get every answer right to go on.",
      action: { label: "Answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: what NEAR names do well and badly.",
      action: { label: "create your name first", gate: true },
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
