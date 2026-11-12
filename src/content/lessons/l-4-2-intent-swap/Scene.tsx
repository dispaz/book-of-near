import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { FinishPanel } from "./parts";
import { CHECK, DECLARE, FILL, FINISH, HONEST, INSPECT, useIntentSwap } from "./useIntentSwap";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-4/4.2.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What is the main difference between an intent and a normal transaction?",
    options: [
      {
        text: "An intent states the result you want; solvers find and carry out the best route.",
        correct: true,
      },
      {
        text: "An intent is written on paper with a pen.",
        why: "Intents are signed digital messages.",
      },
      {
        text: "An intent is paid with credit card points.",
        why: "Intents use normal crypto assets.",
      },
    ],
  },
  {
    prompt: "How do solvers deliver funds on the other chain so quickly?",
    options: [
      {
        text: "They pay out from money they already hold on the destination chain.",
        correct: true,
      },
      {
        text: "They make the destination chain run 10,000 times faster.",
        why: "Block times are fixed by each chain; solvers cannot change them.",
      },
      {
        text: "They cancel all other transactions on the network.",
        why: "Solvers work within the normal rules of each chain.",
      },
    ],
  },
  {
    prompt:
      "Do you need gas tokens on the destination chain (like ETH on Arbitrum) to receive an intent swap?",
    options: [
      { text: "No. The solver pays the destination gas as part of the quote.", correct: true },
      {
        text: "Yes, you must hold at least 1 ETH before you swap.",
        why: "The solver pays the gas on the destination chain.",
      },
      {
        text: "Yes, you must send cash to the miner.",
        why: "All fees are settled inside the swap.",
      },
    ],
  },
];

/**
 * Lesson 4.2. The state lives in one hook (useIntentSwap) and is drawn by the 2D or the 3D view. The
 * step actions (quote, inspect, simulate, finish, quiz, honest take) sit outside the views, so both use
 * the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const m = useIntentSwap({ step, setGate, setVars, reportEvidence, reducedMotion });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === DECLARE ? (
        <SceneAction onClick={() => void m.fetchQuote()} done={!!m.quote} disabled={m.loading}>
          {m.quote ? "Quote received ✓" : m.loading ? "Asking 1Click…" : "Fetch live intent quote"}
        </SceneAction>
      ) : null}
      {step === INSPECT ? (
        <SceneAction
          onClick={m.inspect}
          done={m.inspected}
          disabled={!m.quote}
          hint={!m.quote ? "Fetch the quote first (step 2)." : undefined}
        >
          {m.inspected ? "Quote inspected ✓" : "Inspect quote breakdown"}
        </SceneAction>
      ) : null}
      {step === FILL ? (
        <SceneAction onClick={m.simulate} done={m.fill === "done"} disabled={!m.quote || m.fill !== "idle"}>
          {m.fill === "done"
            ? "Delivered ✓"
            : m.fill === "idle"
              ? "Simulate solver execution"
              : "The solver is working…"}
        </SceneAction>
      ) : null}
      {step === FINISH ? (
        <>
          <SceneAction
            onClick={m.finishDry}
            done={m.finish === "dry"}
            quiet={m.finished && m.finish !== "dry"}
          >
            {m.finish === "dry" ? "Finished on the verified quote ✓" : "Finish on verified quote"}
          </SceneAction>
          <FinishPanel m={m} />
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
          comparedWith="Ethereum"
          // docs/lessons/stage-4/4.2.md, section 4.
          strengths={[
            "No gas headaches: you trade between chains without buying the other chain's gas token.",
            "Protection from front-running: orders stay private until a solver is matched off chain, so bots cannot jump ahead of you (MEV, value taken by reordering trades).",
            "A guaranteed price: the quote locks a minimum output, so there is no surprise slippage.",
          ]}
          weaknesses={[
            "Depends on market makers: rare or thin token pairs need active solvers; without them there is no quote.",
            "Mainnet first: intents run on mainnet with real money, and there is no testnet for 1Click. This lesson uses a dry-run quote (and a recorded one in demo mode) for that reason.",
            "One answer, not an auction you can see: 1Click shows only the winning quote, so you cannot check the losing bids yourself.",
            "Compared with: Uniswap and other AMMs on one chain (MEV and slippage exposure) and classic bridges (slow, many steps, wrapped tokens).",
          ]}
        />
      ) : null}
    </>
  );
}
