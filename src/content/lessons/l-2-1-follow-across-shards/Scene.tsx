import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { CHECK, FOLLOW, HONEST, PICK, TIME, useShardTrace, type ShardTrace } from "./useShardTrace";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-2/2.1.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What is a chunk on NEAR?",
    options: [
      { text: "The transactions and receipts one shard ran for one block.", correct: true },
      { text: "A piece of your private key.", why: "Keys prove who you are. A chunk is network work." },
      {
        text: "Another word for the whole blockchain.",
        why: "A chunk is only one shard's part of one block.",
      },
    ],
  },
  {
    prompt: "Which shard runs your transaction first?",
    options: [
      { text: "The shard that holds the signer's account.", correct: true },
      {
        text: "The shard that holds the receiver's account.",
        why: "The receiver's shard runs the receipt that follows, in a later block.",
      },
      {
        text: "A random shard picked by lottery.",
        why: "The account name decides the shard, by sorting it against the boundary accounts.",
      },
    ],
  },
  {
    prompt: "Why does a transaction that touches several accounts take several blocks?",
    options: [
      { text: "Each receipt runs in a later block, often on another shard.", correct: true },
      { text: "You must sign again for each step.", why: "You sign once, at the start." },
      {
        text: "Shards take turns making blocks, one at a time.",
        why: "Every shard makes a chunk in every block, side by side.",
      },
    ],
  },
];

/**
 * Lesson 2.1. The state lives in one hook (useShardTrace) and is drawn by the 2D or the 3D view. The
 * step actions (choice, load, follow, inspect, Check, Honest take) sit outside the views, so both use
 * the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const st = useShardTrace({ step, setGate, setVars, reportEvidence });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D st={st} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D st={st} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === PICK ? <Picker st={st} /> : null}
      {step === FOLLOW && st.trace ? (
        <SceneAction onClick={st.follow} disabled={st.reached >= st.last}>
          {st.reached >= st.last ? "Followed ✓" : "Follow next receipt"}
        </SceneAction>
      ) : null}
      {step === TIME && st.trace ? (
        <SceneAction onClick={st.inspect} disabled={st.inspected}>
          {st.inspected ? "Breakdown open ✓" : "Inspect breakdown"}
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={st.passed}
          onPass={() => {
            st.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith={["Ethereum", "Solana"]}
          strengths={[
            "Parallel work. Each shard makes its own chunk in every block, side by side. Adding shards adds capacity without making each machine do more. You saw it on the page: one chunk per shard per block.",
            "You do not have to know. You use one named account. The network finds its shard from the name and routes every receipt to the right shard for you.",
            "Stateless validation. Validators check a chunk using a state witness (the data and proofs it needs) instead of storing the whole shard on disk. That keeps the hardware to run a validator within reach.",
          ]}
          weaknesses={[
            "Extra blocks per hop. A call to an account on another shard runs as a receipt in a later block, about a second each. It is not one step inside one block.",
            "Hard to trace. A transaction's status has no shard number. Apps must work it out from the shard layout, which is why this lesson looks it up in two steps.",
            "The layout changes. Resharding moves the boundary accounts, so shard numbers cannot be hard-coded. Testnet had 10 shards with non-contiguous ids on 1 Nov 2026.",
            "Ethereum chose another road. It dropped shard chains and scales with rollups: separate chains that post their data back to Ethereum. That avoids receipts between shards but splits apps across layers and bridges.",
            {
              text: "Solana keeps one global state with no sharding, and leans on powerful machines that run transactions in parallel.",
              unverified: true,
            },
          ]}
        />
      ) : null}
    </>
  );
}

/** Step 1's choice card, docked: which transaction, then load its path. */
function Picker({ st }: { st: ShardTrace }) {
  const loaded = !!st.trace;
  return (
    <>
      <SceneAction onClick={() => st.choose("mine")} disabled={!!st.ownProblem || st.loading}>
        {st.choice === "mine" ? "My 0.3 transaction ✓" : "My 0.3 transaction"}
      </SceneAction>
      <SceneAction onClick={() => st.choose("example")} disabled={st.loading}>
        {st.choice === "example" ? "Recorded example ✓" : "Recorded example"}
      </SceneAction>
      <SceneAction onClick={() => void st.load()} disabled={st.loading || loaded}>
        {loaded ? "Path loaded ✓" : st.loading ? "Loading…" : "Load transaction path"}
      </SceneAction>
    </>
  );
}
