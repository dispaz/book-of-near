/**
 * The ONE state of lesson 4.2, shared by the 2D and the 3D view: the quote (recorded in demo mode, a
 * live dry quote in testnet mode), the inspected breakdown, the solver's fill and how the learner
 * finishes (on the dry quote, or an optional tiny real swap through the mainnet wallet seam). 1Click is
 * reached only through src/chain/intents.ts. No three.js here.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain, useChainMode } from "../../../chain/ChainContext";
import {
  dryQuoteBody,
  RECORDED_QUOTE,
  REAL_SWAP_AMOUNT,
  realQuoteBody,
  requestQuote,
  runTinySwap,
  swapOffer,
  type IntentQuote,
  type TinySwapOutcome,
} from "../../../chain/intents";
import { useMainnetWallet } from "../../../chain/mainnet";
import { FILL_AT, pickResult, type FillPhase, type Obj, type PickResult } from "./swap";
import { DECLARE, FILL, FINISH, INSPECT } from "./steps";

export * from "./steps";

export type IntentSwap = ReturnType<typeof useIntentSwap>;
export type Finish = "dry" | "real" | null;
export type RealSwap =
  { status: "idle" } | { status: "working" } | { status: "ended"; outcome: TinySwapOutcome; real: boolean };

/** The Worker's address, if the app was built with one (the 1Click key stays there). */
const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) || undefined;
/** Demo mode's quote "arrives" after this long, so the parcel is seen leaving. */
const DEMO_QUOTE_MS = 700;

/** The demo wallet's simulated quote for the tiny swap: the recorded rate, scaled to 0.1 NEAR. No network. */
const SIMULATED_TINY_QUOTE: IntentQuote = {
  ...RECORDED_QUOTE,
  amountIn: REAL_SWAP_AMOUNT.toString(),
  amountInFormatted: "0.1",
  amountInUsd: 0.41,
  amountOut: "405400",
  amountOutFormatted: "0.4054",
  amountOutUsd: 0.41,
  minAmountOut: "401346",
  minAmountOutFormatted: "0.4013",
  depositAddress: "demo-deposit-address.near",
};

export function useIntentSwap({
  step,
  setGate,
  setVars,
  reportEvidence,
  reducedMotion,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reportEvidence" | "reducedMotion">) {
  const chain = useChain();
  const network = chain.network;
  // 1Click needs no NEAR account, so a live quote follows the mode the learner asked for, even when the
  // testnet practice account fell back to demo mode.
  const wantsLive = useChainMode().requested === "testnet";
  const wallet = useMainnetWallet();
  const [quote, setQuote] = useState<IntentQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [inspected, setInspected] = useState(false);
  const [fill, setFill] = useState<FillPhase>("idle");
  const [finish, setFinish] = useState<Finish>(null);
  const [realSwap, setRealSwap] = useState<RealSwap>({ status: "idle" });
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

  /** Step 2: ask for the quote. Demo: the recorded one. Testnet mode: a live dry quote, recorded on failure. */
  const fetchQuote = async () => {
    if (loading || quote) return;
    setLoading(true);
    setNotice(null);
    try {
      if (!wantsLive) {
        if (!reducedMotion) await new Promise((r) => setTimeout(r, DEMO_QUOTE_MS));
        if (live.current) setQuote(RECORDED_QUOTE);
        return;
      }
      const q = await requestQuote(dryQuoteBody(new Date()), { workerUrl: WORKER_URL });
      if (live.current) setQuote(q);
    } catch (e) {
      if (!live.current) return;
      setNotice(`${(e as Error).message} Showing a recorded quote instead, so you can carry on.`);
      setQuote(RECORDED_QUOTE);
    } finally {
      if (live.current) setLoading(false);
    }
  };

  const inspect = () => {
    if (quote) setInspected(true);
  };

  /** Step 4: the solver's fill, a timed sequence (all at once under reduced motion). Nothing is sent. */
  const simulate = () => {
    if (!quote || fill !== "idle") return;
    if (reducedMotion) return setFill("done");
    for (const [phase, ms] of Object.entries(FILL_AT) as [FillPhase, number][])
      timers.current.push(window.setTimeout(() => live.current && setFill(phase), ms));
  };

  const finishDry = () => setFinish("dry");

  /** Step 5's optional swap. Real only with the learner's own wallet; the demo wallet simulates it. */
  const swapForReal = async () => {
    if (realSwap.status === "working") return;
    const real = wallet.usingReal;
    setFinish("real");
    setRealSwap({ status: "working" });
    const outcome = await runTinySwap({
      wallet: wallet.state,
      quote: real
        ? (amount, accountId) =>
            requestQuote(realQuoteBody(accountId, new Date(), amount), { workerUrl: WORKER_URL })
        : async () => SIMULATED_TINY_QUOTE,
      sign: wallet.sign,
    });
    if (live.current) setRealSwap({ status: "ended", outcome, real });
  };

  // Opened at a later step (a link, a reload): do the free, offline steps so the page is not empty.
  useEffect(() => {
    if (step > DECLARE && !quote && !loading) void fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, quote, loading]);
  useEffect(() => {
    if (step > INSPECT && quote && !inspected) setInspected(true);
    if (step > FILL && quote && fill === "idle") setFill("done");
  }, [step, quote, inspected, fill]);

  const swapDone = realSwap.status === "ended" && realSwap.outcome.kind === "done";
  const realSwapExecuted = swapDone && realSwap.status === "ended" && realSwap.real;
  const finished = finish === "dry" || swapDone;

  // Gates.
  useEffect(() => {
    if (step === DECLARE) setGate(!!quote);
    if (step === INSPECT) setGate(inspected);
    if (step === FILL) setGate(fill === "done");
    if (step === FINISH) setGate(finished);
  }, [step, quote, inspected, fill, finished, setGate]);

  // The learner's own numbers in later text.
  useEffect(() => {
    if (quote) setVars?.({ usdcOutput: quote.amountOutFormatted, timeEstimate: String(quote.timeEstimate) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote]);

  // The completion record: the quote, and whether a real swap happened (for the final badge's rarity).
  useEffect(() => {
    if (!quote) return;
    const ev: Record<string, string> = {
      mode: network,
      originAsset: "NEAR",
      destinationAsset: "USDC (Arbitrum)",
      amountIn: quote.amountInFormatted,
      amountOut: quote.amountOutFormatted,
      minAmountOut: quote.minAmountOutFormatted,
      estimatedSeconds: String(quote.timeEstimate),
      quoteSource: quote.source,
      quoteSignature: quote.signature,
      dryQuoteVerified: "true",
      realSwapExecuted: String(realSwapExecuted),
    };
    if (finish) ev.finishedOn = finish === "dry" ? "dry-run quote" : "tiny swap";
    if (realSwap.status === "ended" && realSwap.outcome.kind === "done") {
      ev.realSwapTxHash = realSwap.outcome.txHash;
      if (!realSwap.real) ev.simulatedSwap = "true (demo wallet, no real money)";
    }
    reportEvidence?.(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, finish, realSwap]);

  // Picks read the latest state: during a page turn the old page's objects can still be picked.
  const latest = useRef({ step, quote, inspected, fill });
  useLayoutEffect(() => {
    latest.current = { step, quote, inspected, fill };
  });

  /** Picking an object does the step's action when it is the step's object, or shows a detail or hint. */
  const pick = (what: Obj) => {
    const result = pickResult(what, latest.current);
    setPicked((p) => ({ what, result, n: (p?.n ?? 0) + 1 }));
    if (result.act === "quote") void fetchQuote();
    if (result.act === "inspect") inspect();
    if (result.act === "fill") simulate();
  };

  const offer = swapOffer(wallet.state);
  const state = [
    `quote:${quote ? quote.source : loading ? "loading" : "none"}`,
    `inspected:${inspected ? "yes" : "no"}`,
    `fill:${fill}`,
    `finish:${finished ? finish : "none"}`,
    `real:${realSwapExecuted ? "yes" : "no"}`,
  ].join(";");

  return {
    step,
    network,
    quote,
    loading,
    notice,
    fetchQuote,
    inspected,
    inspect,
    fill,
    simulate,
    finish,
    finished,
    finishDry,
    offer,
    realSwap,
    realSwapExecuted,
    swapForReal,
    usingRealWallet: wallet.usingReal,
    picked,
    pick,
    passed,
    pass: () => setPassed(true),
    state,
  };
}
