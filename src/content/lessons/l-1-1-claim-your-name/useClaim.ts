/**
 * The ONE state of lesson 1.1, shared by the 2D and the 3D view. Everything on chain goes through
 * useChain(): the live availability check, the registrar call, and reading the new account back.
 * No three.js here, so the 2D view never pulls in 3D code.
 */
import { useEffect, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain, useChainMode } from "../../../chain/ChainContext";
import { createNamedAccount, implicitAccountId, inclusionBlock, totalTokensBurnt } from "../../../chain/ops";
import type { AccessKeyInfo, PhaseEvent, PracticeAccount, PublicKey, TxOutcome } from "../../../chain/types";
import { kindError, type KindError } from "../l-0-3-send-a-transaction/tx";
import { CREATE_DEPOSIT, readLabel, REGISTRAR } from "./name";

// Step numbers (0-based) from manifest.ts.
export const HOOK = 0;
export const CONCEPT = 1;
export const PICK = 2;
export const CREATE = 3;
export const COMPARE = 4;
export const CHECK = 5;
export const HONEST = 6;

export type Availability = "idle" | "checking" | "free" | "taken" | "unknown";

export interface Created {
  id: string;
  balance: bigint;
  keys: AccessKeyInfo[];
  publicKey: PublicKey;
  /** The hex id this same key would have as an implicit account. */
  hexId: string;
  txHash: string;
  block: number;
  fee: bigint;
}

export type Claim = ReturnType<typeof useClaim>;

export function useClaim({
  step,
  goTo,
  setGate,
  reducedMotion,
  setVars,
  reportEvidence,
}: Pick<SceneProps, "step" | "goTo" | "setGate" | "reducedMotion" | "setVars" | "reportEvidence">) {
  const chain = useChain();
  const { setMode } = useChainMode();
  const network = chain.network;

  const [me, setMe] = useState<PracticeAccount | null>(null);
  const [start, setStart] = useState<bigint | null>(null);
  const [text, setTextRaw] = useState("");
  const [availability, setAvailability] = useState<{ id: string; state: Availability }>({
    id: "",
    state: "idle",
  });
  const [phase, setPhase] = useState<PhaseEvent["phase"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<KindError | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [passed, setPassed] = useState(false);
  const [recheck, setRecheck] = useState(0);

  const read = readLabel(text);
  const id = read.ok ? read.id : null;

  // The practice account that pays for the new name.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const acc = await chain.practiceAccount();
        const view = await chain.viewAccount(acc.accountId);
        if (!live) return;
        setMe(acc);
        setStart(view.amount);
      } catch (e) {
        if (live) setError(kindError(e, chain.network));
      }
    })();
    return () => {
      live = false;
    };
  }, [chain]);

  // Live availability: ask the chain whether the account exists, a moment after the last keystroke.
  useEffect(() => {
    if (!id || created) {
      setAvailability({ id: "", state: "idle" });
      return;
    }
    setAvailability({ id, state: "checking" });
    let live = true;
    const timer = setTimeout(
      () => {
        chain
          .accountExists(id)
          .then((exists) => live && setAvailability({ id, state: exists ? "taken" : "free" }))
          .catch(() => live && setAvailability({ id, state: "unknown" }));
      },
      reducedMotion ? 0 : 250,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [chain, id, created, reducedMotion, recheck]);

  // Later captions use the name the learner chose.
  const shownName = created?.id ?? (id && availability.state === "free" ? id : null);
  useEffect(() => {
    setVars?.({ name: shownName ?? "your-name.testnet" });
  }, [shownName, setVars]);

  const free = !!id && availability.id === id && availability.state === "free";
  const done = [true, true, free || !!created, !!created, true, passed, !!created];
  const stepDone = done[step] ?? true;
  useEffect(() => {
    setGate(stepDone);
  }, [stepDone, setGate]);

  function setText(t: string) {
    if (created) return;
    setTextRaw(t);
  }

  async function create() {
    if (!id || !free || !me || busy || created) return;
    setBusy(true);
    setError(null);
    setPhase(null);
    try {
      const publicKey = await chain.newKeyPair();
      const out: TxOutcome = await createNamedAccount(chain, id, publicKey, CREATE_DEPOSIT, {
        pace: reducedMotion ? "instant" : "realtime",
        onPhase: (e) => setPhase(e.phase),
      });
      if (out.status.type === "Failure") {
        setError({
          title: "The registrar refused",
          detail: `${out.status.error.message} A fee may still have been charged. Pick another name.`,
        });
        return;
      }
      // The registrar's own receipt can fail after the call succeeded (for example a taken name).
      if (!(await chain.accountExists(id))) {
        setError({
          title: `${id} was not created`,
          detail:
            "The registrar did not make the account. Someone may have taken the name a moment ago. Pick another name.",
        });
        return;
      }
      const [view, keys] = await Promise.all([chain.viewAccount(id), chain.listKeys(id)]);
      setCreated({
        id,
        balance: view.amount,
        keys,
        publicKey,
        hexId: implicitAccountId(publicKey),
        txHash: out.transaction.hash,
        block: inclusionBlock(out).height,
        fee: totalTokensBurnt(out),
      });
      reportEvidence?.({ accountId: id, txHash: out.transaction.hash, mode: network });
    } catch (e) {
      setError(kindError(e, network));
    } finally {
      setBusy(false);
    }
  }

  function tryAnother() {
    setError(null);
    setRecheck((n) => n + 1);
    if (step > PICK) goTo(PICK);
  }

  function continueInDemo() {
    setMode("demo");
    if (step > PICK) goTo(PICK);
  }

  // ---------- the live feedback under the name box ----------
  let feedback: { tone: "hint" | "bad" | "good" | "wait"; text: string };
  if (!read.ok)
    feedback = read.problem
      ? { tone: "bad", text: read.problem }
      : { tone: "hint", text: "Type a name, such as ana. The app adds .testnet." };
  else if (created) feedback = { tone: "good", text: `${created.id} is yours.` };
  else if (availability.id !== read.id || availability.state === "checking")
    feedback = { tone: "wait", text: `Checking ${read.id}…` };
  else if (availability.state === "taken")
    feedback = { tone: "bad", text: `${read.id} is taken. Try another.` };
  else if (availability.state === "unknown")
    feedback = { tone: "bad", text: `Could not check ${read.id} right now. Try again in a moment.` };
  else feedback = { tone: "good", text: `${read.id} is free.` };

  let status: string | null = null;
  if (error) status = null;
  else if (step === PICK) status = free ? "That name is free. Press Next." : null;
  else if (step === CREATE)
    status = created
      ? `${created.id} exists. Press Next.`
      : busy
        ? phase === "included" || phase === "executed"
          ? "In a block. Waiting for Final…"
          : "Sent to the registrar…"
        : free
          ? null
          : "Pick a free name first (step 3).";

  const state = [
    `step:${step}`,
    `account:${start !== null ? "ready" : "loading"}`,
    `name:${availability.state}`,
    `created:${created ? "yes" : "no"}`,
    `error:${error ? "yes" : "no"}`,
    `network:${network}`,
  ].join(";");

  return {
    step,
    network,
    testnet: network === "testnet",
    me,
    start,
    text,
    setText,
    id,
    feedback,
    free,
    busy,
    phase,
    error,
    created,
    passed,
    pass: () => setPassed(true),
    create,
    tryAnother,
    continueInDemo,
    canCreate: step === CREATE && free && !busy && !created && !!me && !error,
    state,
    status,
    registrar: REGISTRAR,
  };
}
