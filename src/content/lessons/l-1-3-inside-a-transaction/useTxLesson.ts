/**
 * The ONE state of lesson 1.3, shared by the 2D and the 3D view. Everything on chain goes through
 * useChain(): the workshop account (through the registrar), the batch (build → sign → send, so the signed
 * transaction can be sent again unchanged), and the read-backs. No three.js here, so 2D never loads 3D code.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain, useChainMode } from "../../../chain/ChainContext";
import { isChainError } from "../../../chain/errors";
import { createNamedAccount } from "../../../chain/ops";
import type {
  AccessKeyInfo,
  InvalidTxReason,
  PracticeAccount,
  PublicKey,
  SignedTransaction,
  TxOutcome,
  TxPhase,
} from "../../../chain/types";
import {
  DEFAULT_AMOUNT_TEXT,
  DEFAULT_LABEL,
  WORKSHOP_DEPOSIT,
  balanceProblem,
  comesBack,
  deposited,
  labelCandidates,
  readRemembered,
  type Remembered,
  fates,
  hasAllKinds,
  isRollback,
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
  /** The step it was sent at: only a roll back sent at the "break it" step opens that step's gate. */
  at: number;
  signed: SignedTransaction;
  items: Item[];
  label: string;
  receiver: string;
  amount: bigint;
  /** The NEAR the batch sends (the amount once per Send row). */
  deposit: bigint;
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

/** An old signed transaction sent again. */
export interface Replay {
  n: number;
  which: "worked" | "failed";
  /** True when the chain would not run it again (the expected case). */
  notRun: boolean;
  /** The chain's reason, when it gives one. */
  reason: InvalidTxReason | null;
  message: string;
  txNonce: bigint;
  keyNonce: bigint | null;
}

export interface Workshop {
  id: string;
  /** The transaction that made it; null when it was made on an earlier visit and cannot be read back. */
  outcome: TxOutcome | null;
  /** True when the lesson found it from an earlier visit instead of making it now. */
  reused: boolean;
}

export interface LessonError {
  text: string;
  /** Offer "Continue in demo mode" (for example when testnet NEAR runs out). */
  demo: boolean;
}

const WORKSHOP_TRIES = 6;
const initialItems: Item[] = [];

/** Friendly words for the phases of a transaction, for the status line. */
const PHASE_TEXT: Record<TxPhase, string> = {
  built: "Building it…",
  signed: "Signing it…",
  broadcast: "Sending it…",
  included: "In a block…",
  executed: "Running the actions…",
  final: "Final.",
};

/** Where the lesson remembers the workshop transaction id, so a later visit can show it again. */
const storeKey = (network: string) => `bon:l-1-3:workshop:${network}`;
function remember(network: string, value: { id: string; txHash: string }) {
  try {
    localStorage.setItem(storeKey(network), JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the lesson still works, it just cannot show the old transaction.
  }
}
function recall(network: string): Remembered | null {
  try {
    return readRemembered(localStorage.getItem(storeKey(network)));
  } catch {
    return null;
  }
}

/** True when `keys` belong to a workshop account the lesson made: our key is its one full-access key. */
function onlyOurs(keys: AccessKeyInfo[], publicKey: PublicKey): boolean {
  const full = keys.filter((k) => k.permission.type === "FullAccess");
  return full.length === 1 && full[0]!.publicKey === publicKey;
}

export function useTxLesson({
  step,
  setGate,
  setVars,
  reducedMotion,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reducedMotion" | "reportEvidence">) {
  const chain = useChain();
  const { setMode } = useChainMode();
  const pace = reducedMotion ? "instant" : "realtime";

  const [me, setMe] = useState<PracticeAccount | null>(null);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  /** The first workshop name nobody has, found on load; null while looking or when none is free. */
  const [freeId, setFreeId] = useState<string | null>(null);
  const [looked, setLooked] = useState(false);
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
  const [error, setError] = useState<LessonError | null>(null);
  const [passed, setPassed] = useState(false);
  const prefilled = useRef(false);

  // The practice account, then a workshop account from an earlier visit. The workshop account holds the
  // practice account's own key, which this app keeps, so it can be used again after a reload; no new
  // account (and no new deposit) is needed.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const acc = await chain.practiceAccount();
        if (!live) return;
        setMe(acc);
        // The account remembered in this browser first, then the names the lesson would have made.
        const stored = recall(chain.network);
        const named = Array.from(
          { length: WORKSHOP_TRIES },
          (_, i) => `${workshopLabel(acc.accountId, i + 1)}.testnet`,
        );
        const candidates = stored ? [stored.id, ...named.filter((n) => n !== stored.id)] : named;
        let free: string | null = null;
        for (const id of candidates) {
          if (!(await chain.accountExists(id))) {
            // Only the lesson's own names can be made; stop at the first free one.
            if (named.includes(id)) {
              free = id;
              break;
            }
            continue;
          }
          // Reuse it only when our key is its one full-access key: then nobody else controls it.
          const keys = await chain.listKeys(id).catch(() => []);
          if (!onlyOurs(keys, acc.publicKey)) continue;
          const outcome =
            stored?.id === id
              ? await chain.getTransaction(stored.txHash, acc.accountId).catch(() => null)
              : null;
          const view = await chain.viewAccount(id);
          if (!live) return;
          setWorkshopBalance(view.amount);
          setWorkshop({ id, outcome, reused: true });
          return;
        }
        if (live) setFreeId(free);
      } catch (e) {
        if (live) setError({ text: message(e), demo: false });
      } finally {
        if (live) setLooked(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [chain]);

  const worked = sent.find((s) => s.ok && hasAllKinds(s.items)) ?? null;
  const broke = sent.find((s) => s.at >= BREAK && isRollback(s)) ?? null;
  const lastFailed = [...sent].reverse().find((s) => !s.ok) ?? null;
  const last = sent[sent.length - 1] ?? null;
  const notRun = replays.filter((r) => r.notRun);

  const done = [true, !!workshop, !!worked, !!broke, notRun.length > 0, passed, true];
  const stepDone = done[step] ?? true;
  useEffect(() => {
    setGate(stepDone);
  }, [stepDone, setGate]);

  /** The first name under the workshop account that nobody has yet, trying `base`, `base2`, … */
  async function firstFree(base: string, start: number, parentId: string): Promise<string | null> {
    for (const l of labelCandidates(base, start)) {
      const read = readLabel(l, parentId);
      if (read.ok && !(await chain.accountExists(read.id))) return l;
    }
    return null;
  }

  // Suggest a free name: a workshop account from an earlier visit may already have shop, shop2…
  // Only while the learner has not typed a name of their own.
  const typed = useRef(false);
  useEffect(() => {
    if (!workshop?.reused) return;
    let live = true;
    void firstFree(DEFAULT_LABEL, 1, workshop.id).then((l) => {
      if (live && l && !typed.current) setLabelRaw(l);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per workshop account
  }, [workshop]);

  // The "break it" step starts from the batch that worked, under a new name, with the same key twice.
  // A layout effect, so the builder never shows the old rows for a frame; then, if that name is taken
  // (an earlier visit), the next free one.
  useLayoutEffect(() => {
    if (step !== BREAK || !worked || prefilled.current) return;
    prefilled.current = true;
    if (label.trim().toLowerCase() === worked.label) {
      typed.current = false;
      setLabelRaw(`${worked.label}2`);
      if (workshop)
        void firstFree(worked.label, 2, workshop.id).then((l) => {
          if (l && !typed.current) setLabelRaw(l);
        });
    }
    setItems(() => {
      const base = worked.items.map((i) => ({ id: nextId.current++, kind: i.kind }));
      return base.some((i) => i.kind === "again")
        ? base
        : [...base, { id: nextId.current++, kind: "again" as const }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the step opens
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
  const amountVar = worked ? near(worked.amount) : typedAmount.ok ? near(typedAmount.amount) : undefined;
  // What the "break it" batch sends, and so what comes back: from the batch sent, or the rows on the builder.
  const backVar = broke
    ? comesBack(broke.deposit)
    : step >= BREAK && typedAmount.ok
      ? comesBack(deposited(items, typedAmount.amount))
      : worked
        ? comesBack(worked.deposit)
        : undefined;
  const nonceVar = worked ? worked.signed.nonce.toString() : undefined;
  useEffect(() => {
    const v: Record<string, string> = {};
    if (parentVar) v.parent = parentVar;
    if (subVar) v.sub = subVar;
    if (failVar) v.failsub = failVar;
    if (amountVar) v.amount = amountVar;
    if (backVar) v.comesback = backVar;
    if (nonceVar) v.nonce = nonceVar;
    if (Object.keys(v).length) varsRef.current?.(v);
  }, [parentVar, subVar, failVar, amountVar, backVar, nonceVar]);

  // Evidence for the completion record: transaction ids and the chain's reason, never keys.
  const evidenceRef = useRef(reportEvidence);
  evidenceRef.current = reportEvidence;
  const firstNotRun = notRun[0] ? (notRun[0].reason ?? "not-run") : null;
  useEffect(() => {
    if (!worked) return;
    const ev: Record<string, string> = { txHash: worked.signed.hash, mode: chain.network };
    if (broke) ev.failedTxHash = broke.signed.hash;
    if (firstNotRun) ev.replayRefused = firstNotRun;
    evidenceRef.current?.(ev);
  }, [worked, broke, firstNotRun, chain.network]);

  async function makeWorkshop() {
    if (!me || busy || workshop) return;
    if (!freeId) {
      setError({
        text: "There is no free name for a workshop account. Continue in demo mode, which needs none.",
        demo: true,
      });
      return;
    }
    const id = freeId;
    setBusy("workshop");
    setError(null);
    setPhase(null);
    try {
      // The new account gets the practice account's key, so the app can sign for it on later visits too.
      const out = await createNamedAccount(chain, id, me.publicKey, WORKSHOP_DEPOSIT, {
        pace,
        onPhase: (e) => setPhase(e.phase),
      });
      if (out.status.type === "Failure") {
        setError({ text: `${out.status.error.message} Please try again.`, demo: false });
        return;
      }
      // The account must exist and hold our key, or the lesson could not sign for it.
      const keys = (await chain.accountExists(id)) ? await chain.listKeys(id).catch(() => []) : [];
      if (!keys.some((k) => k.publicKey === me.publicKey && k.permission.type === "FullAccess")) {
        setError({ text: `The registrar did not make ${id} with your key. Please try again.`, demo: false });
        return;
      }
      remember(chain.network, { id, txHash: out.transaction.hash });
      setWorkshopBalance((await chain.viewAccount(id)).amount);
      setWorkshop({ id, outcome: out, reused: false });
    } catch (e) {
      const short = balanceProblem(
        e,
        "Your practice account",
        `It needs about ${near(WORKSHOP_DEPOSIT)} NEAR for the workshop account. Continue in demo mode, which needs no NEAR.`,
      );
      setError(short ? { text: short, demo: true } : { text: message(e), demo: false });
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!workshop || !me || busy) return;
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
      const [existedBefore, before] = await Promise.all([
        chain.accountExists(name.id),
        chain.viewAccount(workshop.id).then((v) => v.amount),
      ]);
      // Creating an account that exists fails at once and still costs a fee: say so before sending.
      if (existedBefore && batch.some((i) => i.kind === "create")) {
        const free = await firstFree(label.trim().toLowerCase(), 2, workshop.id);
        setProblem(
          `${name.id} already exists, so creating it would fail.${free ? ` Try ${free}.` : " Pick another name."}`,
        );
        return;
      }
      const keys = await Promise.all(Array.from({ length: keysNeeded(batch) }, () => chain.newKeyPair()));
      const unsigned = await chain.buildTransaction({
        signerId: workshop.id,
        publicKey: me.publicKey,
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
          deposit: deposited(batch, amt.amount),
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
      const short = balanceProblem(e, workshop.id);
      setError(short ? { text: short, demo: true } : { text: message(e), demo: false });
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
      // Not expected: the chain ran the copy.
      setReplays((r) => [
        ...r,
        {
          n,
          which,
          notRun: false,
          reason: null,
          message: "The chain ran the copy.",
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
            notRun: true,
            reason: e.reason ?? null,
            message: e.message,
            txNonce: old.signed.nonce,
            keyNonce: now,
          },
        ]);
      } else setError({ text: message(e), demo: false });
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
    `rolledback:${lastFailed && isRollback(lastFailed) ? "yes" : "no"}`,
    `replayed:${notRun.length}`,
    `error:${error ? "yes" : "no"}`,
    `network:${chain.network}`,
    `reused:${workshop?.reused ? "yes" : "no"}`,
  ].join(";");

  const sending = busy === "send" || busy === "workshop";
  let status: string | null = null;
  if (error) status = null;
  else if (sending) status = phase ? PHASE_TEXT[phase] : "Sending it…";
  else if (step === OPEN)
    status = workshop
      ? workshop.reused
        ? `${workshop.id} is from your earlier visit. Press Next.`
        : "Here is the transaction. Press Next."
      : looked
        ? null
        : "Looking for your workshop account…";
  else if (step === BUILD)
    status = !workshop
      ? "Go back and make the workshop account first."
      : worked
        ? `${worked.receiver} exists. Press Next.`
        : last && !last.ok
          ? "That batch failed, and nothing stayed. Fix it and send again."
          : "Add the three actions, then send.";
  else if (step === BREAK)
    status = !worked
      ? "Go back and send a batch that works first."
      : broke
        ? `${broke.receiver} was not created. Press Next.`
        : last && last.at >= BREAK && !last.ok
          ? last.existedBefore
            ? "That account already existed, so there was nothing to undo. Pick a new name."
            : "It failed at once, so nothing ran to undo. Put the failing action last."
          : "Send the batch with the same key twice.";
  else if (step === REPLAY)
    status = !worked
      ? "Go back and send a batch that works first."
      : notRun.length
        ? "It did not run again. Press Next."
        : "Send an old transaction again.";

  // The transaction the card shows: the one that made the workshop, then the latest batch.
  const shown: SignedTransaction | null =
    step <= OPEN ? (workshop?.outcome?.transaction ?? null) : (last?.signed ?? null);

  return {
    step,
    network: chain.network,
    me,
    workshop,
    workshopBalance,
    label,
    setLabel: (t: string) => {
      typed.current = true;
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
    notRun,
    busy,
    phase,
    error,
    passed,
    pass: () => setPassed(true),
    state,
    status,
    shown,
    canMake: step === OPEN && !workshop && busy === null && !!me && looked,
    canSend: (step === BUILD || step === BREAK) && !!workshop && busy === null && items.length > 0,
    canReplay: step === REPLAY && busy === null,
    makeWorkshop,
    send,
    replay,
    continueInDemo: () => setMode("demo"),
  };
}

function message(e: unknown): string {
  return isChainError(e) ? e.message : "Something went wrong. Please try again.";
}
