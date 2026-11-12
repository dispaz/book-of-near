import type { LessonManifest } from "../../../app/types";

// Topic: docs/lessons/stage-1/1.2-topic.md. Lesson script: docs/lessons/stage-1/1.2.md.
// Template: docs/lesson-template.md.
// Shape: hook (one full-access key) → concept (two kinds of key) → do (give the app a key, the app counts,
// the hacked app is refused three times, delete the key) → check → honest take.
// Keep the step numbers in useKeyLesson.ts in sync.
export default {
  id: "l-1-2-function-call-key",
  stage: 1,
  order: 2,
  title: "A key that can do only one thing",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useKeyLesson); the 3D view (Scene3D) loads only when chosen.
  views: ["2d", "3d"],
  summary: "Give an app a limited key that can call one contract and nothing else.",
  // The learner's allowance is used in later text; `left` is what the key has left. `keyLeft` is the
  // delete step's sentence: it names the starting allowance only when it is known (not after a reload
  // in a browser that forgot it), so it never shows one number twice.
  vars: { allowance: "0.1", left: "0.1", keyLeft: "It still had 0.1 NEAR of its 0.1 NEAR allowance." },
  steps: [
    {
      caption:
        "A small app wants to save your clicks on the chain. Would you give it the key to your whole account?",
      explain:
        "Your practice account has one key, a full-access key. Whoever holds it can do anything: send all your NEAR, add keys, delete the account. An app that only counts clicks needs far less. On NEAR an account can hold many keys, and a key can be limited.",
      explainAt: "account",
    },
    {
      caption:
        "A full-access key can do anything. A function-call key can call one contract and spend a little on gas. Nothing else.",
      explain:
        "A function-call key names one contract, and optionally which of its methods. Its allowance is the most NEAR it may spend on gas, the fee for the work a transaction causes. It can never send NEAR, attach NEAR to a call or add keys. The chain checks this on every transaction.",
      explainAt: "keycard",
    },
    {
      caption:
        "Set an allowance, then give the Counter app its own key. It will be able to call only the counter.",
      explain:
        "One transaction does two things. It puts a small counter contract on your account (the app's code), and it adds a new function-call key that may call only that contract. The app keeps the private half. Then the app reads the key back from the chain. Your account now has two keys.",
      explainAt: "keycard",
      action: { label: "give the app a key", gate: true },
    },
    {
      caption:
        "Click Count. The app signs with its own key, and you are not asked to approve. Watch the {allowance} NEAR allowance drop.",
      explain:
        "The app calls increment on the counter, signed with its function-call key, not yours. The chain checks: right contract, enough allowance. It accepts. The gas comes out of the key's allowance, not your balance.",
      explainAt: "counter",
      action: { label: "count once", gate: true },
    },
    {
      caption:
        "Suppose the app is hacked. The attacker has its key. Try three things it should not be able to do.",
      explain:
        "The attacker can sign anything with the app's key. The chain does not trust the app: it checks each transaction against the key's permission. A refused transaction is not included, and it costs nothing.",
      explainAt: "log",
      action: { label: "get all three refused", gate: true },
    },
    {
      caption: "You are done with the app. Delete its key. {keyLeft}",
      explain:
        "To take a key back you delete it, with your full-access key. Asking the app to forget it changes nothing on the chain. Whatever allowance was left goes with it. Then try Count once more: the chain refuses a key that no longer exists.",
      explainAt: "keycard",
      action: { label: "delete the app's key", gate: true },
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
