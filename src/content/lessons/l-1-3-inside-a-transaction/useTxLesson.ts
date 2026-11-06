/**
 * The ONE state of lesson 1.3, shared by the 2D and the 3D view. Everything on chain goes through
 * useChain(): the workshop account (through the registrar), the batch (build → sign → send, so the signed
 * transaction can be sent again unchanged), and the read-backs. No three.js here, so 2D never loads 3D code.
 */
import { useEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { isChainError } from "../../../chain/errors";
import { createNamedAccount } from "../../../chain/ops";
import type {
  InvalidTxReason,
  PracticeAccount,
  SignedTransaction,
  TxOutcome,
  TxPhase,
} from "../../../chain/types";
import {
  DEFAULT_AMOUNT_TEXT,
  DEFAULT_LABEL,
  WORKSHOP_DEPOSIT,
  fates,
  hasAllKinds,
  keysNeeded,
  move,
  near,
  readAmount,
  readLabel,
  toActions,
  workshopLabel,
  type Fate,
  type Item,
  type ItemKind,
} from "./batch";

// Step numbers (0-based) from manifest.ts.
export const HOOK = 0;
export const OPEN = 1;
export const BUILD = 2;
export const BREAK = 3;
export const REPLAY = 4;
export const CHECK = 5;
export const HONEST = 6;

export type Lesson = ReturnType<typeof useTxLesson>;

/** A batch the learner sent, with what the chain said and what is left afterwards. */
export interface Sent {
  n: number;
  /** The step it was sent at: only a failure sent at step 4 or later opens step 4's gate. */
  at: number;
  signed: SignedTransaction;
  items: Item[];
  label: string;
  receiver: string;
  amount: bigint;
  ok: boolean;
  fates: Fate[];
  /** The chain's message for the failing action. */
  failure: string | null;
  existedBefore: boolean;
  existsAfter: boolean;
  /** The workshop account's balance before and after: the difference is what the batch cost. */
  before: bigint;
  after: bigint;
  /** The receiver's balance after, when it exists. */
  receiverBalance: bigint | null;
}

export interface Replay {
  n: number;
  which: "worked" | "failed";
  /** Set when the network refused it (the expected case). */
  reason: InvalidTxReason | null;
  message: string;
  txNonce: bigint;
  keyNonce: bigint | null;
}

export interface Workshop {
  id: string;
  outcome: TxOutcome;
}

const WORKSHOP_TRIES = 6;
const initialItems: Item[] = [];

export function useTxLesson({
  step,
  setGate,
  setVars,
  reducedMotion,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reducedMotion" | "reportEvidence">) {
  const chain = useChain();
  const pace = reducedMotion ? "instant" : "realtime";

  const [me, setMe] = useState<PracticeAccount | null>(null);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [workshopBalance, setWorkshopBalance] = useState<bigint | null>(null);
  const [label, setLabelRaw] = useState(DEFAULT_LABEL);
  const [amountText, setAmountTextRaw] = useState(DEFAULT_AMOUNT_TEXT);
  const [items, setItems] = useState<Item[]>(initialItems);
  const nextId = useRef(1);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [busy, setBusy] = useState<null | "workshop" | "send" | "replay">(null);
  const [phase, setPhase] = useState<TxPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const prefilled = useRef(false);

  // The practice account, through the Chain interface.
  useEffect(() => {
    let live = true;
    chain
      .practiceAccount()
      .then((acc) => live && setMe(acc))
      .catch((e) => live && setError(message(e)));
    return () => {
      live = false;
    };
  }, [chain]);

  const worked = sent.find((s) => s.ok && hasAllKinds(s.items)) ?? null;
  const broke = sent.find((s) => !s.ok && s.at >= BREAK && s.existsAfter === s.existedBefore) ?? null;
  const lastFailed = [...sent].reverse().find((s) => !s.ok) ?? null;
  const last = sent[sent.length - 1] ?? null;
  const refused = replays.filter((r) => r.reason !== null);

  const done = [true, !!workshop, !!worked, !!broke, refused.length > 0, passed, true];
  const stepDone = done[step] ?? true;
  useEffect(() => {
    setGate(stepDone);
  }, [stepDone, setGate]);

  // Step 4 starts from the batch that worked, under a new name, with the same key added twice.
  useEffect(() => {
    if (step !== BREAK || !worked || prefilled.current) return;
    prefilled.current = true;
    if (label.trim().toLowerCase() === worked.label) setLabelRaw(`${worked.label}2`);
    setItems(() => {
      const base = worked.items.map((i) => ({ id: nextId.current++, kind: i.kind }));
      return base.some((i) => i.kind === "again")
        ? base
        : [...base, { id: nextId.current++, kind: "again" as const }];
    });
  }, [step, worked, label]);

  const parent = workshop?.id ?? null;
  const readName = parent ? readLabel(label, parent) : null;
  const typedAmount = readAmount(amountText);

  // The learner's own values, used in later text.
  const varsRef = useRef(setVars);
  varsRef.current = setVars;
  const parentVar = parent ?? undefined;
  const subVar = worked?.receiver ?? (readName?.ok ? readName.id : undefined);
  const failVar =
    broke?.receiver ??
    (step >= BREAK && readName?.ok
      ? readName.id
      : parent && worked
        ? `${worked.label}2.${parent}`
        : undefined);
  const amountVar =
    (broke ?? worked)
      ? near((broke ?? worked)!.amount)
      : typedAmount.ok
        ? near(typedAmount.amount)
        : undefined;
  const nonceVar = worked ? worked.signed.nonce.toString() : undefined;
  useEffect(() => {
    const v: Record<string, string> = {};
    if (parentVar) v.parent = parentVar;
    if (subVar) v.sub = subVar;
    if (failVar) v.failsub = failVar;
    if (amountVar) v.amount = amountVar;
    if (nonceVar) v.nonce = nonceVar;
    if (Object.keys(v).length) varsRef.current?.(v);
  }, [parentVar, subVar, failVar, amountVar, nonceVar]);

  // Evidence for the completion record: transaction ids and the refusal reason, never keys.
  const evidenceRef = useRef(reportEvidence);
  evidenceRef.current = reportEvidence;
  const firstRefusal = refused[0]?.reason ?? null;
  useEffect(() => {
    if (!worked) return;
    const ev: Record<string, string> = { txHash: worked.signed.hash, mode: chain.network };
    if (broke) ev.failedTxHash = broke.signed.hash;
    if (firstRefusal) ev.replayRefused = firstRefusal;
    evidenceRef.current?.(ev);
  }, [worked, broke, firstRefusal, chain.network]);

  async function makeWorkshop() {
    if (!me || busy || workshop) return;
    setBusy("workshop");
    setError(null);
    setPhase(null);
    try {
      let id: string | null = null;
      for (let n = 1; n <= WORKSHOP_TRIES && !id; n++) {
        const candidate = `${workshopLabel(me.accountId, n)}.testnet`;
        if (!(await chain.accountExists(candidate))) id = candidate;
      }
      if (!id) {
        setError("Could not find a free name for the workshop account. Please try again later.");
        return;
      }
      const key = await chain.newKeyPair();
      const out = await createNamedAccount(chain, id, key, WORKSHOP_DEPOSIT, {
        pace,
        onPhase: (e) => setPhase(e.phase),
      });
      if (out.status.type === "Failure") {
        setError(`${out.status.error.message} Please try again.`);
        return;
      }
      if (!(await chain.accountExists(id))) {
        setError(`The registrar did not make ${id}. Please try again.`);
        return;
      }
      setWorkshopBalance((await chain.viewAccount(id)).amount);
      setWorkshop({ id, outcome: out });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!workshop || busy) return;
    const name = readLabel(label, workshop.id);
    if (!name.ok) return setProblem(name.problem);
    const amt = readAmount(amountText);
    if (!amt.ok) return setProblem(amt.problem);
    if (items.length === 0) return setProblem("Add at least one action first.");
    setProblem(null);
    setBusy("send");
    setError(null);
    setPhase(null);
    const batch = items;
    try {
      const keys = await Promise.all(Array.from({ length: keysNeeded(batch) }, () => chain.newKeyPair()));
      const [existedBefore, before] = await Promise.all([
        chain.accountExists(name.id),
        chain.viewAccount(workshop.id).then((v) => v.amount),
      ]);
      const unsigned = await chain.buildTransaction({
        signerId: workshop.id,
        receiverId: name.id,
        actions: toActions(batch, amt.amount, keys),
      });
      const signed = await chain.signTransaction(unsigned);
      const out = await chain.sendSignedTransaction(signed, { pace, onPhase: (e) => setPhase(e.phase) });
      const [existsAfter, after] = await Promise.all([
        chain.accountExists(name.id),
        chain.viewAccount(workshop.id).then((v) => v.amount),
      ]);
      const receiverBalance = existsAfter ? (await chain.viewAccount(name.id)).amount : null;
      const failure = out.status.type === "Failure" ? out.status.error.message : null;
      setWorkshopBalance(after);
      setSent((s) => [
        ...s,
        {
          n: s.length + 1,
          at: step,
          signed,
          items: batch,
          label: label.trim().toLowerCase(),
          receiver: name.id,
          amount: amt.amount,
          ok: out.status.type !== "Failure",
          fates: fates(batch.length, out),
          failure,
          existedBefore,
          existsAfter,
          before,
          after,
          receiverBalance,
        },
      ]);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function replay(which: "worked" | "failed") {
    const old = which === "worked" ? worked : lastFailed;
    if (!old || !workshop || busy) return;
    setBusy("replay");
    setError(null);
    const n = replays.length + 1;
    const keyNonce = async () =>
      (await chain.listKeys(workshop.id).catch(() => [])).find((k) => k.publicKey === old.signed.publicKey)
        ?.nonce ?? null;
    try {
      await chain.sendSignedTransaction(old.signed, { pace });
      // Not expected: the network ran it again.
      setReplays((r) => [
        ...r,
        {
          n,
          which,
          reason: null,
          message: "The network accepted the copy.",
          txNonce: old.signed.nonce,
          keyNonce: null,
        },
      ]);
    } catch (e) {
      if (isChainError(e) && e.kind === "InvalidTransaction") {
        const now = await keyNonce();
        setReplays((r) => [
          ...r,
          {
            n,
            which,
            reason: e.reason ?? "InvalidNonce",
            message: e.message,
            txNonce: old.signed.nonce,
            keyNonce: now,
          },
        ]);
      } else setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  function add(kind: ItemKind) {
    setItems((list) => [...list, { id: nextId.current++, kind }]);
    setProblem(null);
  }

  const state = [
    `step:${step}`,
    `parent:${workshop ? "yes" : "no"}`,
    `batch:${worked ? "ok" : "none"}`,
    `failed:${lastFailed ? "yes" : "no"}`,
    `rolledback:${lastFailed && lastFailed.existsAfter === lastFailed.existedBefore ? "yes" : "no"}`,
    `replayed:${refused.length}`,
    `error:${error ? "yes" : "no"}`,
    `network:${chain.network}`,
  ].join(";");

  const sending = busy === "send" || busy === "workshop";
  let status: string | null = null;
  if (error) status = null;
  else if (sending) status = phase ? `Sending… ${phase}` : "Sending…";
  else if (step === OPEN) status = workshop ? "Here is the transaction. Press Next." : null;
  else if (step === BUILD)
    status = !workshop
      ? "Make the workshop account first (step 2)."
      : worked
        ? `${worked.receiver} exists. Press Next.`
        : last && !last.ok
          ? "That batch failed, and nothing stayed. Fix it and send again."
          : "Add the three actions, then send.";
  else if (step === BREAK)
    status = !worked
      ? "Send a batch that works first (step 3)."
      : broke
        ? `${broke.receiver} was not created. Press Next.`
        : "Send the batch with the same key twice.";
  else if (step === REPLAY)
    status = !worked
      ? "Send a batch that works first (step 3)."
      : refused.length
        ? "Refused. Press Next."
        : "Send an old transaction again.";

  // The transaction the card shows: the one that made the workshop at step 2, then the latest batch.
  const shown: SignedTransaction | null =
    step <= OPEN ? (workshop?.outcome.transaction ?? null) : (last?.signed ?? null);

  return {
    step,
    network: chain.network,
    me,
    workshop,
    workshopBalance,
    label,
    setLabel: (t: string) => {
      setLabelRaw(t);
      setProblem(null);
    },
    amountText,
    setAmountText: (t: string) => {
      setAmountTextRaw(t);
      setProblem(null);
    },
    readName,
    items,
    add,
    moveItem: (i: number, by: -1 | 1) => setItems((list) => move(list, i, by)),
    removeItem: (i: number) => setItems((list) => list.filter((_, k) => k !== i)),
    problem,
    sent,
    last,
    worked,
    broke,
    lastFailed,
    replays,
    refused,
    busy,
    phase,
    error,
    passed,
    pass: () => setPassed(true),
    state,
    status,
    shown,
    canMake: step === OPEN && !workshop && busy === null && !!me,
    canSend: (step === BUILD || step === BREAK) && !!workshop && busy === null && items.length > 0,
    canReplay: step === REPLAY && busy === null,
    makeWorkshop,
    send,
    replay,
  };
}

function message(e: unknown): string {
  return isChainError(e) ? e.message : "Something went wrong. Please try again.";
}
