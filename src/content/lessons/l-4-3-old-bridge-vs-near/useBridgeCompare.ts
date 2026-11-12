/**
 * The ONE state of lesson 4.3, shared by the 2D and the 3D view: the intent quote (recorded in demo mode,
 * a live dry quote in testnet mode), the side-by-side playback of the two timelines, the inspected asset
 * backing, the simulated vault exploit and the confidential shield. 1Click is reached only through
 * src/chain/intents.ts. No three.js here.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChainMode } from "../../../chain/ChainContext";
import { dryQuoteBody, RECORDED_QUOTE, requestQuote, type IntentQuote } from "../../../chain/intents";
import {
  EXPLOIT_AT,
  exploitDone,
  intentTotal,
  pickResult,
  PLAY_TICK_MS,
  PLAY_TICKS,
  type ExploitPhase,
  type Obj,
  type PickResult,
} from "./compare";
import { BACKING, COMPARE, CONFIDENTIAL, EXPLOIT, HONEST } from "./steps";

export * from "./steps";

export type BridgeCompare = ReturnType<typeof useBridgeCompare>;

/** The Worker's address, if the app was built with one (the 1Click key stays there). */
const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) || undefined;

export function useBridgeCompare({
  step,
  setGate,
  setVars,
  reportEvidence,
  reducedMotion,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reportEvidence" | "reducedMotion">) {
  // 1Click needs no NEAR account: a live quote follows the mode the learner asked for.
  const wantsLive = useChainMode().requested === "testnet";
  const [quote, setQuote] = useState<IntentQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [played, setPlayed] = useState(0);
  const [inspected, setInspected] = useState(false);
  const [exploit, setExploit] = useState<ExploitPhase>("idle");
  const [shielded, setShielded] = useState(false);
  const [picked, setPicked] = useState<{ what: Obj; result: PickResult; n: number } | null>(null);
  const [passed, setPassed] = useState(false);
  const timers = useRef<number[]>([]);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    const pending = timers.current;
    return () => {
      live.current = false;
      pending.forEach(clearTimeout);
    };
  }, []);

  const later = (ms: number, f: () => void) =>
    timers.current.push(window.setTimeout(() => live.current && f(), ms));

  /** The intent's quote. Demo: the recorded one. Testnet mode: a live dry quote, recorded on failure. */
  const getQuote = async (): Promise<IntentQuote> => {
    if (!wantsLive) return RECORDED_QUOTE;
    try {
      return await requestQuote(dryQuoteBody(new Date()), { workerUrl: WORKER_URL });
    } catch (e) {
      if (live.current) setNotice(`${(e as Error).message} Showing a recorded quote instead.`);
      return RECORDED_QUOTE;
    }
  };

  /** Step 2: get the quote, then play both timelines tick by tick (all at once under reduced motion). */
  const compare = async (instant = false) => {
    if (loading || played > 0) return;
    setLoading(true);
    const q = quote ?? (await getQuote());
    if (!live.current) return;
    setQuote(q);
    setLoading(false);
    if (reducedMotion || instant) return setPlayed(PLAY_TICKS);
    for (let t = 1; t <= PLAY_TICKS; t++) later(t * PLAY_TICK_MS - PLAY_TICK_MS / 2, () => setPlayed(t));
  };

  const inspect = () => setInspected(true);

  /** Step 4: the simulated exploit, a timed sequence (all at once under reduced motion). Nothing is sent. */
  const triggerExploit = () => {
    if (exploit !== "idle") return;
    if (reducedMotion) return setExploit("done");
    for (const [phase, ms] of Object.entries(EXPLOIT_AT) as [ExploitPhase, number][])
      later(ms, () => setExploit(phase));
  };

  const shield = () => setShielded(true);

  // Opened at a later step (a link, a reload): do the earlier, offline steps so the page is not empty.
  useEffect(() => {
    if (step > COMPARE && played === 0 && !loading) void compare(true);
    if (step > BACKING && !inspected) setInspected(true);
    if (step > EXPLOIT && exploit === "idle") setExploit("done");
    if (step > CONFIDENTIAL && !shielded) setShielded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const played_all = played >= PLAY_TICKS;
  const exploited = exploitDone(exploit);

  // Gates.
  useEffect(() => {
    if (step === COMPARE) setGate(played_all);
    if (step === BACKING) setGate(inspected);
    if (step === EXPLOIT) setGate(exploited);
    if (step === CONFIDENTIAL) setGate(shielded);
    if (step === HONEST) setGate(exploited);
  }, [step, played_all, inspected, exploited, shielded, setGate]);

  // The learner's own numbers in later text.
  useEffect(() => {
    if (quote) setVars?.({ intentTime: intentTotal(quote).time.text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote]);

  // The completion record (4.3.md step 4's evidence, plus where the intent's numbers came from).
  useEffect(() => {
    if (!quote) return;
    const t = intentTotal(quote);
    reportEvidence?.({
      bridgeSteps: "6",
      intentSteps: "2",
      intentTime: t.time.text,
      intentFee: t.fee.text,
      quoteSource: quote.source,
      exploitSimulated: String(exploited),
      protectedByNativeDelivery: String(exploited),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, exploited]);

  // Picks read the latest state: during a page turn the old page's objects can still be picked.
  const latest = useRef({ step, played, inspected, exploit, shielded });
  useLayoutEffect(() => {
    latest.current = { step, played, inspected, exploit, shielded };
  });

  /** Picking an object does the step's action when it is the step's object, or shows a detail or hint. */
  const pick = (what: Obj) => {
    const result = pickResult(what, latest.current);
    setPicked((p) => ({ what, result, n: (p?.n ?? 0) + 1 }));
    if (result.act === "compare") void compare();
    if (result.act === "inspect") inspect();
    if (result.act === "exploit") triggerExploit();
    if (result.act === "shield") shield();
  };

  const state = [
    `quote:${quote ? quote.source : loading ? "loading" : "none"}`,
    `played:${played}`,
    `inspected:${inspected ? "yes" : "no"}`,
    `exploit:${exploit}`,
    `shield:${shielded ? "on" : "off"}`,
  ].join(";");

  return {
    step,
    quote,
    loading,
    notice,
    played,
    playedAll: played_all,
    compare,
    inspected,
    inspect,
    exploit,
    exploited,
    triggerExploit,
    shielded,
    shield,
    picked,
    pick,
    passed,
    pass: () => setPassed(true),
    state,
  };
}
