import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction, SceneActionGroup } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { fmt, vePower } from "./governance";
import { CHECK, HONEST, INSPECT, VOTE } from "./steps";
import { useGovernance } from "./useGovernance";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-6/6.1.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What is the main purpose of the veNEAR (vote-escrow) model?",
    options: [
      {
        text: "To give more voting power to people who keep their NEAR locked longer.",
        correct: true,
      },
      {
        text: "To make users pay extra fees to validators.",
        why: "veNEAR is a way to share out voting power, not a fee.",
      },
      {
        text: "To burn half of all liquid NEAR.",
        why: "Locking does not burn tokens: you can unlock them, after a 45-day wait.",
      },
    ],
  },
  {
    prompt: "You unstake NEAR you delegated to a validator. When can you spend it?",
    options: [
      { text: "After an unbonding period of 4 epochs, a little over a day.", correct: true },
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
    prompt: "A trader borrows 1,000,000 NEAR for 10 minutes to sway a House of Stake vote. What stops them?",
    options: [
      {
        text: "Locked NEAR takes 45 days to unlock, so they cannot get it back out to repay a 10-minute loan.",
        correct: true,
      },
      {
        text: "Nothing: the richest account always wins.",
        why: "Locked, the borrowed NEAR would count 1:1 at once. But it would then be stuck for 45 days, long after the loan is due.",
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
          comparedWith={[
            "Ethereum, where protocol changes are agreed by rough consensus among developers and token holders do not vote on them",
            "Cosmos, where staked ATOM votes directly on chain upgrades, with a 21-day unbonding period",
          ]}
          // docs/lessons/stage-6/6.1.md, section 4.
          strengths={[
            "Hard to rent a vote: voting power needs locked NEAR, and locked NEAR takes 45 days to come out, so a short loan cannot vote and be repaid. Power also grows with time locked, which favours people who stay.",
            "Decisions carry out themselves: an approved DAO proposal pays out on chain, straight from the treasury contract.",
          ]}
          weaknesses={[
            "Slow to exit: more voting power costs you the waiting period. Unlocking takes 45 days, so you cannot react quickly to a market crash or emergency, and unlocking any amount wipes all the extra veNEAR you built up.",
            "Few voters: reaching quorum often takes a lot of rallying, and most small holders do not vote.",
          ]}
        />
      ) : null}
    </>
  );
}
