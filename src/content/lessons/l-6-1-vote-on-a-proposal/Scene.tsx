import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction, SceneActionGroup } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { fmt, vePower } from "./governance";
import { CHECK, HONEST, INSPECT, VOTE, useGovernance } from "./useGovernance";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-6/6.1.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What is the main purpose of the veNEAR (vote-escrow) model?",
    options: [
      {
        text: "To give more voting power to people who lock their tokens for longer.",
        correct: true,
      },
      {
        text: "To make users pay extra fees to validators.",
        why: "veNEAR is a way to share out voting power, not a fee.",
      },
      {
        text: "To burn half of all liquid NEAR.",
        why: "Locking does not burn tokens: they come back when the lock ends.",
      },
    ],
  },
  {
    prompt: "You unstake NEAR you delegated to a validator. When can you spend it?",
    options: [
      { text: "After an unbonding period of 4 epochs, about 48 hours.", correct: true },
      {
        text: "At once, in the next block.",
        why: "Proof of Stake security needs a waiting time before staked NEAR is free.",
      },
      {
        text: "Never: staked NEAR is locked for good.",
        why: "Staked NEAR comes back to you after the unbonding period.",
      },
    ],
  },
  {
    prompt: "A rich trader borrows 1,000,000 NEAR for 10 minutes. Can they take over veNEAR governance?",
    options: [
      {
        text: "No: the most voting power goes to tokens locked for years, not for minutes.",
        correct: true,
      },
      {
        text: "Yes: the richest account always wins.",
        why: "How long tokens are locked weighs heavily on voting power.",
      },
      {
        text: "Yes: loans get around smart contracts.",
        why: "The contract's rules apply to every account the same way.",
      },
    ],
  },
];

/**
 * Lesson 6.1. The state lives in one hook (useGovernance) and is drawn by the 2D or the 3D view. The
 * step actions (review, vote, quiz, honest take) sit outside the views.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, reportEvidence } = props;
  const m = useGovernance({ step, setGate, reportEvidence });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === INSPECT ? (
        <SceneAction onClick={m.review} done={m.reviewed}>
          {m.reviewed ? "Proposal reviewed ✓" : "Review proposal"}
        </SceneAction>
      ) : null}
      {step === VOTE ? (
        <SceneActionGroup label="Your vote">
          {(["yes", "no"] as const).map((c) => (
            <SceneAction
              key={c}
              onClick={() => m.vote(c)}
              pressed={m.ballot ? m.ballot.choice === c : undefined}
              disabled={!!m.ballot && m.ballot.choice !== c}
              quiet={c === "no" && !m.ballot}
              hint={
                c === "yes" && !m.ballot
                  ? `Weighs ${fmt(vePower(m.months))} veNEAR. A practice vote.`
                  : undefined
              }
            >
              {`Vote ${c.toUpperCase()}`}
            </SceneAction>
          ))}
        </SceneActionGroup>
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
          comparedWith={["Ethereum", "Cosmos"]}
          // docs/lessons/stage-6/6.1.md, section 4.
          strengths={[
            "Rewards long-term commitment: voting power needs tokens locked over time, so a quick loan of tokens cannot buy a vote.",
            "Decisions carry out themselves: an approved DAO proposal pays out on chain, straight from the treasury contract.",
            "Compared with Ethereum, where protocol changes are agreed by rough consensus among developers and token holders do not vote on them, and DAOs mostly vote off chain (Snapshot) and pay out with a multisig (Safe).",
          ]}
          weaknesses={[
            "Locked money: a long lock for the most voting power means you cannot sell in a sudden market crash or emergency.",
            "Few voters: reaching quorum often takes a lot of rallying, and most small holders do not vote.",
            "Compared with Cosmos, where staked ATOM votes directly on chain upgrades, with a 21-day unbonding period.",
          ]}
        />
      ) : null}
    </>
  );
}
