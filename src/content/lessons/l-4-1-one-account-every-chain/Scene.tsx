import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { PathForm } from "./parts";
import { isWaiting } from "./signing";
import { CHECK, DERIVE, HONEST, PREPARE, SIGN, useChainSig, VERIFY } from "./useChainSig";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-4/4.1.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Who holds the private key for your derived Ethereum address?",
    options: [
      {
        text: "Nobody holds the whole key. It exists only as shares spread across the signing nodes.",
        correct: true,
      },
      {
        text: "The NEAR Foundation keeps it in a safe.",
        why: "No single party holds it. Each node holds only a share, and they sign together.",
      },
      {
        text: "Your browser stores it next to your NEAR key.",
        why: "Your browser only does the math for the address. The signature comes from the signing nodes.",
      },
    ],
  },
  {
    prompt: "How much does it cost to derive a new address from your NEAR account?",
    options: [
      { text: "Nothing. It is math done in your browser, with no transaction.", correct: true },
      {
        text: "A small NEAR fee per address.",
        why: "Deriving sends no transaction, so there is no fee. Only signing costs gas.",
      },
      {
        text: "1 ETH, paid on Ethereum.",
        why: "Nothing happens on Ethereum when you derive. The address is just worked out.",
      },
    ],
  },
  {
    prompt: "Your derived Ethereum address holds 0 ETH. Can it send its signed transaction on its own?",
    options: [
      {
        text: "No. Ethereum needs ETH for gas, so someone must fund it first, or a relayer must pay.",
        correct: true,
      },
      {
        text: "Yes. Ethereum transactions do not need gas.",
        why: "Every Ethereum transaction pays gas in ETH.",
      },
      {
        text: "Yes, NEAR pays the Ethereum validators on its behalf.",
        why: "The address must hold ETH or use a relayer to pay gas.",
      },
    ],
  },
];

/**
 * Lesson 4.1. The state lives in one hook (useChainSig) and is drawn by the 2D or the 3D view. The
 * step actions (path, derive, pack, sign, check, quiz, honest take) sit outside the views, so both use
 * the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const cs = useChainSig({ step, setGate, setVars, reportEvidence, reducedMotion });
  const waiting = isWaiting(cs.phase);

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D cs={cs} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D cs={cs} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === DERIVE ? (
        <>
          {cs.account ? null : <PathForm cs={cs} />}
          <SceneAction
            onClick={() => void cs.derive()}
            done={!!cs.account}
            disabled={cs.deriving || !cs.pathCheck.ok}
          >
            {cs.account ? "Address derived ✓" : cs.deriving ? "Working it out…" : "Derive Ethereum address"}
          </SceneAction>
          {cs.account ? (
            <SceneAction quiet onClick={cs.again}>
              Try another path
            </SceneAction>
          ) : null}
        </>
      ) : null}
      {step === PREPARE ? (
        <SceneAction onClick={cs.prepare} done={!!cs.prepared} disabled={!cs.account}>
          {cs.prepared ? "Transaction packed ✓" : "Prepare payload"}
        </SceneAction>
      ) : null}
      {step === SIGN ? (
        <SceneAction
          onClick={() => void cs.sign()}
          done={!!cs.result}
          disabled={waiting || !cs.prepared}
          hint={!cs.prepared ? "Pack the transaction first (step 3)." : undefined}
        >
          {cs.result ? "Signature back ✓" : waiting ? "Waiting for the nodes…" : "Request signature (MPC)"}
        </SceneAction>
      ) : null}
      {step === VERIFY ? (
        <SceneAction
          onClick={() => void cs.verify()}
          done={!!cs.recovered}
          disabled={!cs.signed}
          hint={!cs.signed ? "Request the signature first (step 4)." : undefined}
        >
          {cs.recovered ? "Signer checked ✓" : "Verify signer"}
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={cs.passed}
          onPass={() => {
            cs.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith="Ethereum"
          // docs/lessons/stage-4/4.1.md, section 4 (#49), word for word.
          strengths={[
            "Multichain sovereignty without contracts: One NEAR account controls an Ethereum address without deploying a wallet contract on Ethereum.",
            "Smart contract control: A NEAR DAO or smart contract can programmatically control an Ethereum treasury.",
            "Zero-bridge native assets: The signed transaction executes directly on Ethereum; no wrapped token honeypots.",
          ]}
          weaknesses={[
            "MPC signing latency: The signing nodes need several seconds to agree on a signature (7 to 14 seconds on testnet in our runs, from sending the request to a final answer), slower than signing with a local private key.",
            "Foreign gas bootstrapping: A newly derived address requires ETH (or a gas relayer) before its signed transactions can broadcast.",
            "Validator threshold trust: Security relies on the cryptographic assumption that a threshold majority of MPC validators remain honest.",
            "Compared with: Cross-chain Bridges (vulnerable to smart contract hacks) and Account Abstraction (ERC-4337) (EVM-only; needs a contract wallet deployed on each chain).",
          ]}
        />
      ) : null}
    </>
  );
}
