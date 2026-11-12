/**
 * The ONE state of lesson 2.2, shared by the 2D and the 3D view. Everything on chain goes through
 * useChain(). Demo mode sends a real DemoChain transaction to the buyer contract, which calls the shop
 * on another shard. Testnet mode opens a recorded real testnet call (recorded.ts) and illustrates the
 * failure on it, marked as such. It sends nothing there, on purpose: the lesson stays free and fast.
 * No three.js here, so 2D never loads 3D code.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { DEMO_BUYER } from "../../../chain/demo/shop";
import { isChainError } from "../../../chain/errors";
import { callMethod } from "../../../chain/ops";
import { tgas } from "../../../chain/units";
import { callFromOutcome, contractHops, illustrateFailure, varsFor, type CrossCall } from "./call";
import { RECORDED } from "./recorded";
import { FAIL, GAS, HOOK, HOP, ORDER, ORDER_COPY, orderButton } from "./steps";

export * from "./steps";

/** Gas the learner attaches to the order (script: 30 Tgas, about 0.003 NEAR). */
export const ORDER_GAS = tgas(30);
/** One revealed hop per block (~600 ms in demo mode). */
const HOP_MS = 600;

export type CallState = ReturnType<typeof useCrossCall>;
type Busy = null | "order" | "fail";

export function useCrossCall({
  step,
  setGate,
  setVars,
  reducedMotion,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reducedMotion" | "reportEvidence">) {
  const chain = useChain();
  const network = chain.network;
  const [call, setCall] = useState<CrossCall | null>(null);
  const [failure, setFailure] = useState<CrossCall | null>(null);
  /** How many contract receipts of the drawn call are revealed so far (they hop one block at a time). */
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspected, setInspected] = useState(false);
  /** A receipt the learner picked: its detail shows. Index into contractHops. */
  const [picked, setPicked] = useState<number | null>(null);
  /** A one-line answer to the last pick: a "not yet" hint or a detail. */
  const [hint, setHint] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);

  /** The call the figure draws: the failed one at the failure step, the order everywhere else. */
  const drawn = step === FAIL ? failure : call;
  const hops = drawn ? contractHops(drawn) : [];
  const revealed = drawn ? Math.min(shown, hops.length) : 0;
  const complete = !!drawn && revealed >= hops.length;

  // Reveal the receipts one block at a time; at once under reduced motion.
  useEffect(() => {
    if (!drawn) return;
    if (reducedMotion) {
      setShown(hops.length);
      return;
    }
    if (shown >= hops.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), HOP_MS);
    return () => clearTimeout(t);
  }, [drawn, shown, hops.length, reducedMotion]);

  // A new step shows its call whole (only the step that sends it plays the hops).
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    setPicked(null);
    setHint(null);
    setShown(99);
  }, [step]);

  const pace = reducedMotion ? "instant" : "realtime";
  const send = async (outOfStock: boolean, instant = false): Promise<CrossCall> => {
    if (network !== "demo") return outOfStock ? illustrateFailure(RECORDED) : RECORDED;
    const out = await callMethod(
      chain,
      DEMO_BUYER,
      "order",
      { item: "notebook", out_of_stock: outOfStock },
      { gas: ORDER_GAS, pace: instant ? "instant" : pace },
    );
    return callFromOutcome(out, "demo");
  };

  const busyRef = useRef<Busy>(null);
  const run = async (what: "order" | "fail", instant = false) => {
    if (busyRef.current) return;
    busyRef.current = what;
    setBusy(what);
    setError(null);
    setHint(null);
    try {
      const c = await send(what === "fail", instant);
      // Play the hops only while the learner is still on the step that sent it; after a page turn
      // mid-flight the new step shows the call whole, so the hops do not replay there.
      const still = now.current.step === (what === "order" ? ORDER : FAIL);
      setShown(instant || !still ? 99 : 0);
      if (what === "order") setCall(c);
      else setFailure(c);
    } catch (e) {
      setError(isChainError(e) ? e.message : "The call did not go through. Please try again in a moment.");
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  };
  const order = () => void (call ? undefined : run("order"));
  const fail = () => void (failure ? undefined : run("fail"));

  // Step 3's words follow the mode: testnet mode opens a recorded call, it does not send an order.
  useEffect(() => {
    if (network !== "demo") setVars?.({ ...ORDER_COPY.testnet });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  // The learner's own numbers in later text; the completion record points at the transaction.
  useEffect(() => {
    if (!call) return;
    setVars?.(varsFor(call));
    reportEvidence?.({
      txHash: call.txHash,
      receiptHops: String(call.receiptHops),
      source: call.source,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call]);

  // Opened past the order with nothing sent (a link to a later step, or a reload): send it, instantly.
  // The script gates the honest take "until the learner ordered". Walking the lesson, that holds: the
  // order step's gate opens only after the learner's own order. A deep link skips the walk on purpose
  // (reviewers and reloads land on any step, as in lesson 2.1), so the order is sent for them here. The
  // gate's point, that Finish records a real call's evidence, still holds: this is a real call.
  useEffect(() => {
    if (step > ORDER && !call && !busy && !error) void run("order", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, call, busy, error]);

  // Gates: the order and the failure open once their callback has run; the gas step once inspected.
  useEffect(() => {
    if (step === ORDER) setGate(!!call && step === ORDER && complete);
    if (step === GAS) setGate(inspected);
    if (step === FAIL) setGate(!!failure && complete);
  }, [step, call, failure, complete, inspected, setGate]);

  // Picks read the latest state, not the render they were made in (a page turn still shows the old one).
  const now = useRef({ step, call, failure, complete });
  useLayoutEffect(() => {
    now.current = { step, call, failure, complete };
  });

  const { notYet } = orderButton(network);

  /**
   * What every pick does first: run the step's action when it has not run ("acted"), and open the gas
   * split on the gas step. Otherwise returns the call to show a detail of (null: nothing sent yet).
   */
  const pickFirst = (): "acted" | CrossCall | null => {
    const n = now.current;
    if (n.step === ORDER && !n.call) {
      order();
      return "acted";
    }
    if (n.step === FAIL && !n.failure) {
      fail();
      return "acted";
    }
    if (n.step === GAS) setInspected(true);
    return n.step === FAIL ? n.failure : n.call;
  };

  /** Picking a contract scroll: runs the step's action, or shows what that contract did. */
  const pickContract = (which: "caller" | "callee") => {
    const c = pickFirst();
    if (c === "acted") return;
    if (!c) {
      setHint(
        which === "callee"
          ? notYet
          : "Contract A, the caller. It runs first, then waits for the answer in a callback.",
      );
      return;
    }
    const list = contractHops(c);
    const i = which === "caller" ? list.length - 1 : list.findIndex((h) => h.to === c.callee);
    setPicked(i);
    setHint(detailOf(c, i));
  };

  /** Picking a receipt slip: sends the order when there is none yet, else shows that receipt. */
  const pickHop = (i: number) => {
    const c = pickFirst();
    if (c === "acted") return;
    if (!c || (now.current.step <= HOP && !now.current.call)) {
      setHint(notYet);
      return;
    }
    setPicked(i);
    setHint(detailOf(c, i));
  };

  const pickMeter = () => {
    if (now.current.call) setInspected(true);
    else setHint("Not yet: run a contract call first.");
  };

  const state = [
    `order:${call ? (complete || step !== ORDER ? "done" : "hopping") : busy === "order" ? "sending" : "none"}`,
    `hops:${revealed}/${hops.length}`,
    `gas:${inspected ? "open" : "closed"}`,
    `fail:${failure ? (step === FAIL && !complete ? "hopping" : "done") : busy === "fail" ? "sending" : "none"}`,
    `source:${drawn?.source ?? call?.source ?? "none"}`,
  ].join(";");

  return {
    step,
    network,
    call,
    failure,
    drawn,
    hops,
    revealed,
    complete,
    busy,
    error,
    inspected,
    picked,
    hint,
    passed,
    state,
    pass: () => setPassed(true),
    order,
    fail,
    inspect: () => {
      if (now.current.call) setInspected(true);
    },
    pickContract,
    pickHop,
    pickMeter,
    /** The figure at the hook has nothing sent yet. */
    idle: step === HOOK,
  };
}

/** One line on what a receipt did, for the detail after a pick. */
export function detailOf(c: CrossCall, i: number): string {
  const h = contractHops(c)[i];
  if (!h) return "";
  const what =
    h.kind === "callback" ? "Callback" : i === 0 ? "Action receipt from the transaction" : "Action receipt";
  return `${what}: ${h.method ?? "receipt"} on ${h.to}, block #${h.blockHeight.toLocaleString("en-US")}, shard ${h.shardId}. ${h.ok ? "" : "Failed. "}${h.note}`;
}
