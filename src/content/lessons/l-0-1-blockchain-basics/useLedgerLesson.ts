import { useEffect, useMemo, useState } from "react";
import type { SceneProps } from "../../../app/types";
import {
  balances,
  compareCopies,
  DEFAULT_TXS,
  fillTo,
  genesisChain,
  hashOfText,
  repairNext,
  send,
  shortHash,
  tamperAmount,
  verify,
  type Chain,
  type Person,
  type Tx,
} from "./ledger";

// Step numbers (0-based) from manifest.ts.
export const NOTEBOOK = 0;
export const SEND = 1;
export const BLOCKS = 2;
export const HASH = 3;
export const LINKS = 4;
export const TAMPER = 5;
export const COMPARE = 6;
export const CHECK = 7;
export const HONEST = 8;

/** The chain stops at block #3, so it always fits on screen. */
export const MAX_BLOCKS = 4;

export const nextDefault = (chain: Chain): Tx => DEFAULT_TXS[chain.length - 1] ?? DEFAULT_TXS[0]!;

/**
 * The whole state of lesson 0.1, shared by the 2D and the 3D view. Switching views mid-lesson keeps
 * it, because it lives in Scene.tsx above both views. Every number the views draw comes from here.
 */
export function useLedgerLesson({
  step,
  setGate,
  setVars,
}: Pick<SceneProps, "step" | "setGate" | "setVars">) {
  const [chain, setChain] = useState<Chain>(genesisChain);
  const [ben, setBen] = useState<Chain | null>(null);
  const [opened, setOpened] = useState<Person | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saw1, setSaw1] = useState(false);
  const [sandbox, setSandboxText] = useState<string | null>(null);
  const [hashChanged, setHashChanged] = useState(false);
  const [tamperText, setTamperText] = useState<string | null>(null);
  const [sawAllRed, setSawAllRed] = useState(false);
  const [autoTampered, setAutoTampered] = useState(false);
  const [compared, setCompared] = useState(false);
  const [passed, setPassed] = useState(false);
  const [lastTx, setLastTx] = useState<{ tx: Tx; n: number } | null>(null);

  // Opening a step by URL (or skipping ahead) builds the blocks that step needs.
  useEffect(() => {
    const need = step >= LINKS + 1 ? MAX_BLOCKS : step >= BLOCKS ? 2 : 1;
    if (chain.length < need) setChain((c) => fillTo(c, need));
  }, [step, chain.length]);

  const benChain = ben ?? chain;
  // What the learner actually sent in block #1, and a different amount for Ben to pretend he got.
  const sent = chain[1]?.tx?.amount ?? 3;
  const tamperTo = sent === 9 ? 10 : 9;
  useEffect(() => setVars?.({ sent: String(sent), tamper: String(tamperTo) }), [sent, tamperTo, setVars]);
  const benDiffers = !compareCopies(chain, benChain);

  // The comparison needs a changed copy: if Ben undid his edit, put the script's edit back.
  useEffect(() => {
    if (step !== COMPARE || compared || chain.length < MAX_BLOCKS || benDiffers) return;
    setBen(tamperAmount(chain, 1, tamperTo));
    setTamperText(String(tamperTo));
    setAutoTampered(true);
  }, [step, compared, chain, benDiffers, tamperTo]);

  const benCheck = useMemo(() => verify(benChain), [benChain]);
  const allRed = benCheck.allLaterBroken(1);
  useEffect(() => {
    if (step === TAMPER && allRed) setSawAllRed(true);
  }, [step, allRed]);

  const done = [
    opened !== null,
    chain.length >= 2,
    saw1,
    hashChanged,
    chain.length >= MAX_BLOCKS,
    sawAllRed,
    compared,
    passed,
    true,
  ];
  const stepDone = done[step] ?? false;
  useEffect(() => {
    if (stepDone) setGate(true);
  }, [stepDone, setGate]);

  const honestCheck = useMemo(() => verify(chain), [chain]);
  const shown = step === TAMPER ? benChain : chain;
  const check = step === TAMPER ? benCheck : honestCheck;
  const honestHashes = honestCheck.computed;
  const broken = check.links.flatMap((ok, i) => (ok ? [] : [i]));
  const copies = step < COMPARE ? "same" : compared ? "restored" : benDiffers ? "differs" : "same";
  const state = `step:${step};blocks:${shown.length};broken:${broken.join(",") || "none"};copies:${copies}`;

  const bal = balances(chain);
  const block1 = chain[1];
  const tamperValid = tamperText === null || /^\d{1,4}$/.test(tamperText.trim());

  let status = "";
  if (step === NOTEBOOK)
    status = opened ? "Every copy says the same. Try the others too." : "Click a notebook to open it.";
  else if (step === SEND) status = chain.length >= 2 ? `Accepted. Block #1 now holds "${block1?.text}".` : "";
  else if (step === BLOCKS)
    status = saw1 ? "One transaction, written down together in block #1." : "Click block #1 to look inside.";
  else if (step === LINKS)
    status =
      chain.length >= MAX_BLOCKS
        ? "Block #3 is on the chain. Each block points back to the hash before it."
        : `Send ${MAX_BLOCKS - chain.length} more. Each one gets its own block.`;
  else if (step === TAMPER && !tamperValid) status = `Type a whole number, such as ${tamperTo}.`;
  else if (step === TAMPER)
    status = allRed
      ? "#1's hash changed, so #2's link broke. That changed #2's hash, so #3's link broke too."
      : broken.length
        ? "Still broken further on. Every later block would need redoing."
        : `Change the ${sent} in block #1 to ${tamperTo} and watch the links.`;

  return {
    step,
    // the ledger
    chain,
    benChain,
    shown,
    check,
    benCheck,
    honestHashes,
    broken,
    bal,
    sent,
    tamperTo,
    benDiffers,
    allRed,
    // what the learner did
    opened,
    selected,
    saw1,
    sandbox: sandbox ?? block1?.text ?? "",
    tamperText: tamperText ?? String(block1?.tx?.amount ?? ""),
    autoTampered,
    compared,
    passed,
    lastTx,
    // for tests and screen readers
    copies,
    state,
    status,
    // actions
    openNotebook: setOpened,
    pickBlock(n: number) {
      setSelected(n);
      if (n === 1) setSaw1(true);
    },
    setSandbox(t: string) {
      setSandboxText(t);
      if (block1 && shortHash(hashOfText(chain, 1, t)) !== shortHash(honestHashes[1]!)) setHashChanged(true);
    },
    /** Checks a transaction and adds it in a new block. Returns the reason when it is rejected. */
    send(tx: Tx): string | null {
      const r = send(chain, tx);
      if (!r.ok) return r.reason;
      setChain(r.chain);
      setLastTx({ tx, n: r.chain.length });
      return null;
    },
    editAmount(text: string) {
      setTamperText(text);
      setCompared(false);
      if (!/^\d{1,4}$/.test(text.trim())) return;
      setBen(tamperAmount(chain, 1, Number(text)));
    },
    repair() {
      setBen((b) => repairNext(b ?? chain));
    },
    undo() {
      setBen(null);
      setTamperText(null);
      setAutoTampered(false);
    },
    compare() {
      setCompared(true);
      setBen(null);
      setTamperText(null);
    },
    pass() {
      setPassed(true);
      setGate(true);
    },
  };
}

export type LedgerLesson = ReturnType<typeof useLedgerLesson>;
