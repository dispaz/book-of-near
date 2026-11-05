/**
 * The ONE state of lesson 0.3, shared by the 2D and the 3D view. Everything on chain goes through
 * useChain(); the pipeline only moves on the chain's real phase events. No three.js here, so the 2D
 * view never pulls in 3D code.
 */
import { useEffect, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain, useChainMode } from "../../../chain/ChainContext";
import { actions } from "../../../chain/ops";
import type {
  PhaseEvent,
  PracticeAccount,
  SignedTransaction,
  TxOutcome,
  TxPhase,
  UnsignedTransaction,
} from "../../../chain/types";
import { DEFAULT_AMOUNT, duration, kindError, readAmount, senderBalance, type KindError } from "./tx";

// Step numbers (0-based) from manifest.ts.
export const ACCOUNT = 0;
export const BUILD = 1;
export const FEE = 2;
export const SIGN = 3;
export const SEND = 4;
export const INCLUDED = 5;
export const FINAL = 6;
export const EXPLORER = 7;
export const CHECK = 8;
export const HONEST = 9;

export type Light = "built" | "signed" | "broadcast" | "included" | "final";
export const LIGHTS: { phase: Light; label: string }[] = [
  { phase: "built", label: "Build" },
  { phase: "signed", label: "Sign" },
  { phase: "broadcast", label: "Broadcast" },
  { phase: "included", label: "Included" },
  { phase: "final", label: "Final" },
];

export type BalanceStage = "before" | "included" | "final";
export type Tx = ReturnType<typeof useTransaction>;

function readAmountOr(text: string): bigint | null {
  const r = readAmount(text);
  return r.ok ? r.amount : null;
}

export function useTransaction({
  step,
  goTo,
  setGate,
  reducedMotion,
  reportEvidence,
  switched,
}: Pick<SceneProps, "step" | "goTo" | "setGate" | "reducedMotion" | "reportEvidence"> & {
  switched: boolean;
}) {
  const chain = useChain();
  const { setMode } = useChainMode();
  const network = chain.network;
  const testnet = network === "testnet";

  const [me, setMe] = useState<PracticeAccount | null>(null);
  const [start, setStart] = useState<bigint | null>(null);
  const [receiver, setReceiver] = useState<string | null>(null);
  const [receiverStart, setReceiverStart] = useState<bigint | null>(null);
  const [amountText, setAmountTextRaw] = useState(DEFAULT_AMOUNT);
  const [amountProblem, setAmountProblem] = useState<string | null>(null);
  const [amount, setAmount] = useState<bigint | null>(null);
  const [built, setBuilt] = useState<UnsignedTransaction | null>(null);
  const [feeSeen, setFeeSeen] = useState(false);
  const [signed, setSigned] = useState<SignedTransaction | null>(null);
  const [events, setEvents] = useState<Partial<Record<TxPhase, PhaseEvent>>>({});
  const [outcome, setOutcome] = useState<TxOutcome | null>(null);
  const [finalBalance, setFinalBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<null | "build" | "sign" | "send">(null);
  const [error, setError] = useState<KindError | null>(null);
  const [explored, setExplored] = useState(false);
  const [passed, setPassed] = useState(false);

  // The practice account and the receiver, read through the Chain interface.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const acc = await chain.practiceAccount();
        const to = await chain.returnAccount();
        const [mine, theirs] = await Promise.all([
          chain.viewAccount(acc.accountId),
          to === acc.accountId ? null : chain.viewAccount(to).catch(() => null),
        ]);
        if (!live) return;
        setMe(acc);
        setStart(mine.amount);
        setReceiver(to);
        setReceiverStart(theirs?.amount ?? null);
      } catch (e) {
        if (live) setError(kindError(e, chain.network));
      }
    })();
    return () => {
      live = false;
    };
  }, [chain]);

  const sent = !!outcome && outcome.status.type !== "Failure";
  const done = [
    start !== null,
    !!built,
    feeSeen,
    !!signed,
    !!events.included,
    !!events.final,
    !!events.final,
    explored,
    passed,
    sent,
  ];
  const stepDone = done[step] ?? false;
  useEffect(() => {
    setGate(stepDone);
  }, [stepDone, setGate]);

  async function build() {
    const r = readAmount(amountText);
    if (!r.ok) {
      setAmountProblem(r.problem);
      return;
    }
    if (!me || !receiver || built || busy) return;
    setBusy("build");
    setError(null);
    try {
      const tx = await chain.buildTransaction({
        signerId: me.accountId,
        receiverId: receiver,
        actions: [actions.transfer(r.amount)],
      });
      setAmount(r.amount);
      setBuilt(tx);
    } catch (e) {
      setError(kindError(e, network));
    } finally {
      setBusy(null);
    }
  }

  async function sign() {
    if (!built || signed || busy) return;
    setBusy("sign");
    setError(null);
    try {
      setSigned(await chain.signTransaction(built));
    } catch (e) {
      setError(kindError(e, network));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!signed || !me || events.broadcast || busy || error) return;
    setBusy("send");
    setError(null);
    setEvents({});
    try {
      const out = await chain.sendSignedTransaction(signed, {
        pace: reducedMotion ? "instant" : "realtime",
        onPhase: (e) => {
          // Build and sign happened earlier, at the learner's pace.
          if (e.phase === "built" || e.phase === "signed") return;
          setEvents((prev) => ({ ...prev, [e.phase]: e }));
        },
      });
      setOutcome(out);
      if (out.status.type === "Failure") {
        setError({
          title: "The transfer ran but failed",
          detail: `${out.status.error.message} The fee was still paid. Build a new transaction to try again.`,
        });
        return;
      }
      // includedMs and finalMs (stopwatch since Send) let lesson 2.1 say where those seconds went.
      reportEvidence?.({
        txHash: out.transaction.hash,
        mode: network,
        includedMs: String(Math.round(out.timings.included)),
        finalMs: String(Math.round(out.timings.final)),
      });
      setFinalBalance((await chain.viewAccount(me.accountId)).amount);
    } catch (e) {
      setError(kindError(e, network));
    } finally {
      setBusy(null);
    }
  }

  /** Throw the transaction away and build a new one (after an error, e.g. a too-large amount). */
  function startOver() {
    setBuilt(null);
    setSigned(null);
    setEvents({});
    setOutcome(null);
    setFinalBalance(null);
    setError(null);
    if (step > BUILD) goTo(BUILD);
  }

  function continueInDemo() {
    setMode("demo");
    if (step > BUILD) goTo(BUILD);
  }

  function setAmountText(t: string) {
    setAmountTextRaw(t);
    setAmountProblem(null);
  }

  // ---------- what the pipeline shows ----------
  const lit: Record<Light, boolean> = {
    built: !!built,
    signed: !!signed,
    broadcast: !!events.broadcast,
    included: !!events.included,
    final: !!events.final,
  };
  const litCount = LIGHTS.filter((l) => lit[l.phase]).length;
  const failedAt = error && busy === null && signed && !events.final ? LIGHTS[litCount]?.phase : undefined;
  const node = events.included?.node ?? events.broadcast?.node;
  const nodeName =
    node ?? (testnet ? "a public testnet RPC node" : "a demo node (simulated in your browser)");

  const stage: BalanceStage =
    events.final && finalBalance !== null ? "final" : events.included ? "included" : "before";
  const selfSend = !!me && receiver === me.accountId;
  const senderNow =
    start !== null && amount !== null
      ? senderBalance(start, amount, stage, finalBalance ?? undefined)
      : start;
  const receiverNow =
    receiverStart !== null && amount !== null && events.included ? receiverStart + amount : receiverStart;
  const refund =
    start !== null && amount !== null && finalBalance !== null
      ? finalBalance - senderBalance(start, amount, "included")
      : null;
  /** The amount on screen: the built one, or what the learner is typing (when it is valid). */
  const shownAmount = amount ?? readAmountOr(amountText);

  const state = [
    `step:${step}`,
    `account:${start !== null ? "ready" : "loading"}`,
    `lit:${
      LIGHTS.filter((l) => lit[l.phase])
        .map((l) => l.phase)
        .join(",") || "none"
    }`,
    `error:${error ? "yes" : "no"}`,
    `network:${network}`,
  ].join(";");

  // ---------- the status line ----------
  let status: string | null = null;
  if (error) status = null;
  else if (switched && !built && step <= BUILD && step > ACCOUNT)
    status = "You are in demo mode now. Build the transaction again; nothing goes to a real network.";
  else if (step === ACCOUNT)
    status =
      start === null
        ? testnet
          ? "Opening your testnet practice account…"
          : "Opening your practice account…"
        : "Your account is ready. Press Next.";
  else if (step === BUILD)
    status = built ? "Built. The Build light is on." : "Check the amount, then press Build.";
  else if (step === FEE) status = feeSeen ? "Fee noted. Next: sign it." : null;
  else if (step === SIGN && !built) status = "Build the transaction first (step 2).";
  else if (step === SIGN) status = signed ? "Signed on your device. No network was used." : "Press Sign.";
  else if (step === SEND && !signed) status = "Sign the transaction first (step 4).";
  else if (step === SEND)
    status =
      busy === "send" && !events.broadcast
        ? "Sending…"
        : events.final
          ? `Final, ${duration(events.final.atMs)} after Send. Press Next to look at each stage.`
          : events.included
            ? "In a block. Waiting for Final…"
            : events.broadcast
              ? "The RPC node has it. Waiting for a validator to put it in a block…"
              : "Press Send.";
  else if ((step === INCLUDED || step === FINAL) && !signed) status = "Send the transaction first (step 5).";
  else if (step === INCLUDED)
    status = events.final
      ? "Now it is final too. Press Next."
      : events.included
        ? "Waiting for Final…"
        : "Waiting for a block…";
  else if (step === EXPLORER && !sent) status = "Send the transaction first (step 5).";

  return {
    step,
    network,
    testnet,
    me,
    start,
    receiver,
    amountText,
    amountProblem,
    amount,
    shownAmount,
    built,
    feeSeen,
    signed,
    events,
    outcome,
    finalBalance,
    busy,
    error,
    explored,
    passed,
    sent,
    lit,
    litCount,
    failedAt,
    nodeName,
    stage,
    selfSend,
    senderNow,
    receiverNow,
    refund,
    state,
    status,
    /** Actions the learner can take right now (same in both views). */
    canBuild: step === BUILD && !built && busy === null && !!me && !!receiver,
    canSign: step === SIGN && !!built && !signed && busy === null,
    canSend: step === SEND && !!signed && !events.broadcast && busy === null && !error,
    build,
    sign,
    send,
    startOver,
    continueInDemo,
    setAmountText,
    seeFee: () => setFeeSeen(true),
    explore: () => setExplored(true),
    pass: () => setPassed(true),
  };
}
