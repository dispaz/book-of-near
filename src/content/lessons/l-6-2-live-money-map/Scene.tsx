import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction, SceneActionGroup } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { fmt, HONEST_TAKE, SIZES } from "./money";
import { CHECK, DOLLARS, FLOWS, HONEST, ORACLE, SWAP } from "./steps";
import { useMoneyMap } from "./useMoneyMap";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-6/6.2.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What makes native USDC on NEAR different from USDC.e?",
    options: [
      { text: "Circle issues it on NEAR itself, so no bridge stands between you and Circle.", correct: true },
      {
        text: "It pays interest every day.",
        why: "A stablecoin aims to stay at one dollar; it does not pay interest by itself.",
      },
      { text: "It is mined by validators.", why: "Circle issues it; nobody mines it." },
    ],
  },
  {
    prompt:
      "A lending contract reads a NEAR price from an oracle. The price was published three months ago. What should it do?",
    options: [
      { text: "Refuse it as too old, and wait for a fresh signed update.", correct: true },
      {
        text: "Use it: an oracle price is always current.",
        why: "A pull oracle's price is as old as its last update.",
      },
      { text: "Fetch the price from a website instead.", why: "A contract cannot make web requests." },
    ],
  },
  {
    prompt:
      "Why did 100,000 USDC trade near 1:1 in the stable pool but cost 10.9% more per NEAR in the simple pool?",
    options: [
      {
        text: "A stable pool's curve keeps same-value tokens near 1:1; a simple pool's price moves as a big trade drains one side.",
        correct: true,
      },
      {
        text: "The simple pool charges a 10.9% fee.",
        why: "Its fee is 0.3%; the rest is the price moving.",
      },
      {
        text: "The stable pool is bigger.",
        why: "It held about $600,000, less than the simple pool's $1.9 million.",
      },
    ],
  },
];

/**
 * Lesson 6.2. The state lives in one hook (useMoneyMap) and is drawn by the 2D or the 3D view. The step
 * actions (compare, read, trade, flows, quiz, honest take) sit outside the views.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, reportEvidence } = props;
  const m = useMoneyMap({ step, setGate, reportEvidence });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === DOLLARS ? (
        <SceneAction onClick={m.compare} done={m.compared}>
          {m.compared ? "Compared ✓" : "Compare the two USDCs"}
        </SceneAction>
      ) : null}
      {step === ORACLE ? (
        <SceneAction onClick={m.readOracle} done={m.oracleRead}>
          {m.oracleRead ? "Oracle read ✓" : "Read the oracle"}
        </SceneAction>
      ) : null}
      {step === SWAP ? (
        <SceneActionGroup label="Trade size">
          {SIZES.map((s) => (
            <SceneAction
              key={s}
              onClick={() => m.tradeSize(s)}
              pressed={m.trade === s}
              quiet={s !== 100_000 && !m.bigTrade}
              hint={s === 100_000 && !m.bigTrade ? "Recorded quotes. Nothing is sent." : undefined}
            >
              {`Trade ${fmt(s)} USDC`}
            </SceneAction>
          ))}
        </SceneActionGroup>
      ) : null}
      {step === FLOWS ? (
        <SceneAction onClick={m.showFlows} done={m.flows}>
          {m.flows ? "Flows shown ✓" : "Show the flows"}
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
          // docs/lessons/stage-6/6.2.md, section 4, built from the recorded figures (money.ts).
          comparedWith={[...HONEST_TAKE.comparedWith]}
          strengths={[...HONEST_TAKE.strengths]}
          weaknesses={[...HONEST_TAKE.weaknesses]}
        />
      ) : null}
    </>
  );
}
