import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { ARCHIVE, CHECK, FAILOVER, HONEST, OUTAGE, RACE, useRace } from "./useRace";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-3/3.3.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Why should a dApp or wallet not rely on a single RPC endpoint?",
    options: [
      { text: "If that one provider has an outage, the whole dApp goes dark for its users.", correct: true },
      {
        text: "Because a single RPC node charges 100 NEAR per query.",
        why: "Most public RPC endpoints are free.",
      },
      {
        text: "Because the blockchain stops making blocks.",
        why: "RPC nodes do not make blocks. The chain keeps going when one of them is down.",
      },
    ],
  },
  {
    prompt: "What is the difference between a regular RPC node and an archival node?",
    options: [
      {
        text: "A regular node keeps only the last 5 epochs of history; an archival node keeps every block since the first one.",
        correct: true,
      },
      {
        text: "Archival nodes can only be reached by paper mail.",
        why: "Archival nodes answer the same HTTP JSON-RPC requests as regular ones.",
      },
      {
        text: "Regular nodes cannot handle token transfers.",
        why: "Regular nodes handle every new transaction.",
      },
    ],
  },
  {
    prompt: "How does client-side failover handle an RPC node that fails?",
    options: [
      { text: "It tries the request again on the next provider in its fallback list.", correct: true },
      {
        text: "It wipes the user's hard drive to prevent data leaks.",
        why: "The client only switches to another address.",
      },
      {
        text: "It asks the user to buy a new laptop.",
        why: "Failover happens in software, without the user doing anything.",
      },
    ],
  },
];

/**
 * Lesson 3.3. The state lives in one hook (useRace) and is drawn by the 2D or the 3D view. The step
 * actions sit outside the views, so both use the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const r = useRace({ step, setGate, setVars, reducedMotion, reportEvidence });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D r={r} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D r={r} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === RACE ? (
        <SceneAction onClick={r.race} disabled={!!r.busy || !!r.raced} done={!!r.raced}>
          {r.raced ? "Race finished ✓" : r.busy === "race" ? "Racing…" : "Race the nodes"}
        </SceneAction>
      ) : null}
      {step === OUTAGE ? (
        <SceneAction onClick={r.toggleBlock} done={r.blocked}>
          {r.blocked ? "FastNEAR is off ✓ (turn back on)" : "Disable FastNEAR"}
        </SceneAction>
      ) : null}
      {step === FAILOVER ? (
        <SceneAction
          onClick={r.failover}
          disabled={!!r.busy || !!r.fo || !r.blocked}
          done={!!r.fo?.answeredBy}
        >
          {r.fo?.answeredBy
            ? "Answered via failover ✓"
            : r.busy === "failover"
              ? "Trying providers…"
              : "Send query via failover"}
        </SceneAction>
      ) : null}
      {step === ARCHIVE ? (
        <SceneAction onClick={r.queryHistory} disabled={!!r.busy || !!r.hist} done={!!r.hist}>
          {r.hist ? "Historical block found ✓" : r.busy === "history" ? "Asking…" : "Query historical block"}
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={r.passed}
          onPass={() => {
            r.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith="Ethereum"
          strengths={[
            "Open public access. Free providers such as FastNEAR allow requests from any website (CORS *), so a browser app can talk to several of them with no API key.",
            "Failover is built in. Libraries such as near-kit take a list of fallback addresses (fallbackRpcUrls) and move on when one fails.",
          ]}
          weaknesses={[
            "Public endpoints come and go. Lava's and Ankr's public NEAR endpoints have closed, so an app's list needs regular care.",
            "Providers can drift. Two nodes can be a block or so apart for a moment, so two answers to the same question can differ slightly.",
            "Ethereum apps have long leaned on a few big providers such as Infura and Alchemy; an outage at one of them has taken many apps down at once.",
          ]}
        />
      ) : null}
    </>
  );
}
