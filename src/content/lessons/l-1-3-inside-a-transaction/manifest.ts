import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-1/1.3.md. Template: docs/lesson-template.md.
// Shape: hook (several actions, one fails?) → do (open a transaction, build a batch, break it, replay it)
// → check → honest take. Keep the step numbers in useTxLesson.ts in sync.
export default {
  id: "l-1-3-inside-a-transaction",
  stage: 1,
  order: 3,
  title: "Inside a NEAR transaction",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useTxLesson); the 3D view (Scene3D) loads only when chosen.
  views: ["2d", "3d"],
  summary: "Stack several actions in one transaction, break one, and watch them all roll back.",
  // The learner's own values: the workshop account, the new account's name, the amount, the batch's nonce.
  vars: {
    parent: "a workshop account",
    sub: "shop.your-workshop.testnet",
    failsub: "shop2.your-workshop.testnet",
    amount: "0.02",
    comesback: "and the NEAR sent to it comes back",
    nonce: "N",
  },
  steps: [
    {
      caption:
        "One NEAR transaction can carry several actions. If one of them fails, what happens to the others?",
      explain:
        "An action is one thing a transaction asks the chain to do: create an account, send NEAR, add a key, call a contract. A transaction carries a list of actions. In this lesson you stack three, then break one on purpose.",
      explainAt: "tx",
    },
    {
      caption: "First make {parent}, an account to work in. Then look inside the transaction that made it.",
      explain:
        "Every transaction has the same parts. The signer signs it and pays the fee. The receiver is the one account its actions apply to. Then come the actions. The nonce and the block hash you met in lesson 0.3. Later in this lesson you see why they are there.",
      explainAt: "fields",
      action: { label: "make the workshop account", gate: true },
    },
    {
      caption: "Stack three actions for {sub}, in order, and send them as one transaction.",
      explain:
        "All the actions in one transaction go to one receiver, here the new account {sub}. They run in the order you list them. {parent} signs once and pays one fee. Order matters: an account must exist before it can get NEAR or keys.",
      explainAt: "builder",
      action: { label: "send a batch that works", gate: true },
    },
    {
      caption: "Now break it. Send a batch for {failsub} that adds the same key twice.",
      explain:
        "Adding a key the account already has fails. When an action fails, the chain undoes every action of that transaction, even the ones that already ran. {failsub} is not created, {comesback}. The fee for the work done is still paid.",
      explainAt: "result",
      action: { label: "send a batch that fails", gate: true },
    },
    {
      caption: "Your first batch had nonce {nonce}. Send that same signed transaction again, unchanged.",
      explain:
        "Anyone who sees a signed transaction could send a copy. The nonce stops that: each key's nonce only goes up, so a copy with a used nonce never runs again and costs nothing. A node simply answers with the first result. The block hash adds a deadline: once that block is too old, even an unused transaction expires.",
      explainAt: "replay",
      action: { label: "re-send an old transaction", gate: true },
    },
    {
      caption: "Three quick questions. Then the honest take.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: what NEAR does well and badly with transactions of several actions.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
