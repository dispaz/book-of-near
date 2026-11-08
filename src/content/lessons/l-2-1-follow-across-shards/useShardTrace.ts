/**
 * The ONE state of lesson 2.1, shared by the 2D and the 3D view: which transaction is open, its path,
 * how far the learner has followed it and what they picked. Everything on chain goes through useChain().
 * No three.js here. The lesson never sends or times a new transaction: it reads one that already finished.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
    ? "You have not sent a transaction in 0.3 yet, so the recorded example is chosen."
    : seen.mode !== network
      ? `Your 0.3 transaction was made in ${seen.mode} mode. Switch to ${seen.mode} mode to open it.`
      : null;

  /** The choice card: the learner's own 0.3 transaction when there is one, else the recorded example. */
  const [choice, setChoice] = useState<Choice>(ownProblem ? "example" : "mine");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** How far the path is followed (0-based hop): it never goes back. */
  const [reached, setReached] = useState(0);
  /** The hop the learner is looking at (picked or just followed); at most `reached`. */
  const [at, setAt] = useState(0);
  /** A shard row the learner picked at the grid step. */
  const [shard, setShard] = useState<number | null>(null);
  /** Step 5's breakdown bar has been opened. */
  const [inspected, setInspected] = useState(false);
  const [passed, setPassed] = useState(false);

  const choose = (c: Choice) => {
    if (c === "mine" && ownProblem) return;
    setChoice(c);
    if (c !== choice) setTrace(null);
    setProblem(null);
  };

  const load = async () => {
    setProblem(null);
    setReached(0);
    setAt(0);
    setShard(null);
    if (choice === "example") {
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
      setProblem(
        "The app could not read that transaction just now. Try again, or choose the recorded example instead.",
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

  // Opened past step 1 with nothing loaded (a link to a later step, or a reload): load the chosen
  // transaction, so the later steps never sit empty. Not again after a failed load (the problem shows).
  useEffect(() => {
    if (step > PICK && !trace && !loading && !problem) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, trace, loading, problem]);

  const last = trace ? trace.hops.length - 1 : 0;
  // Gates: step 1 opens once a transaction is loaded; the follow step opens at the last receipt.
  useEffect(() => {
    if (step === PICK) setGate(!!trace);
    if (step === FOLLOW) setGate(!!trace && reached >= last);
  }, [step, trace, reached, last, setGate]);

  /** How many hops the picture draws: none at the grid, one at the start, then as followed, all after. */
  const drawn = !trace || step <= GRID ? -1 : step === START ? 0 : step === FOLLOW ? reached : last;
  /** The hop the text and the markers talk about: the first one until the follow step. */
  const cur = step <= START ? 0 : step === FOLLOW ? Math.min(at, reached) : Math.min(at, last);

  // Picks read the latest state, not the render they were made in: while the book turns a page, the
  // previous page's figure (made at the previous step) is still on screen and can still be picked.
  const now = useRef({ step, reached, at, drawn, last });
  useLayoutEffect(() => {
    now.current = { step, reached, at, drawn, last };
  });

  const follow = () => {
    const n = now.current;
    const next = Math.min(n.last, n.reached + 1);
    setReached(next);
    setAt(next);
  };
  /** Picking a drawn slip looks at it. At the follow step, picking the newest one follows on. */
  const pick = (index: number) => {
    const n = now.current;
    if (index < 0 || index > Math.max(n.drawn, 0)) return;
    if (n.step === FOLLOW && index === n.reached && n.reached < n.last && n.at === n.reached) return follow();
    setAt(index);
  };

  const state = `${trace ? `source:${trace.source}` : "source:none"};hop:${trace ? cur + 1 : 0}/${
    trace ? trace.hops.length : 0
  }`;
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
    reached,
    last,
    drawn,
    shard,
    inspected,
    state,
    passed,
    pass: () => setPassed(true),
    choose,
    load,
    follow,
    pick,
    pickShard: (id: number) => setShard((s) => (s === id ? null : id)),
    inspect: () => setInspected(true),
    hop: trace ? trace.hops[cur]! : null,
  };
}
