/**
 * The ONE state of lesson 3.1, shared by the 2D and the 3D view. Everything on chain goes through
 * useChain(): making the parent name when needed, the deploy batch, the calls, the view calls and reading
 * the contract account's storage. The code is the real counter.wasm in both modes (DemoChain runs its
 * JavaScript twin, matched by the code's hash). No three.js here, so 2D never loads 3D code.
 */
import { useEffect, useRef, useState } from "react";
import { base64 } from "@scure/base";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { isChainError } from "../../../chain/errors";
import { actions, callMethod, createNamedAccount, decodeSuccessValue } from "../../../chain/ops";
import { formatTgas } from "../../../chain/units";
import type { AccountView, PracticeAccount, TxOutcome, TxPhase } from "../../../chain/types";
import { COUNTER_WASM_BASE64, COUNTER_WASM_SHA256 } from "../../../chain/counterWasm";
import {
  CALL_GAS,
  CALLBACK_GAS,
  CONTRACT_FUNDING,
  contractIdFor,
  gaugeOf,
  nearText,
  newParentName,
  PARENT_FUNDING,
  storageLock,
  wasmFacts,
} from "./contract";
import { CALL, CHECK, CLEAR, DEPLOY, FAIL, HONEST, HOOK, WASM } from "./steps";

export { CALL, CHECK, CLEAR, DEPLOY, FAIL, HONEST, HOOK, WASM };

/** The real contract, bundled with the lesson (no fetch, so demo mode needs no network at all). */
const CODE = base64.decode(COUNTER_WASM_BASE64);
export const WASM_FACTS = wasmFacts(CODE);
/** Shown until the browser has compiled the module and listed its exports. */
const KNOWN_EXPORTS = ["increment", "get_num", "fail", "call_other", "on_other_done", "last_result", "reset"];

export type Busy = null | "deploy" | "increment" | "read" | "fail" | "reset";

/** One receipt of the failing-callback transaction, as the learner sees it. */
export interface ReceiptLine {
  id: string;
  method: string;
  ok: boolean;
  note: string;
  /** Gas this receipt burnt, in Tgas: paid even when it failed. */
  gas: string;
}

export interface Parent {
  id: string;
  /** The practice account is a hex id, so the lesson makes this short name first. */
  make: boolean;
}

export type Deploy = ReturnType<typeof useDeploy>;

export function useDeploy({
  step,
  setGate,
  setVars,
  reducedMotion,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reducedMotion" | "reportEvidence">) {
  const chain = useChain();
  const pace = reducedMotion ? "instant" : "realtime";

  const [me, setMe] = useState<PracticeAccount | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [parentMade, setParentMade] = useState(false);
  const [exportsList, setExportsList] = useState<string[]>(KNOWN_EXPORTS);
  const [unrolled, setUnrolled] = useState(false);
  const [deployTx, setDeployTx] = useState<string | null>(null);
  const [deployed, setDeployed] = useState(false);
  const [atDeploy, setAtDeploy] = useState<AccountView | null>(null);
  const [view, setView] = useState<AccountView | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [increments, setIncrements] = useState(0);
  const [read, setRead] = useState<number | null>(null);
  const [receipts, setReceipts] = useState<ReceiptLine[] | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [callbackTx, setCallbackTx] = useState<string | null>(null);
  const [cleared, setCleared] = useState<{ before: number; after: number } | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [phase, setPhase] = useState<TxPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);

  const contractId = parent ? contractIdFor(parent.id) : null;

  // The practice account, and the parent the contract goes under.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const acc = await chain.practiceAccount();
        if (!live) return;
        setMe(acc);
        const own = contractIdFor(acc.accountId);
        setParent(own ? { id: acc.accountId, make: false } : { id: newParentName(), make: true });
        // A named practice account may hold the counter from an earlier visit: pick it up.
        if (own && (await chain.accountExists(own))) {
          const v = await chain.viewAccount(own);
          if (!live || v.codeHash !== COUNTER_WASM_SHA256) return;
          const num = await chain.viewCall<number>(own, "get_num").catch(() => null);
          if (!live) return;
          setDeployed(true);
          setAtDeploy(v);
          setView(v);
          if (num) setCount(Number(num.result));
        }
      } catch (e) {
        if (live) setError(message(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [chain]);

  // The exports, read from the real bytes by the browser's own Wasm engine.
  useEffect(() => {
    let live = true;
    WebAssembly.compile(CODE as BufferSource)
      .then((m) => {
        const names = WebAssembly.Module.exports(m)
          .filter((e) => e.kind === "function")
          .map((e) => e.name);
        if (live && names.length) setExportsList(names);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const readOk = increments > 0 && read !== null && read === count;
  const done = [
    true,
    true,
    deployed,
    readOk,
    lastResult === "failed",
    !!cleared && cleared.after < cleared.before,
    passed,
    true,
  ];
  const stepDone = done[step] ?? false;
  useEffect(() => {
    setGate(stepDone);
  }, [stepDone, setGate]);

  // The learner's own values, used in later text.
  const gauge = gaugeOf(view);
  const deposit = atDeploy ? nearText(storageLock(atDeploy.storageUsage)) : undefined;
  const refund = cleared ? nearText(storageLock(cleared.before - cleared.after)) : undefined;
  const varsRef = useRef(setVars);
  varsRef.current = setVars;
  useEffect(() => {
    const v: Record<string, string> = { codeBytes: WASM_FACTS.size.toLocaleString("en-US") };
    if (contractId) v.contract = contractId;
    if (deposit) v.storageDeposit = deposit;
    if (refund) v.refund = refund;
    varsRef.current?.(v);
  }, [contractId, deposit, refund]);

  // Evidence for the completion record: hashes and the contract's name, never keys.
  const evidenceRef = useRef(reportEvidence);
  evidenceRef.current = reportEvidence;
  useEffect(() => {
    if (!deployTx || !contractId) return;
    evidenceRef.current?.({
      txHash: deployTx,
      contractId,
      ...(callbackTx ? { callbackTxHash: callbackTx } : {}),
    });
  }, [deployTx, contractId, callbackTx]);

  async function refresh(id: string) {
    const v = await chain.viewAccount(id);
    setView(v);
    return v;
  }

  /** Runs one chain operation with the busy flag and plain errors. */
  async function run(kind: Exclude<Busy, null>, work: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    setPhase(null);
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
      setPhase(null);
    }
  }

  const send = { pace, onPhase: (e: { phase: TxPhase }) => setPhase(e.phase) } as const;

  function failed(out: TxOutcome): boolean {
    if (out.status.type !== "Failure") return false;
    setError(out.status.error.message);
    return true;
  }

  const deploy = () =>
    run("deploy", async () => {
      if (!me || !parent || !contractId || deployed) return;
      if (parent.make && !parentMade) {
        const key = await chain.newKeyPair();
        const made = await createNamedAccount(chain, parent.id, key, PARENT_FUNDING, send);
        if (failed(made)) return;
        setParentMade(true);
      }
      const key = await chain.newKeyPair();
      const out = await chain.sendTransaction(
        {
          signerId: parent.id,
          receiverId: contractId,
          actions: [
            actions.createAccount(),
            actions.transfer(CONTRACT_FUNDING),
            actions.addFullAccessKey(key),
            actions.deployContract(CODE),
          ],
        },
        send,
      );
      if (failed(out)) return;
      const v = await refresh(contractId);
      setAtDeploy(v);
      setDeployTx(out.transaction.hash);
      setDeployed(true);
      setCount(0);
    });

  const increment = () =>
    run("increment", async () => {
      if (!contractId || !deployed) return;
      const out = await callMethod(chain, contractId, "increment", {}, { ...send, gas: CALL_GAS });
      if (failed(out)) return;
      const n = decodeSuccessValue<number>(out.status);
      setCount(typeof n === "number" ? n : (count ?? 0) + 1);
      setIncrements((i) => i + 1);
      await refresh(contractId);
    });

  const readCount = () =>
    run("read", async () => {
      if (!contractId || !deployed) return;
      const r = await chain.viewCall<number>(contractId, "get_num");
      const n = Number(r.result);
      setRead(n);
      setCount(n);
    });

  const failWithCallback = () =>
    run("fail", async () => {
      if (!contractId || !deployed) return;
      const out = await callMethod(
        chain,
        contractId,
        "call_other",
        { account_id: contractId, method_name: "fail" },
        { ...send, gas: CALLBACK_GAS },
      );
      setCallbackTx(out.transaction.hash);
      setReceipts(
        out.receipts
          .filter((r) => !r.isRefund)
          .map((r) => {
            const a = r.actions[0];
            const method = a?.type === "FunctionCall" ? a.methodName : (a?.type ?? "receipt");
            const ok = r.status.type !== "Failure";
            const note =
              r.status.type === "Failure"
                ? r.status.error.message
                : r.logs.length
                  ? r.logs.join(" ")
                  : "Done.";
            return { id: r.id, method, ok, note, gas: formatTgas(r.gasBurnt) };
          }),
      );
      const [last, num] = await Promise.all([
        chain.viewCall<string | null>(contractId, "last_result"),
        chain.viewCall<number>(contractId, "get_num"),
      ]);
      setCount(Number(num.result));
      setRead(Number(num.result));
      await refresh(contractId);
      setLastResult(last.result ?? "none");
    });

  const reset = () =>
    run("reset", async () => {
      if (!contractId || !deployed) return;
      const before = (await refresh(contractId)).storageUsage;
      const out = await callMethod(chain, contractId, "reset", {}, { ...send, gas: CALL_GAS });
      if (failed(out)) return;
      const after = (await refresh(contractId)).storageUsage;
      const num = await chain.viewCall<number>(contractId, "get_num");
      setCount(Number(num.result));
      setRead(Number(num.result));
      setCleared({ before, after });
    });

  /** What picking the gauge does: read the account's storage (and, on the call step, the count). */
  const inspect = () => {
    if (step === CALL) return readCount();
    if (contractId && deployed) void refresh(contractId).catch((e) => setError(message(e)));
  };

  const state = [
    `step:${step}`,
    `deployed:${deployed ? "yes" : "no"}`,
    `count:${count ?? 0}`,
    `read:${read ?? "none"}`,
    `callback:${lastResult ?? "none"}`,
    `cleared:${cleared ? "yes" : "no"}`,
    `busy:${busy ?? "no"}`,
    `error:${error ? "yes" : "no"}`,
    `network:${chain.network}`,
  ].join(";");

  let status: string | null = null;
  if (error) status = null;
  else if (busy === "deploy")
    status = parent?.make && !parentMade ? `Making ${parent.id} first…` : `Deploying… ${phase ?? ""}`.trim();
  else if (busy) status = phase ? `Working… ${phase}` : "Working…";
  else if (step === DEPLOY) status = deployed ? "Deployed. Press Next." : null;
  else if (step === CALL)
    status = !deployed
      ? "Deploy the contract first (step 3)."
      : readOk
        ? "Read back. Press Next."
        : increments > 0
          ? "Now read the count."
          : null;
  else if (step === FAIL)
    status = !deployed
      ? "Deploy the contract first (step 3)."
      : lastResult === "failed"
        ? "The callback saw the failure. Press Next."
        : null;
  else if (step === CLEAR)
    status = !deployed ? "Deploy the contract first (step 3)." : cleared ? "Cleared. Press Next." : null;

  return {
    step,
    network: chain.network,
    me,
    parent,
    contractId,
    facts: WASM_FACTS,
    exportsList,
    unrolled: unrolled || step >= WASM,
    unroll: () => setUnrolled(true),
    deployed,
    deployTx,
    view,
    atDeploy,
    gauge,
    count,
    increments,
    read,
    readOk,
    receipts,
    lastResult,
    cleared,
    refund,
    busy,
    error,
    passed,
    pass: () => setPassed(true),
    state,
    status,
    canDeploy: step === DEPLOY && !deployed && !busy && !!contractId,
    canCall: step === CALL && deployed && !busy,
    canFail: step === FAIL && deployed && !busy && lastResult !== "failed",
    canReset: step === CLEAR && deployed && !busy && !cleared,
    deploy,
    increment,
    readCount,
    failWithCallback,
    reset,
    inspect,
  };
}

function message(e: unknown): string {
  return isChainError(e) ? e.message : "Something went wrong. Please try again.";
}
