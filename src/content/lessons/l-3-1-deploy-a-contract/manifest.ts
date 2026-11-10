import type { LessonManifest } from "../../../app/types";

// Topic: docs/lessons/stage-3/3.1-topic.md. Lesson script: docs/lessons/stage-3/3.1.md.
// Template: docs/lesson-template.md.
// Shape: hook (code on a name) → concept (sub-account, the Wasm file) → do (deploy, call and read, a failing
// callback, clear state) → check → honest take. Keep the step numbers in steps.ts in sync.
export default {
  id: "l-3-1-deploy-a-contract",
  stage: 3,
  order: 1,
  title: "Deploy a contract in one click",
  status: "ready",
  needsChain: true,
  // Both views draw one state (useDeploy); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Put a tiny contract on testnet and call it.",
  // Every value comes from the chain or the real Wasm file; these are only shown before they are known.
  vars: {
    contract: "counter.your-name.testnet",
    codeBytes: "about 2,000",
    storageDeposit: "about 0.02",
    refund: "a little",
  },
  steps: [
    {
      caption: "Where do smart contracts live on NEAR? On an account name, as WebAssembly code.",
      explain:
        "On Ethereum, deploying a contract gives you a new hex address. On NEAR, a contract lives on an account you control, often a sub-account like {contract}. Contracts compile to WebAssembly (Wasm), a standard binary code format browsers also run.",
      explainAt: "submailbox",
    },
    {
      caption:
        "Your contract gets its own sub-account, {contract}. Its code is {codeBytes} bytes of WebAssembly.",
      explain:
        'Any named account can create sub-accounts, with no registrar. A hex (implicit) practice account is already 64 characters, the limit, so the lesson first gives it a short name, as in lesson 1.1. The counter was written by hand in Wasm text, so no Rust toolchain is needed. Every Wasm file starts with the bytes 00 61 73 6d ("\\0asm").',
      explainAt: "scroll",
    },
    {
      caption:
        "Deploy the contract in one transaction. Watch {storageDeposit} NEAR lock into storage staking.",
      explain:
        "One batch creates {contract}, sends it 0.05 NEAR and deploys the code. NEAR charges no rent. Instead, an account must keep 1 NEAR per 100 KB it stores, locked. That is the storage deposit. The rest is its available balance, which it can spend.",
      explainAt: "gauge",
      action: { label: "deploy the counter contract", gate: true },
    },
    {
      caption: "Click Increment to change the count. Then read it back with a second, free call.",
      explain:
        "increment is a change call: a transaction that runs the Wasm and writes the count to the account's storage. That new record needs a few more bytes of storage deposit. get_num is a view call: it only reads, needs no transaction and costs nothing.",
      explainAt: "scroll",
      action: { label: "increment, then read the count", gate: true },
    },
    {
      caption: "Ask the counter to call its own fail method, with a callback that waits for the answer.",
      explain:
        'call_other calls fail, which always panics. A failed call changes nothing, but the gas is still spent. The callback, on_other_done, runs in a later block and is told the call failed. It writes "failed" to storage. NEAR does not undo the caller\'s work: the callback must handle it.',
      explainAt: "receipts",
      action: { label: "call fail with a callback", gate: true },
    },
    {
      caption:
        "Clear the counter's state. The bytes it frees stop being locked: {refund} NEAR is available again.",
      explain:
        "reset deletes the count and the last result. Storage staking is a deposit, not a fee: the locked NEAR for those bytes goes straight back to the account's available balance. The code itself stays, so its deposit stays locked.",
      explainAt: "gauge",
      action: { label: "clear the state", gate: true },
    },
    {
      caption: "Three quick questions on WebAssembly, sub-accounts and storage staking.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: storage staking, Wasm and upgrades, compared with Ethereum.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
