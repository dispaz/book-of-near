import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction, SceneActionGroup } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { CALL, CHECK, CLEAR, DEPLOY, FAIL, HONEST, useDeploy } from "./useDeploy";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-3/3.1.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "How is data storage paid for on NEAR?",
    options: [
      { text: "By locking a refundable deposit of 1 NEAR per 100 KB of data stored.", correct: true },
      {
        text: "By paying a monthly fee to the network.",
        why: "There is no rent. The account keeps NEAR locked while the data exists.",
      },
      { text: "Storage is free and unlimited.", why: "Every stored byte needs locked NEAR." },
    ],
  },
  {
    prompt: "What happens to your locked storage NEAR when you delete stored data?",
    options: [
      { text: "It is unlocked and returned to your available balance.", correct: true },
      { text: "It is burned and lost forever.", why: "Storage deposits are refundable." },
      { text: "It is sent to the validator as a bonus.", why: "It never leaves your account." },
    ],
  },
  {
    prompt: "What code format do NEAR smart contracts compile down to?",
    options: [
      { text: "Standard WebAssembly (Wasm).", correct: true },
      { text: "EVM bytecode.", why: "That is Ethereum's format. NEAR runs Wasm." },
      { text: "Python scripts.", why: "Contracts compile to Wasm binaries." },
    ],
  },
];

/**
 * Lesson 3.1. The state lives in one hook (useDeploy) and is drawn by the 2D or the 3D view. The step
 * actions (deploy, increment, read, the failing callback, reset, Check, Honest take) sit outside the views,
 * so both use the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const d = useDeploy({ step, setGate, setVars, reducedMotion, reportEvidence });
  const needDeploy = d.deployed ? undefined : "Deploy the contract first (step 3).";

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D d={d} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D d={d} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === DEPLOY ? (
        <SceneAction onClick={() => void d.deploy()} disabled={!d.canDeploy && !d.deployed} done={d.deployed}>
          {d.deployed ? "Deployed ✓" : d.busy === "deploy" ? "Deploying…" : "Deploy counter contract"}
        </SceneAction>
      ) : null}
      {step === CALL ? (
        <SceneActionGroup label="Call the contract">
          <SceneAction
            onClick={() => void d.increment()}
            disabled={!d.canCall}
            quiet={d.increments > 0}
            hint={needDeploy}
          >
            Increment
          </SceneAction>
          <SceneAction
            onClick={() => void d.readCount()}
            disabled={!d.canCall || d.increments === 0}
            quiet={d.increments === 0 || d.readOk}
          >
            Read the count
          </SceneAction>
        </SceneActionGroup>
      ) : null}
      {step === FAIL ? (
        <SceneAction
          onClick={() => void d.failWithCallback()}
          disabled={!d.canFail && d.lastResult !== "failed"}
          done={d.lastResult === "failed"}
          hint={needDeploy}
        >
          {d.lastResult === "failed"
            ? "Callback ran ✓"
            : d.busy === "fail"
              ? "Calling…"
              : "Call fail with a callback"}
        </SceneAction>
      ) : null}
      {step === CLEAR ? (
        <SceneAction
          onClick={() => void d.reset()}
          disabled={!d.canReset && !d.cleared}
          done={!!d.cleared}
          hint={needDeploy}
        >
          {d.cleared ? "State cleared ✓" : d.busy === "reset" ? "Clearing…" : "Reset and clear state"}
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={d.passed}
          onPass={() => {
            d.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith="Ethereum"
          strengths={[
            "Storage pays its way. Every stored byte needs locked NEAR, and deleting data gives it back, so cleaning up is rewarded. On Ethereum you pay once to store and the network keeps it forever.",
            "Standard WebAssembly. Write contracts in Rust or JavaScript; both compile to Wasm. This lesson's counter was written by hand in Wasm text, with no toolchain at all.",
            "Contracts live under your name. counter.you.testnet is made by you, in the same batch as the deploy, with no registrar.",
            "Upgrade in place. Deploy new code to the same account and it keeps its name and its stored state. Ethereum code cannot change, so upgrades need a proxy contract in front.",
          ]}
          weaknesses={[
            "The deposit comes first. A 200 KB contract locks 2 NEAR before anyone uses it, which can surprise new builders.",
            "LackBalanceForState. If an account cannot cover the deposit for new data, the transaction fails until someone tops it up. Apps that store user data must charge users for storage or pay it themselves.",
            "Upgradable by default. Anyone holding a full-access key on the contract account can replace the code. Check that a contract's account has no full-access keys before you trust it.",
            "No automatic rollback across calls. When a called method fails, the caller's changes stay. Only a callback, written with care, can undo them.",
          ]}
        />
      ) : null}
    </>
  );
}
