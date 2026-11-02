import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { DEFAULT_TXS } from "./ledger";
import { TxForm } from "./parts";
import Scene2D from "./Scene2D";
import {
  CHECK,
  COMPARE,
  HONEST,
  LINKS,
  MAX_BLOCKS,
  nextDefault,
  SEND,
  TAMPER,
  useLedgerLesson,
} from "./useLedgerLesson";

// The 3D view pulls in three.js, so it loads only when the learner picks 3D.
const Scene3D = lazy(() => import("./Scene3D"));

const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Why does changing an old block break the chain?",
    options: [
      { text: "The block's hash changes, and the next block still stores the old hash.", correct: true },
      {
        text: "The network deletes any block older than one hour.",
        why: "Blocks are never deleted; the problem is the hash link.",
      },
      {
        text: "Old blocks are locked with a password.",
        why: "There is no password; anyone can read and recompute the hashes.",
      },
      { text: "Coins in old blocks expire.", why: "Nothing expires; the mismatch comes from the hash." },
    ],
  },
  {
    prompt: "Ana has 7 coins. She tries to send Ben 9. What happens?",
    options: [
      { text: "The transaction is rejected and no balances change.", correct: true },
      { text: "Ana's balance goes to −2.", why: "The ledger checks a transaction before accepting it." },
      {
        text: "Ben gets 7 coins and the rest is skipped.",
        why: "A transaction is accepted whole or not at all.",
      },
    ],
  },
  {
    prompt: "What does a block's hash do?",
    options: [
      { text: "It acts as a fingerprint: any change to the block gives a different hash.", correct: true },
      {
        text: "It encrypts the block so nobody can read it.",
        why: "A hash does not hide the data; blocks are public.",
      },
      {
        text: "It records the time the block was made.",
        why: "That would be a timestamp, not a hash.",
      },
      { text: "It shows how many coins are in the block.", why: "The hash is a fingerprint, not a balance." },
    ],
  },
];

/**
 * Lesson 0.1. The state lives here, in one hook, and is drawn by the 2D or the 3D view. The step
 * actions (forms, buttons, Check, Honest take) sit outside the views, so both use the same ones.
 */
export default function Scene({ step, setGate, reducedMotion, mode, setVars, view, flat }: SceneProps) {
  const m = useLedgerLesson({ step, setGate, setVars });
  const { chain, bal } = m;

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {/* Step actions, docked above the lesson card. Panels float in the scene area. */}
      {step === SEND && chain.length < 2 ? (
        <TxForm key="send" fixed initial={DEFAULT_TXS[0]!} bal={bal} onSend={m.send} />
      ) : null}
      {step === LINKS && chain.length < MAX_BLOCKS ? (
        <TxForm key={`links-${chain.length}`} initial={nextDefault(chain)} bal={bal} onSend={m.send} />
      ) : null}
      {step === TAMPER ? (
        <>
          <SceneAction onClick={m.repair} disabled={!m.broken.length}>
            Repair next block
          </SceneAction>
          <SceneAction onClick={m.undo} disabled={!m.benDiffers}>
            Undo my edit
          </SceneAction>
        </>
      ) : null}
      {step === COMPARE && !m.compared ? <SceneAction onClick={m.compare}>Compare copies</SceneAction> : null}

      {step === CHECK ? <Check questions={QUESTIONS} passed={m.passed} onPass={m.pass} /> : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith={["Bitcoin", "Ethereum"]}
          strengths={[
            "Tamper-evident history. Any change to an old block breaks every later link, so anyone can spot it by recomputing hashes.",
            "No single owner. Nobody has to trust one bank's private copy of the ledger. Everyone can check the same public history.",
            "NEAR is fast for a blockchain. It makes a new block about every second or less (NEAR's docs give figures between 0.6 and 1 s) and reaches finality, the point where a block cannot change, in about 1.2 s. Ethereum makes a block every 12 s; Bitcoin aims for one every 10 minutes.",
          ]}
          weaknesses={[
            "Slower and costlier than a normal database. Many computers must store and agree on every change. One company's database is far quicker and cheaper when you can trust its owner. This is true of NEAR too.",
            "Public by default. On Bitcoin, Ethereum and NEAR anyone can see transactions and balances with an explorer (a website that shows the chain). Privacy needs extra tools.",
            "Mistakes are hard to undo. Once a transaction is final there is no bank to call. A typo in the amount or the receiver stays in the history.",
          ]}
        />
      ) : null}
    </>
  );
}
