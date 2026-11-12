import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { AUTHORIZE, CHECK, HONEST, SETTLE, useCapstone } from "./useCapstone";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-7/7.1.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Why does the learner use a function-call key to authorize the intent?",
    options: [
      {
        text: "So that even if the app is compromised, the account's full-access key and main funds stay safe.",
        correct: true,
      },
      {
        text: "Because full-access keys cannot connect to the internet.",
        why: "Full-access keys can do everything, which is why you keep them out of apps.",
      },
      {
        text: "To avoid paying taxes on crypto.",
        why: "Access key types are a security tool, not a tax rule.",
      },
    ],
  },
  {
    prompt: "How do Nightshade shards handle calls between contracts without locking the blockchain?",
    options: [
      {
        text: "Through receipts that carry the call to the other shard and run in a later block.",
        correct: true,
      },
      {
        text: "By stopping all transactions on all other shards.",
        why: "Shards process their chunks in parallel.",
      },
      {
        text: "By sending emails between node operators.",
        why: "Receipts are routed by the protocol itself.",
      },
    ],
  },
  {
    prompt: "How does an intent deliver tokens on another chain without user-facing bridges?",
    options: [
      {
        text: "A solver pays out from funds it already holds there, and the verifier contract on NEAR settles the trade.",
        correct: true,
      },
      {
        text: "By printing copies of Bitcoin.",
        why: "The tokens delivered are the real, native ones.",
      },
      {
        text: "By shutting down the other chain.",
        why: "Other chains run normally.",
      },
    ],
  },
];

/**
 * Lesson 7.1, the capstone. The state lives in one hook (useCapstone) and is drawn by the 2D or the 3D
 * view. The step actions (authorize, verify, quiz, honest take) sit outside the views.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const m = useCapstone({ step, setGate, setVars, reportEvidence, reducedMotion });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === AUTHORIZE ? (
        <SceneAction onClick={m.authorize} done={m.authorized}>
          {m.authorized ? "Intent authorized ✓" : "Authorize intent"}
        </SceneAction>
      ) : null}
      {step === SETTLE ? (
        <SceneAction onClick={m.verify} done={m.settle === "done"} disabled={m.settle !== "idle"}>
          {m.settle === "done"
            ? "Settlement verified ✓"
            : m.settle === "idle"
              ? "Verify foreign settlement"
              : "Verifying…"}
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
          comparedWith={["Ethereum", "Solana"]}
          // docs/lessons/stage-7/7.1.md, section 4.
          strengths={[
            "Chain abstraction from end to end: one named account can sign for other chains, and intents swap across chains without user-facing bridges or gas tokens for each chain.",
            "The parts are built in: named accounts, scoped keys, shards and Chain Signatures are protocol features, not add-ons from different teams.",
            "Compared with Ethereum and its rollups (many separate networks, bridges and gas tokens) and Solana (one fast shared state, but no sharding and no built-in signing for other chains).",
          ]}
          weaknesses={[
            "Seconds, not one block: a full intent spends a few blocks on receipts, and a chain signature took 7 to 14 seconds on testnet in our tests.",
            "Many parts to debug: when something fails you trace nonces, receipt hops and solver liquidity, across systems run by different parties.",
            "Who should care: builders who want one account to work across chains, and users tired of bridges. If you only ever use one chain, a single-chain wallet is simpler.",
          ]}
        />
      ) : null}
    </>
  );
}
