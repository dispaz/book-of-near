import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction, SceneActionGroup } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { PROMPTS } from "./tutor";
import { CHECK, ENCLAVE, HONEST, PROMPT, QUOTE, usePrivateAi, VERIFY } from "./usePrivateAi";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-5/5.1.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What makes a TEE different from ordinary cloud hosting?",
    options: [
      {
        text: "The processor encrypts its memory in hardware, so even root admins cannot read it.",
        correct: true,
      },
      {
        text: "It makes users pay with Bitcoin instead of credit cards.",
        why: "How you pay has nothing to do with hardware security.",
      },
      {
        text: "It deletes your data after 30 days.",
        why: "An enclave protects data while it is in memory and in use.",
      },
    ],
  },
  {
    prompt: "What is a remote attestation quote?",
    options: [
      {
        text: "A report signed by the chip that proves which code runs inside a genuine enclave.",
        correct: true,
      },
      {
        text: "A price quote from an AI sales team.",
        why: "An attestation quote is a signed hardware report, not a price.",
      },
      {
        text: "A legal contract between NEAR and a chipmaker.",
        why: "It is made and signed by the hardware itself, automatically.",
      },
    ],
  },
  {
    prompt:
      "The host's root admin dumps the server's memory while the AI runs in an enclave. What do they see?",
    options: [
      { text: "Encrypted noise.", correct: true },
      {
        text: "Your prompts in plain text.",
        why: "The chip keeps the enclave's memory encrypted, so there is no plain text to read.",
      },
      {
        text: "Your wallet's seed phrase.",
        why: "Your seed phrase never goes to the AI server at all.",
      },
    ],
  },
];

/**
 * Lesson 5.1. The state lives in one hook (usePrivateAi) and is drawn by the 2D or the 3D view. The step
 * actions sit outside the views, so both use the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, reportEvidence } = props;
  const m = usePrivateAi({ step, setGate, reportEvidence, reducedMotion });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === ENCLAVE ? (
        <SceneAction onClick={m.dump} done={m.dumped}>
          {m.dumped ? "Memory read ✓" : "Read the memory as root"}
        </SceneAction>
      ) : null}
      {step === PROMPT ? (
        <>
          <SceneActionGroup label="Sample questions">
            {PROMPTS.map((p, i) => (
              <SceneAction
                key={p.question}
                onClick={() => m.setChoice(i)}
                pressed={m.choice === i}
                disabled={m.asked !== null && m.asked !== i}
              >
                {p.question}
              </SceneAction>
            ))}
          </SceneActionGroup>
          <SceneAction onClick={() => m.send()} done={m.answered} disabled={m.asked !== null && !m.answered}>
            {m.answered ? "Answered ✓" : m.asked !== null ? "The tutor is answering…" : "Send prompt"}
          </SceneAction>
        </>
      ) : null}
      {step === QUOTE ? (
        <SceneAction onClick={() => void m.fetchQuote()} done={!!m.attestation} disabled={m.fetching}>
          {m.attestation
            ? "Quote received ✓"
            : m.fetching
              ? "Fetching the quote…"
              : "Fetch attestation quote"}
        </SceneAction>
      ) : null}
      {step === VERIFY ? (
        <>
          <SceneAction
            onClick={() => void m.runVerify()}
            done={m.verified}
            disabled={!m.attestation || m.verify.status === "running"}
            hint={!m.attestation ? "Fetch the quote first (step 4)." : undefined}
          >
            {m.verified ? "Verified ✓" : m.verify.status === "running" ? "Checking…" : "Verify in my browser"}
          </SceneAction>
          {m.verified ? (
            <SceneAction onClick={() => void m.tamperTest()} quiet done={!!m.tamper}>
              {m.tamper ? "Tampered copy failed ✓" : "Change one byte and verify again"}
            </SceneAction>
          ) : null}
        </>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={m.passed}
          onPass={() => {
            m.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith={["ordinary cloud AI", "Apple Private Cloud Compute"]}
          // docs/lessons/stage-5/5.1.md, section 4.
          strengths={[
            "Real prompt privacy: the chip keeps the enclave's memory encrypted, so the cloud operator cannot read your conversation while it runs.",
            "Proof you can check: the attestation quote is signed by the hardware and chains up to Intel's published root. Your browser just checked it.",
            "A familiar interface: NEAR AI Cloud offers an OpenAI-compatible API, so existing apps can switch with little change.",
          ]}
          weaknesses={[
            "You still trust the chipmaker: the proof is only as good as Intel's (and NVIDIA's) hardware and root keys.",
            "Side channels: attacks that measure timing or power use can leak secrets from enclaves, and chipmakers keep patching their firmware.",
            "This page checks the signatures, not everything: not revocation lists, not whether the chip's firmware is up to date, not the NVIDIA GPU evidence, and not what the measured code does. A full check uses Intel's verifier and NEAR AI's own.",
            "The tutor's answers here are pre-written: chat needs an API key, so this edition shows a real quote but not a live answer.",
            "Compared with: ordinary cloud AI (the operator can read every prompt, and there is nothing to verify) and Apple Private Cloud Compute (enclaves too, but closed and Apple-only).",
          ]}
        />
      ) : null}
    </>
  );
}
