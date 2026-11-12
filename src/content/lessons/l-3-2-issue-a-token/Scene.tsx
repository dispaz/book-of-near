import { lazy, Suspense, useContext } from "react";
import { createPortal } from "react-dom";
import type { SceneProps } from "../../../app/types";
import { ActionSlot, SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { FRIEND, SEND_AMOUNT } from "./ft";
import Scene2D from "./Scene2D";
import { CHECK, GASLESS, HONEST, MINT, REGISTER, TRAP, useToken, type Token } from "./useToken";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-3/3.2.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Why does sending a new token to an unregistered account fail by default?",
    options: [
      {
        text: "The receiver has no storage deposit to pay for its balance record in the token contract.",
        correct: true,
      },
      { text: "The receiver needs a government passport.", why: "NEAR is permissionless." },
      {
        text: "The token contract ran out of internet bandwidth.",
        why: "Blockchain storage is an economic limit, not a bandwidth one.",
      },
    ],
  },
  {
    prompt: "How do meta-transactions (NEP-366) help new users?",
    options: [
      { text: "They can send tokens without holding NEAR for gas first.", correct: true },
      { text: "They make transactions untraceable.", why: "Meta-transactions are public on chain." },
      { text: "They remove the need for private keys.", why: "The user still signs the action." },
    ],
  },
  {
    prompt: "What happens to the storage deposit when an account empties its balance and unregisters?",
    options: [
      { text: "It is refunded to the account.", correct: true },
      {
        text: "The token's owner keeps it as profit.",
        why: "The deposit belongs to whoever registered the account.",
      },
      { text: "It turns into lottery tickets.", why: "Deposits follow the contract's rules: it comes back." },
    ],
  },
];

/**
 * Lesson 3.2. The state lives in one hook (useToken) and is drawn by the 2D or the 3D view. The step
 * actions (mint, send, register, gasless send, Check, Honest take) sit outside the views, so both use
 * the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const t = useToken({ step, setGate, setVars, reducedMotion, reportEvidence });
  const needMint = t.minted ? undefined : "Mint your tokens first (step 2).";

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D t={t} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D t={t} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === MINT && !t.minted ? <MintForm t={t} /> : null}
      {step === MINT ? (
        <SceneAction
          onClick={() => void t.mint()}
          disabled={!t.canMint || !!t.symbolProblem || !!t.supplyProblem}
          done={!!t.minted}
        >
          {t.minted ? "Minted ✓" : t.busy === "mint" ? "Minting…" : `Mint ${t.symbol} tokens`}
        </SceneAction>
      ) : null}
      {step === TRAP ? (
        <SceneAction onClick={() => void t.sendToFriend()} disabled={!t.canSend} done={!!t.refused} hint={needMint}>
          {t.refused
            ? "Refused ✓"
            : t.busy === "send"
              ? "Sending…"
              : `Send ${SEND_AMOUNT} ${t.symbol} to ${FRIEND}`}
        </SceneAction>
      ) : null}
      {step === REGISTER ? (
        <SceneAction
          onClick={() => void t.register()}
          disabled={!t.canRegister}
          done={!!t.registered}
          hint={t.refused ? undefined : "Send to your friend first (step 3)."}
        >
          {t.registered ? "Registered ✓" : t.busy === "register" ? "Paying…" : "Pay storage deposit for friend"}
        </SceneAction>
      ) : null}
      {step === GASLESS ? (
        <SceneAction
          onClick={() => void t.gasless()}
          disabled={!t.canGasless}
          quiet={t.relayed > 0}
          hint={t.registered ? undefined : "Register your friend's storage first (step 4)."}
        >
          {t.busy === "gasless"
            ? "Relaying…"
            : t.capped
              ? "Relayer cap reached"
              : t.relayed
                ? "Send another gasless transfer"
                : "Sign gasless transfer"}
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={t.passed}
          onPass={() => {
            t.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith="Ethereum ERC-20, where gasless transfers need ERC-4337 bundlers and paymasters"
          strengths={[
            "Protection from storage spam. Nobody can drain a token contract's NEAR by sending dust to millions of new accounts: each new balance record must be paid for.",
            "Meta-transactions are built into the protocol. Any NEAR account can sign a delegate action and let a relayer pay. Ethereum needs ERC-4337 smart-contract wallets, bundlers and paymasters for the same thing.",
            "Registration is refundable. An account that empties its balance can unregister and get its storage deposit back.",
          ]}
          weaknesses={[
            "Onboarding friction. A first transfer to a new account fails unless the sender also pays the receiver's storage_deposit, which surprises people coming from ERC-20.",
            "Two actions for one send. Apps routinely bundle a NEAR storage deposit with the token transfer, which makes wallets and apps more complex.",
          ]}
        />
      ) : null}
    </>
  );
}

/** Symbol and supply, docked above the lesson card at the mint step. */
function MintForm({ t }: { t: Token }) {
  const slot = useContext(ActionSlot);
  const problem = t.symbolProblem ?? t.supplyProblem;
  const form = (
    <form className="tok-form" aria-label="Your token" onSubmit={(e) => e.preventDefault()}>
      <label>
        <span>Symbol</span>
        <input
          value={t.symbolInput}
          maxLength={8}
          spellCheck={false}
          autoCapitalize="characters"
          autoComplete="off"
          disabled={!!t.busy}
          onChange={(e) => t.setSymbolInput(e.target.value.toUpperCase())}
        />
      </label>
      <label>
        <span>Supply</span>
        <input
          value={t.supplyInput}
          inputMode="numeric"
          maxLength={13}
          autoComplete="off"
          disabled={!!t.busy}
          onChange={(e) => t.setSupplyInput(e.target.value)}
        />
      </label>
      {problem ? (
        <p className="tok-form-error" role="status" data-testid="mint-problem">
          {problem}
        </p>
      ) : null}
    </form>
  );
  return slot ? createPortal(form, slot) : form;
}
