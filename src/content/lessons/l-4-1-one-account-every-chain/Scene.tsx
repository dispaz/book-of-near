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
        text: "Yes. NEAR pays Ethereum's gas in NEAR.",
        why: "Each chain takes only its own coin for gas. NEAR cannot pay Ethereum's.",
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
          strengths={[
            "One account, many chains. A NEAR account can control addresses on Bitcoin, Ethereum, Solana and more, with no contract to deploy on those chains.",
            "Contracts can sign too. A NEAR smart contract, such as a DAO, can hold an Ethereum address and sign for it by its own rules.",
            "Native, not wrapped. The transaction you signed is an ordinary Ethereum transaction. No bridge locks your coins and hands out copies, so there is no pile of locked coins to steal.",
            "Free addresses. Deriving an address is math in your browser: no fee and no transaction.",
          ]}
          weaknesses={[
            "Slower than a local key. The signing network took about 5.5 s on testnet, where a wallet on your own device signs at once.",
            "Gas on the other chain. A new derived address holds no ETH, so it cannot send anything until someone funds it or a relayer pays. This lesson stops before sending for that reason.",
            "Trust in the nodes. The scheme is safe only while enough of the signing nodes stay honest. A wallet key you keep yourself does not depend on anyone.",
            "Compared with Ethereum's smart contract wallets (ERC-4337): they need a contract on every chain and work only on chains with smart contracts, so not on Bitcoin. Chain Signatures avoid that, at the cost of the trust above.",
          ]}
        />
      ) : null}
    </>
  );
}
