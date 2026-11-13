import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { dimForStep, dimOf } from "./board";
import Scene2D from "./Scene2D";
import { CHECK, HONEST, useScoreboard } from "./useScoreboard";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-7/7.2.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What is the main trade-off of NEAR's sharded design?",
    options: [
      {
        text: "Calls between contracts are asynchronous: they take several blocks and do not roll back as one.",
        correct: true,
      },
      {
        text: "Transactions can never be private.",
        why: "Privacy is a separate question. What sharding trades away is atomic calls across contracts.",
      },
      {
        text: "The chain must stop every Sunday for maintenance.",
        why: "NEAR runs all the time; there is no weekly stop.",
      },
    ],
  },
  {
    prompt: "Where does Ethereum hold a large lead over NEAR?",
    options: [
      {
        text: "Money locked in DeFi (TVL), institutional capital and developer attention.",
        correct: true,
      },
      {
        text: "Lower fees on its base chain.",
        why: "High base-chain fees are the trade-off Ethereum accepts; it scales through rollups instead.",
      },
      {
        text: "Readable account names built into the protocol.",
        why: "Ethereum accounts are 0x hex addresses. Names come from separate contracts, not the protocol.",
      },
    ],
  },
  {
    prompt: "Why does Solana ask more of its validators' hardware than a sharded chain does?",
    options: [
      {
        text: "Every validator runs one large shared state, with no shards to split the work.",
        correct: true,
      },
      {
        text: "It uses proof-of-work mining rigs.",
        why: "Solana is proof of stake. Its validators stake; they do not mine.",
      },
      {
        text: "It runs on quantum computers.",
        why: "Its validators are ordinary, if large, servers.",
      },
    ],
  },
];

/**
 * Lesson 7.2, the honest scoreboard. The state lives in one hook (useScoreboard) and is drawn by the 2D
 * or the 3D view. The step actions (open a card, the quiz, the honest take) sit outside the views.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, reportEvidence } = props;
  const m = useScoreboard({ step, setGate, reportEvidence });
  const stepDim = dimForStep(step);

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {stepDim ? (
        <SceneAction onClick={() => m.open(stepDim)} done={m.explored.has(stepDim)}>
          {m.explored.has(stepDim)
            ? `${dimOf(stepDim).title} card open ✓`
            : `Open the ${dimOf(stepDim).title} card`}
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
          comparedWith={["Ethereum", "Solana", "Cosmos"]}
          // docs/lessons/stage-7/7.2.md, section 4.
          strengths={[
            "Clear trade-offs: knowing what each chain gives up stops you from building on the wrong one.",
            "Where NEAR is strong: onboarding (readable names, scoped keys) and reaching other chains (Chain Signatures, NEAR Intents). If those are your bottleneck, NEAR fits.",
            "Built-in sharding: NEAR adds capacity by adding shards, and validators check chunks without storing every shard.",
          ]}
          weaknesses={[
            "No free lunch: shards make calls between contracts asynchronous. They take several blocks and do not roll back as one.",
            "Much less money: on 13 Nov 2026 DefiLlama counted about $162 million locked in NEAR DeFi, against about $39.4 billion on Ethereum and $5.0 billion on Solana.",
            "Network effects: Ethereum's capital and Solana's retail trading are hard to compete with. NEAR needs builders to keep choosing it.",
          ]}
        />
      ) : null}
    </>
  );
}
