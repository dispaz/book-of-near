import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { ATTACK, BOOT, CHECK, HONEST, HOOK, REGISTER, RUN, useAgent } from "./useAgent";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-5/5.2.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Why is a bot with its key in a .env file not autonomous?",
    options: [
      {
        text: "Whoever can read the file (the developer, an attacker, the host) can sign anything as the bot.",
        correct: true,
      },
      { text: "Because .env files cannot hold keys.", why: "They often do, which is the problem." },
      { text: "Because bots cannot sign transactions.", why: "The bot signs with that very key." },
    ],
  },
  {
    prompt: "Whose account does a Shade Agent's Ethereum address belong to?",
    options: [
      { text: "The agent contract's: it is derived from the contract's account and a path.", correct: true },
      {
        text: "The agent's own key.",
        why: "The agent's key changes on every restart, so the assets are tied to the contract.",
      },
      {
        text: "The developer's, because they deployed it.",
        why: "The signer derives from whoever calls sign: the agent contract.",
      },
    ],
  },
  {
    prompt: "The developer calls request_signature from their own account. What happens?",
    options: [
      { text: 'The agent contract refuses: "Agent not registered".', correct: true },
      {
        text: "It works, because they wrote the code.",
        why: "Only registered agents with approved measurements may call it.",
      },
      {
        text: "The signing network asks the developer for a password.",
        why: "The agent contract refuses before the signing network is asked.",
      },
    ],
  },
];

/**
 * Lesson 5.2. The state lives in one hook (useAgent) and is drawn by the 2D or the 3D view. The step
 * actions sit outside the views, so both use the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, reportEvidence } = props;
  const m = useAgent({ step, setGate, reportEvidence, reducedMotion });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === HOOK ? (
        <SceneAction onClick={m.openEnv} done={m.envOpen}>
          {m.envOpen ? "File open ✓" : "Open the .env file"}
        </SceneAction>
      ) : null}
      {step === BOOT ? (
        <SceneAction onClick={m.boot} done={!!m.agent}>
          {m.agent ? "Agent running ✓" : "Start the agent"}
        </SceneAction>
      ) : null}
      {step === REGISTER ? (
        <SceneAction onClick={m.register} done={m.registered}>
          {m.registered ? "Registered ✓" : "Register the agent"}
        </SceneAction>
      ) : null}
      {step === ATTACK ? (
        <>
          <SceneAction onClick={m.devSign} done={!!m.devRefused}>
            {m.devRefused ? "Developer refused ✓" : "Sign as the developer"}
          </SceneAction>
          <SceneAction onClick={m.tryCopy} done={m.copyRefused}>
            {m.copyRefused ? "Changed copy refused ✓" : "Register a changed copy"}
          </SceneAction>
        </>
      ) : null}
      {step === RUN ? (
        <SceneAction
          onClick={() => void m.runAgent()}
          done={m.run.status === "done"}
          disabled={m.run.status === "running"}
        >
          {m.run.status === "done"
            ? "Signature requested ✓"
            : m.run.status === "running"
              ? "The agent is asking…"
              : "Run the agent"}
        </SceneAction>
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
          comparedWith={["a bot with a key in .env", "a human multisig"]}
          // docs/lessons/stage-5/5.2.md, section 4.
          strengths={[
            "No developer holds the agent's key: the agent makes it inside the TEE and never saves it.",
            'Only attested, approved code can ask for signatures. Anyone else gets "Agent not registered".',
            "One agent contract can sign for most chains through chain signatures.",
            "The assets sit with the contract, so agents can restart, be replaced or run as several copies.",
          ]}
          weaknesses={[
            "The contract owner approves new code (new measurements). The framework says the owner should be a multisig (an account that needs several people to approve) and the contract account's access keys must be removed, or that owner can still move the funds.",
            "TEEs are not absolute: an attack called TEE.fail showed that someone with the machine in hand can pull secrets out of Intel TDX. So limits written into the contract (guardrails) matter.",
            "The host can pause the agent at any time. You need several agents, and protection against doing the same action twice.",
            "NEAR's docs mark the Shade Agent Framework deprecated: not maintained since 19 April 2026, and not for new projects.",
            "This page runs a model of the agent contract in your browser. No agent ran here and nothing was signed.",
            "Compared with: a bot with a key in .env (whoever reads the file can sign) and a human multisig (people approve every action: slower, but no TEE to trust).",
          ]}
        />
      ) : null}
    </>
  );
}
