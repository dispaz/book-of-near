import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import Scene2D from "./Scene2D";
import { BACKING, CHECK, COMPARE, CONFIDENTIAL, EXPLOIT, HONEST, useBridgeCompare } from "./useBridgeCompare";
import "./scene.css";

/** The 3D view (a pop-up book scene) loads only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

// docs/lessons/stage-4/4.3.md, section 3.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What makes classic lock-and-mint bridges a target for very large hacks?",
    options: [
      {
        text: "They keep big pools of user coins in vault contracts run by a few signers or a multi-sig.",
        correct: true,
      },
      { text: "They run on solar power.", why: "Blockchains run on computers, not on solar panels." },
      { text: "They charge users no fees.", why: "Bridges do charge fees." },
    ],
  },
  {
    prompt: "A bridge vault holding real USDC is hacked. What happens to the wrapped tokens on other chains?",
    options: [
      { text: "They lose their backing and their value falls towards zero.", correct: true },
      {
        text: "A central bank pays every holder back.",
        why: "Self-custody crypto has no deposit insurance.",
      },
      {
        text: "They turn into real gold.",
        why: "Wrapped tokens lose their backing when the vault is drained.",
      },
    ],
  },
  {
    prompt: "How does NEAR's intent model avoid creating a bridge honeypot?",
    options: [
      {
        text: "You receive native coins directly; the solvers carry the cross-chain inventory risk themselves.",
        correct: true,
      },
      { text: "It makes all cross-chain transfers illegal.", why: "NEAR is built to work across chains." },
      {
        text: "It deletes all smart contracts.",
        why: "Intents still settle through a verifier contract on NEAR.",
      },
    ],
  },
];

/**
 * Lesson 4.3. The state lives in one hook (useBridgeCompare) and is drawn by the 2D or the 3D view. The
 * step actions (compare, inspect, exploit, shield, quiz, honest take) sit outside the views, so both use
 * the same ones.
 */
export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const m = useBridgeCompare({ step, setGate, setVars, reportEvidence, reducedMotion });

  return (
    <>
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D m={m} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
        <Scene2D m={m} reducedMotion={reducedMotion} mode={mode} />
      )}

      {step === COMPARE ? (
        <SceneAction onClick={() => void m.compare()} done={m.playedAll} disabled={m.loading || m.played > 0}>
          {m.playedAll
            ? "Compared ✓"
            : m.played > 0 || m.loading
              ? "Playing both paths…"
              : "Compare workflow steps"}
        </SceneAction>
      ) : null}
      {step === BACKING ? (
        <SceneAction onClick={m.inspect} done={m.inspected}>
          {m.inspected ? "Backing inspected ✓" : "Inspect asset backing"}
        </SceneAction>
      ) : null}
      {step === EXPLOIT ? (
        <SceneAction onClick={m.triggerExploit} done={m.exploited} disabled={m.exploit !== "idle"}>
          {m.exploited
            ? "Exploit simulated ✓"
            : m.exploit === "idle"
              ? "Trigger simulated vault exploit"
              : "The vault is being drained…"}
        </SceneAction>
      ) : null}
      {step === CONFIDENTIAL ? (
        <SceneAction onClick={m.shield} done={m.shielded}>
          {m.shielded ? "Shield inspected ✓" : "Inspect confidential shield"}
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
          comparedWith="Ethereum"
          // docs/lessons/stage-4/4.3.md, section 4.
          strengths={[
            "No shared honeypot for you: you never deposit into a big pool of locked coins that draws attackers.",
            "Native coins: you receive the real token (like native USDC), not a bridge IOU.",
            "Order privacy: confidential intents hide the size of a trade, so bots cannot front-run it.",
          ]}
          weaknesses={[
            "Solver spread: market makers charge a small spread or fee for holding money on many chains. In this lesson's quote that is the gap between the USD value in and out.",
            "Thin markets: for rarely traded tokens only a few solvers may quote, so spreads can be wider, or there may be no quote at all.",
            "Not risk-free: intents still depend on active solvers and on the verifier contract that settles them.",
            "Bridges are not all alike: this lesson compares the classic lock-and-mint design, and its bridge times are estimates that vary by bridge and chain.",
            "Compared with: classic bridges on Ethereum such as Wormhole, Multichain and Ronin (big collateral pools, wrapped tokens that can lose their peg, slow finality).",
          ]}
        />
      ) : null}
    </>
  );
}
