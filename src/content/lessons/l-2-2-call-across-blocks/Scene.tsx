import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { orderButton } from "./steps";
import { CHECK, FAIL, GAS, HONEST, ORDER, useCrossCall } from "./useCrossCall";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-2/2.2.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "If a contract you call panics and fails, what happens to your contract's earlier changes?",
    options: [
      {
        text: "They stay committed. Your callback must see the failure and undo them itself.",
        correct: true,
      },
      {
        text: "The whole blockchain stops and rolls the block back.",
        why: "Blocks are never rolled back for a contract's error.",
      },
      {
        text: "Every change reverts automatically, as on Ethereum.",
        why: "NEAR receipts commit one by one, across blocks.",
      },
    ],
  },
  {
    prompt: "What happens to the gas a contract's code burns?",
    options: [
      { text: "All of it is burned. No account receives it.", correct: true },
      {
        text: "30% goes to the contract's account.",
        why: "That was the rule up to protocol version 86. From version 87, all of it is burned.",
      },
      {
        text: "It goes back to the user as a discount.",
        why: "Burnt gas is paid for and destroyed.",
      },
    ],
  },
  {
    prompt: "Why are calls between contracts asynchronous on NEAR?",
    options: [
      {
        text: "Contracts can live on different shards and run in parallel without locking the whole network.",
        correct: true,
      },
      {
        text: "Because WebAssembly cannot do maths.",
        why: "WebAssembly computes fast. The reason is shards, not speed.",
      },
      {
        text: "To make users pay gas twice.",
        why: "Gas is charged for the work done, once.",
      },
    ],
  },
];

/**
 * Lesson 2.2. The state lives in one hook (useCrossCall) and is drawn by the 2D or the 3D view. The step
 * actions (the order, the gas, the failure, Check, Honest take) sit outside the views, so both
 * use the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const c = useCrossCall({ step, setGate, setVars, reducedMotion, reportEvidence });
  const orderDone = !!c.call && (step !== ORDER || c.complete);
  const failDone = !!c.failure && (step !== FAIL || c.complete);

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D c={c} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D c={c} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === ORDER ? (
        <SceneAction onClick={c.order} disabled={!!c.busy || (!!c.call && !orderDone)} done={orderDone}>
          {orderDone
            ? orderButton(c.network).done
            : c.busy
              ? "Sending…"
              : c.call
                ? "Receipts hopping…"
                : orderButton(c.network).press}
        </SceneAction>
      ) : null}
      {step === GAS ? (
        <SceneAction onClick={c.inspect} disabled={!c.call} done={c.inspected}>
          {c.inspected ? "Gas shown ✓" : "Inspect gas"}
        </SceneAction>
      ) : null}
      {step === FAIL ? (
        <SceneAction onClick={c.fail} disabled={!!c.busy || (!!c.failure && !failDone)} done={failDone}>
          {failDone
            ? "Callback recovered ✓"
            : c.busy
              ? "Sending…"
              : c.failure
                ? "Receipts hopping…"
                : "Simulate out-of-stock failure"}
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={c.passed}
          onPass={() => {
            c.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith="Ethereum"
          strengths={[
            "No classic reentrancy. A call hands control away until a fresh callback receipt runs, which stops the kind of attack behind Ethereum's DAO hack before it starts.",
            "Calls cross shards. Asynchronous receipts let contracts on different shards work together without locking the whole network.",
          ]}
          weaknesses={[
            "No rollback across receipts. When a called contract fails, the caller's changes stay. Recovering needs careful callback code that restores state and refunds money.",
            "Slower round trips. Every hop between contracts waits for a later block, about a second each. Ethereum finishes a chain of calls inside one transaction.",
            "Callbacks can starve. If the attached gas runs out before the callback, it never runs and state can get stuck. Builders must keep gas for it.",
            "Ethereum's calls are synchronous and atomic: if any call fails, the whole transaction reverts.",
          ]}
        />
      ) : null}
    </>
  );
}
