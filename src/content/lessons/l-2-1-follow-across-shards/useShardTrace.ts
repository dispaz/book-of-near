/**
 * The ONE state of lesson 2.1, shared by the 2D and the 3D view: which transaction is open, its path,
 * and which hop the learner has followed to. Everything on chain goes through useChain(). No three.js here.
 * The lesson never sends or times a new transaction: it reads one that already finished.
 */
import { useEffect, useMemo, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { isChainError } from "../../../chain/errors";
import { transfer } from "../../../chain/ops";
import { parseNear } from "../../../chain/units";
import { progress } from "../../../progress";
import { RECORDED } from "./recorded";
import { loadTrace, readSeenEvidence, touchedShards, varsFor, type SeenEvidence, type Trace } from "./trace";

// Step numbers (0-based) from manifest.ts.
export const PICK = 0;
export const GRID = 1;
export const START = 2;
export const FOLLOW = 3;
export const TIME = 4;
export const CHECK = 5;
export const HONEST = 6;

const LESSON_03 = "l-0-3-send-a-transaction";

export type Choice = "mine" | "example";
export type ShardTrace = ReturnType<typeof useShardTrace>;

/** What 0.3 left behind: finished record first, else evidence reported before Finish. */
function evidenceFrom03(): SeenEvidence | null {
  const snap = progress.snapshot();
  const done = snap.completions.find((c) => c.lessonId === LESSON_03)?.evidence;
  return readSeenEvidence({ ...snap.evidence[LESSON_03], ...done });
}

export function useShardTrace({
  step,
  setGate,
  setVars,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reportEvidence">) {
  const chain = useChain();
  const network = chain.network;
  const seen = useMemo(evidenceFrom03, []);
  // A 0.3 transaction can only be read on the network it was made on.
  const ownProblem = !seen
    ? "You have not sent a transaction in 0.3 yet."
    : seen.mode !== network
      ? `Your 0.3 transaction was made in ${seen.mode} mode. Switch to ${seen.mode} mode to open it.`
      : null;

  const [choice, setChoice] = useState<Choice | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** The hop the learner has followed to (0-based). */
  const [at, setAt] = useState(0);
  const [passed, setPassed] = useState(false);

  const open = async (c: Choice) => {
    setChoice(c);
    setProblem(null);
    setAt(0);
    if (c === "example") {
      setTrace(RECORDED);
      return;
    }
    if (!seen || ownProblem) return;
    setLoading(true);
    try {
      const me = await chain.practiceAccount();
      const source = network === "testnet" ? "yours" : "demo";
      let t: Trace;
      try {
        t = await loadTrace(chain, seen.txHash, me.accountId, source);
      } catch (e) {
        // Demo mode lives in memory: after a page reload the 0.3 transfer is gone. Replay the same demo
        // transfer (deterministic, instant) so the path is still the demo transaction.
        if (network !== "demo" || !isChainError(e) || e.kind !== "UnknownTransaction") throw e;
        const out = await transfer(chain, await chain.returnAccount(), parseNear("0.01"), {
          pace: "instant",
        });
        t = await loadTrace(chain, out.transaction.hash, me.accountId, source);
      }
      setTrace(t);
    } catch {
      setTrace(null);
      setChoice(null);
      setProblem(
        "The app could not read that transaction just now. Try again, or open the recorded example instead.",
      );
    } finally {
      setLoading(false);
    }
  };

  // The learner's own numbers in later text; the completion record points at the transaction.
  useEffect(() => {
    if (!trace) return;
    setVars?.(varsFor(trace, seen));
    reportEvidence?.({
      txHash: trace.txHash,
      mode: trace.source === "yours" ? "testnet" : "demo",
      source: trace.source,
      shards: touchedShards(trace).join(","),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace]);

  const last = trace ? trace.hops.length - 1 : 0;
  // Gates: step 1 opens once a transaction is open; the follow step opens at the last receipt.
  useEffect(() => {
    if (step === PICK) setGate(!!trace);
    if (step === FOLLOW) setGate(!!trace && at >= last);
  }, [step, trace, at, last, setGate]);

  /** How many hops the picture draws: none until the grid is explained, one at the start, then as followed. */
  const drawn = !trace ? -1 : step <= GRID ? -1 : step === START ? 0 : step === FOLLOW ? at : last;
  const follow = () => setAt((a) => Math.min(last, a + 1));
  const pick = (index: number) => setAt(Math.max(0, Math.min(Math.max(drawn, 0), index)));

  /** The hop the text and the markers talk about: the first one until the follow step. */
  const cur = step <= START ? 0 : Math.min(at, last);
  const state = `${trace ? `source:${trace.source}` : "source:none"};hop:${trace ? cur + 1 : 0}/${trace ? trace.hops.length : 0}`;
  return {
    step,
    network,
    seen,
    ownProblem,
    choice,
    trace,
    loading,
    problem,
    at: cur,
    last,
    drawn,
    state,
    passed,
    pass: () => setPassed(true),
    open,
    follow,
    pick,
    hop: trace ? trace.hops[cur]! : null,
  };
}
