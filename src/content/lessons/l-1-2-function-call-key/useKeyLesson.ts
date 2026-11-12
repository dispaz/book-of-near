/**
 * The ONE state of lesson 1.2, shared by the 2D and the 3D view. Everything on chain goes through
 * useChain(). The Counter app is played by the lesson: each button becomes a transaction signed with the
 * app's function-call key (key.ts), and the chain accepts or refuses it. No three.js here, so 2D never
 * loads 3D code.
 */
import { useEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { isChainError } from "../../../chain/errors";
import { actions } from "../../../chain/ops";
import { demoContractCode } from "../../../chain/demo/contracts";
import { parseNear, tgas } from "../../../chain/units";
import type { AccessKeyInfo, PracticeAccount, PublicKey, TransactionRequest } from "../../../chain/types";
import counterWasmUrl from "../../../../contracts/counter/counter.wasm?url";
import {
  APP_GAS_TGAS,
  ATTACKS,
  ATTEMPT_LABEL,
  REASON_TEXT,
  DEFAULT_ALLOWANCE_TEXT,
  OTHER_CONTRACT,
  THIEF,
  appLine,
  keyGoneShown,
  keyLeftLine,
  near,
  readAllowance,
  refusedKinds,
  type Attempt,
  type Intent,
} from "./key";
import { findResumableKey, forgetKey, rememberKey } from "./resume";

// Step numbers (0-based) from manifest.ts.
export const HOOK = 0;
export const LIMIT = 1;
export const ADD = 2;
export const CALL = 3;
export const ATTACK = 4;
export const REVOKE = 5;
export const CHECK = 6;
export const HONEST = 7;

export type KeyState = "none" | "active" | "revoked";
export type Lesson = ReturnType<typeof useKeyLesson>;

/** The counter contract's code: the demo stand-in in demo mode, the real Wasm on testnet. */
async function counterCode(network: string): Promise<Uint8Array> {
  if (network === "demo") return demoContractCode("counter");
  const res = await fetch(counterWasmUrl);
  if (!res.ok) throw new Error(`Could not load the counter contract (HTTP ${res.status}). Please try again.`);
  return new Uint8Array(await res.arrayBuffer());
}

export function useKeyLesson({
  step,
  setGate,
  setVars,
  reducedMotion,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reducedMotion" | "reportEvidence">) {
  const chain = useChain();
  const pace = reducedMotion ? "instant" : "realtime";

  const [me, setMe] = useState<PracticeAccount | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowanceText, setAllowanceText] = useState(DEFAULT_ALLOWANCE_TEXT);
  const [allowanceProblem, setAllowanceProblem] = useState<string | null>(null);
  const [appKey, setAppKey] = useState<PublicKey | null>(null);
  const [keyInfo, setKeyInfo] = useState<AccessKeyInfo | null>(null);
  const [initial, setInitial] = useState<bigint | null>(null);
  const [keyState, setKeyState] = useState<KeyState>("none");
  const [counter, setCounter] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [says, setSays] = useState<string | null>(null);
  const [aim, setAim] = useState<Intent | null>(null);
  const [busy, setBusy] = useState<null | "add" | "try" | "revoke">(null);
  const [error, setError] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [addKeyTxHash, setAddKeyTxHash] = useState<string | null>(null);
  /** The key was added on an earlier visit and picked up again after a reload. */
  const [resumed, setResumed] = useState(false);
  /** What the key had when it was picked up after a reload. */
  const [resumedAllowance, setResumedAllowance] = useState<bigint | null>(null);

  // The practice account, through the Chain interface.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const acc = await chain.practiceAccount();
        const view = await chain.viewAccount(acc.accountId);
        if (!live) return;
        setMe(acc);
        setBalance(view.amount);
        // A reload must not orphan a key from an earlier visit (resume.ts).
        const found = await findResumableKey(chain, acc.accountId);
        if (!found || !live) return;
        setAppKey(found.key);
        setKeyInfo(found.info);
        setInitial(found.initial);
        setAddKeyTxHash(found.addKeyTxHash);
        setResumed(true);
        if (found.info.permission.type === "FunctionCall")
          setResumedAllowance(found.info.permission.allowance ?? null);
        setKeyState("active");
        if (found.counter !== null) setCounter(found.counter);
      } catch (e) {
        if (live) setError(message(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [chain]);

  const typed = readAllowance(allowanceText);
  const refused = refusedKinds(attempts);
  const counted = attempts.some((a) => a.intent === "count" && a.ok);
  const goneShown = keyGoneShown(attempts);

  const done = [
    true,
    true,
    keyState !== "none",
    counted,
    refused.length >= ATTACKS.length,
    keyState === "revoked",
    passed,
    true,
  ];
  const stepDone = done[step] ?? false;
  useEffect(() => {
    setGate(stepDone);
  }, [stepDone, setGate]);

  // The learner's own values, used in later text.
  const left = keyInfo?.permission.type === "FunctionCall" ? (keyInfo.permission.allowance ?? 0n) : null;
  // The allowance the key started with. After a reload this browser may not know it: then what the key
  // has now stands in, which is still true for "watch the allowance drop".
  const shownAllowance = initial ?? left ?? (typed.ok ? typed.amount : null);
  const varsRef = useRef(setVars);
  varsRef.current = setVars;
  const allowanceVar = shownAllowance !== null ? near(shownAllowance) : undefined;
  // After the key is deleted the chain no longer lists it: keep the last allowance we saw.
  const lastLeft = useRef<bigint | null>(null);
  if (left !== null) lastLeft.current = left;
  const leftVar = lastLeft.current !== null ? near(lastLeft.current) : undefined;
  const originalKnown = keyState === "none" || initial !== null;
  useEffect(() => {
    const v: Record<string, string> = {};
    if (allowanceVar) v.allowance = allowanceVar;
    if (leftVar) v.left = leftVar;
    else if (allowanceVar) v.left = allowanceVar;
    if (v.left) v.keyLeft = keyLeftLine(v.left, originalKnown ? (allowanceVar ?? null) : null);
    varsRef.current?.(v);
  }, [allowanceVar, leftVar, originalKnown]);

  // Evidence for the completion record: never keys, only counts and transaction hashes. txHash is the
  // latest key transaction (the delete, once done); addKeyTxHash keeps the add so both can be checked.
  // A key picked up after a reload says so (keyResumed); its add hash is there only if this browser kept it.
  const evidenceRef = useRef(reportEvidence);
  evidenceRef.current = reportEvidence;
  useEffect(() => {
    if (!txHash) return;
    evidenceRef.current?.({
      txHash,
      ...(addKeyTxHash ? { addKeyTxHash } : {}),
      ...(resumed ? { keyResumed: "yes" } : {}),
      refusedAttacks: String(refused.length),
      deletedKeyRefused: goneShown ? "yes" : "no",
    });
  }, [txHash, addKeyTxHash, resumed, refused.length, goneShown]);

  async function readKey(key: PublicKey, account: string) {
    const keys = await chain.listKeys(account);
    const info = keys.find((k) => k.publicKey === key) ?? null;
    setKeyInfo(info);
    return info;
  }

  async function refresh(account: string, key: PublicKey) {
    const [view] = await Promise.all([chain.viewAccount(account), readKey(key, account)]);
    setBalance(view.amount);
    const num = await chain.viewCall(account, "get_num", {}).catch(() => null);
    if (num) setCounter(Number(num.result));
  }

  async function addKey() {
    if (!me || busy || keyState !== "none") return;
    const r = readAllowance(allowanceText);
    if (!r.ok) {
      setAllowanceProblem(r.problem);
      return;
    }
    setBusy("add");
    setError(null);
    try {
      const key = await chain.newKeyPair();
      const code = await counterCode(chain.network);
      const out = await chain.sendTransaction(
        {
          signerId: me.accountId,
          receiverId: me.accountId,
          actions: [
            actions.deployContract(code),
            actions.addFunctionCallKey(key, me.accountId, [], r.amount),
          ],
        },
        { pace },
      );
      if (out.status.type === "Failure") {
        setError(out.status.error.message);
        return;
      }
      const info = await readKey(key, me.accountId);
      if (!info) {
        setError("The key did not show up on the chain. Please try again.");
        return;
      }
      setAppKey(key);
      setInitial(r.amount);
      rememberKey(me.accountId, key, { allowance: r.amount, addKeyTxHash: out.transaction.hash });
      setTxHash(out.transaction.hash);
      setAddKeyTxHash(out.transaction.hash);
      setKeyState("active");
      await refresh(me.accountId, key);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  /** What each try asks the chain to do, signed with the app's limited key. */
  async function requestFor(intent: Intent, key: PublicKey, account: string): Promise<TransactionRequest> {
    const gas = tgas(APP_GAS_TGAS);
    switch (intent) {
      case "count":
        return {
          signerId: account,
          publicKey: key,
          receiverId: account,
          actions: [actions.functionCall("increment", {}, gas)],
        };
      case "send": {
        // "All funds", but with room for the fee, so the network judges the key and not the balance.
        const have = (await chain.viewAccount(account)).amount;
        const spare = parseNear("0.1");
        const amount = have > spare * 2n ? have - spare : have / 2n;
        return {
          signerId: account,
          publicKey: key,
          receiverId: THIEF,
          actions: [actions.transfer(amount)],
        };
      }
      case "other":
        return {
          signerId: account,
          publicKey: key,
          receiverId: OTHER_CONTRACT,
          actions: [
            actions.functionCall(
              "create_account",
              { new_account_id: "app-made.testnet", new_public_key: key },
              gas,
            ),
          ],
        };
      case "addkey":
        return {
          signerId: account,
          publicKey: key,
          receiverId: account,
          actions: [actions.addFullAccessKey(await chain.newKeyPair())],
        };
    }
  }

  /** Signs `intent` with the app's key and sends it. After the delete, a Count shows the key is gone. */
  async function tryIt(intent: Intent) {
    const afterDelete = keyState === "revoked";
    if (!me || !appKey || busy || (keyState !== "active" && !afterDelete)) return;
    const label = ATTEMPT_LABEL[intent];
    setBusy("try");
    setError(null);
    setAim(intent);
    setSays(appLine(intent, me.accountId));
    const id = attempts.length + 1;
    try {
      const out = await chain.sendTransaction(await requestFor(intent, appKey, me.accountId), { pace });
      const failed = out.status.type === "Failure";
      const msg = out.status.type === "Failure" ? out.status.error.message : "The chain accepted it.";
      // Included but failed: no `reason` (only refused transactions have one), so it is not a refused attack.
      setAttempts((a) => [...a, { id, intent, label, ok: !failed, message: msg, afterDelete }]);
      setSays(
        failed
          ? `The chain included it, but it failed: ${msg} It does not count as refused. The gas was still paid.`
          : "Done. The chain accepted it.",
      );
      if (!afterDelete) await refresh(me.accountId, appKey);
    } catch (e) {
      if (isChainError(e) && e.kind === "InvalidTransaction") {
        setAttempts((a) => [
          ...a,
          { id, intent, label, ok: false, reason: e.reason, message: e.message, afterDelete },
        ]);
        setSays(`Refused by the chain. ${(e.reason && REASON_TEXT[e.reason]) ?? e.message}`);
      } else {
        setError(message(e));
      }
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!me || !appKey || busy || keyState !== "active") return;
    setBusy("revoke");
    setError(null);
    try {
      const out = await chain.sendTransaction(
        {
          signerId: me.accountId,
          receiverId: me.accountId,
          actions: [actions.deleteKey(appKey)],
        },
        { pace },
      );
      if (out.status.type === "Failure") {
        setError(out.status.error.message);
        return;
      }
      const info = await readKey(appKey, me.accountId);
      if (info) {
        setError("The key is still on the chain. Please try again.");
        return;
      }
      forgetKey(me.accountId, appKey);
      setTxHash(out.transaction.hash);
      setKeyState("revoked");
      setAim(null);
      setSays("The app's key is deleted. Try Count once more: the chain will refuse it.");
      setBalance((await chain.viewAccount(me.accountId)).amount);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  const state = [
    `step:${step}`,
    `key:${keyState}`,
    `counter:${counter}`,
    `refused:${refused.length}`,
    `gone:${goneShown ? "shown" : "no"}`,
    `error:${error ? "yes" : "no"}`,
    `network:${chain.network}`,
  ].join(";");

  let status: string | null = null;
  if (error) status = null;
  else if (step === ADD)
    status =
      keyState !== "none"
        ? "The chain holds the key. Press Next."
        : busy === "add"
          ? "Adding the key…"
          : "Set an allowance, then add the key.";
  else if (step === CALL)
    status =
      keyState === "none"
        ? "Give the app its key first (step 3)."
        : counted
          ? "It worked. Press Next."
          : null;
  else if (step === ATTACK)
    status =
      keyState === "none"
        ? "Give the app its key first (step 3)."
        : refused.length >= ATTACKS.length
          ? "All three refused. Press Next."
          : `${refused.length} of ${ATTACKS.length} refused.`;
  else if (step === REVOKE && keyState === "revoked")
    status = goneShown ? "The deleted key was refused. Press Next." : "The key is deleted. Press Next.";

  return {
    step,
    network: chain.network,
    me,
    balance,
    allowanceText,
    allowanceProblem,
    setAllowanceText: (t: string) => {
      setAllowanceText(t);
      setAllowanceProblem(null);
    },
    keyInfo,
    appKey,
    initial,
    /** What the allowance gauges are measured against: the start, or what the key had when picked up. */
    gaugeFrom: initial ?? resumedAllowance,
    left,
    keyState,
    counter,
    attempts,
    refused,
    goneShown,
    says,
    aim,
    busy,
    error,
    passed,
    pass: () => setPassed(true),
    state,
    status,
    canAdd: step === ADD && keyState === "none" && busy === null && !!me,
    canCount: step === CALL && keyState === "active" && busy === null,
    canAttack: step === ATTACK && keyState === "active" && busy === null,
    canRevoke: step === REVOKE && keyState === "active" && busy === null,
    canCountAgain: step === REVOKE && keyState === "revoked" && busy === null && !goneShown,
    addKey,
    tryIt,
    revoke,
    otherContract: OTHER_CONTRACT,
    thief: THIEF,
  };
}

function message(e: unknown): string {
  return isChainError(e) ? e.message : "Something went wrong. Please try again.";
}
