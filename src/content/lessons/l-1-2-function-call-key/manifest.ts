import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-1/1.2.md. Template: docs/lesson-template.md.
// Shape: hook (full-access key) → concept (function-call key) → do (add key, allowed call, attacks, revoke)
// → check → honest take. Keep the step numbers in useKeyLesson.ts in sync.
export default {
  id: "l-1-2-function-call-key",
  stage: 1,
  order: 2,
  title: "A key that can do only one thing",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useKeyLesson); the 3D view (Scene3D) loads only when chosen.
  views: ["2d", "3d"],
  summary: "Add a limited key that can call one contract and nothing else.",
  // The learner's allowance is used in later text; `left` is what the key has left, `contract` is the
  // short id of the account that holds the counter.
  vars: { allowance: "0.1", left: "0.1", contract: "your account" },
  steps: [
    {
      caption: "An assistant wants to act for you. Would you hand it the key to your whole account?",
      explain:
        "Your practice account has a full-access key. Whoever holds it can do anything: send all your coins, add keys, even delete the account. That is too much to give a helper. NEAR lets an account hold many keys, and some can be limited.",
      explainAt: "account",
    },
    {
      caption: "A function-call key can call one contract and pay gas up to an allowance. Nothing else.",
      explain:
        "A function-call key signs only for the contract you name. It cannot send NEAR, attach NEAR to a call, or add keys. Its allowance is the most NEAR it may spend on gas, the fee for the work a transaction causes. When the allowance is gone, the key stops working.",
      explainAt: "keycard",
    },
    {
      caption:
        "Set the allowance, then add a key for the agent. It will be able to call only your counter contract.",
      explain:
        "One transaction does two things. It puts a small counter contract on your account, and it adds the agent's key with that contract as its only target. Then the app reads the key back from the chain, so what you see is what the chain holds. The allowance belongs to the key, not to your balance.",
      explainAt: "keycard",
      action: { label: "add the agent's key", gate: true },
    },
    {
      caption:
        "Ask the agent to count. It signs with its own key and the chain accepts. Watch the {allowance} NEAR allowance drop.",
      explain:
        "The agent is a plain script: it turns your words into a transaction and signs it with the limited key. No AI model is called. It calls increment on your counter. The call works, and the gas it used comes out of the key's allowance.",
      explainAt: "counter",
      action: { label: "ask the agent to count", gate: true },
    },
    {
      caption: "Now try to make the agent misbehave. Type a prompt and watch the chain refuse it.",
      explain:
        "The chain does not read the prompt. It checks each transaction against the key's permission. Try three different attacks: send funds, call another contract, add a new key. A refused transaction is not included, and it costs nothing.",
      explainAt: "log",
      action: { label: "get three attacks refused", gate: true },
    },
    {
      caption:
        "You are done with the agent. Delete its key. It still had {left} NEAR of its {allowance} NEAR allowance.",
      explain:
        "To revoke a key you delete it. Only a full-access key can do that, and you still hold one. After that the chain refuses every transaction signed with the deleted key. Whatever allowance was left goes with it.",
      explainAt: "keycard",
      action: { label: "delete the agent's key", gate: true },
    },
    {
      caption: "Two quick questions. Then the honest take.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: what NEAR does well and badly with limited keys.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
