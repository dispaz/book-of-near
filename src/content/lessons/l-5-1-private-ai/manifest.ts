import type { LessonManifest } from "../../../app/types";

// Lesson script: docs/lessons/stage-5/5.1.md (topic: 5.1-topic.md). Template: docs/lesson-template.md.
// Shape: hook (who reads your prompt) → the enclave (read memory as root) → ask the tutor → fetch the
// attestation quote → verify it in the browser → check → honest take. Keep steps.ts in sync.
// NEAR AI Cloud's chat needs an API key, so the tutor's answers are pre-written and say so. Its
// attestation report is public: demo mode uses one recorded on 13 Nov 2026, testnet mode fetches a fresh
// one with the learner's own nonce. Either way the signature checks run for real, in the browser.
export default {
  id: "l-5-1-private-ai",
  stage: 5,
  order: 1,
  title: "Ask a private AI and verify it",
  status: "ready",
  needsChain: false,
  // Both views draw one state (usePrivateAi); the 3D view is a pop-up book scene (Scene3D), loaded lazily.
  views: ["2d", "3d"],
  summary: "Ask an AI that runs in a sealed chip, then check the chip's signed proof yourself.",
  steps: [
    {
      caption: "Who can read your prompts to an AI?",
      explain:
        "Most AI services run on ordinary cloud servers. HTTPS (the padlock in your browser) protects your prompt on the way. But the server decrypts it into its memory to work on it, and the people who run that server can read it there, log it or keep it. NEAR AI Cloud runs models inside hardware enclaves instead.",
      explainAt: "server",
    },
    {
      caption: "A Trusted Execution Environment (TEE) seals memory inside the chip.",
      explain:
        "A TEE is a sealed area of a processor, such as Intel TDX. The chip encrypts the memory that the code inside uses, with keys that never leave the chip. The operating system, the cloud operator and a technician with the machine in hand are all locked out: NEAR AI calls this the triple lockout. Try it: read both machines' memory as root, the all-powerful admin.",
      explainAt: "enclave",
      action: { label: "read the memory as root", gate: true },
    },
    {
      caption: "Ask the Book of NEAR tutor a question.",
      explain:
        "On NEAR AI Cloud the model runs inside an enclave, and your prompt travels over an encrypted channel straight into it. Pick a question and send it. In this edition the answer was written in advance: a live answer needs a NEAR AI Cloud API key, and a public book cannot ship one.",
      explainAt: "terminal",
      action: { label: "send a prompt", gate: true },
    },
    {
      caption: "How do you know it really ran in an enclave? Ask the chip for proof.",
      explain:
        "Anyone can claim to use a TEE. The proof is an attestation quote: a report the chip signs with a key that only genuine Intel hardware holds. It carries measurements (hashes of the code that was loaded) and 64 bytes chosen by the code inside: here, the model's signing address and a nonce (a fresh random number), so an old quote cannot be passed off as new.",
      explainAt: "quote",
      action: { label: "fetch the attestation quote", gate: true },
    },
    {
      caption: "Verify the quote yourself, in your browser.",
      explain:
        "Your browser checks each signature: the report against the quote's key, that key against Intel's quoting enclave, then the chip's certificate up to Intel's root certificate, which Intel publishes. If a single byte of the report had changed, the check would fail. Try that too, once it passes.",
      explainAt: "seal",
      action: { label: "verify the quote", gate: true },
    },
    {
      caption: "Three questions on TEEs, attestation and private AI.",
      action: { label: "answer the check", gate: true },
      page: "summary",
    },
    {
      caption: "Honest take: hardware enclaves compared with ordinary cloud AI.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
