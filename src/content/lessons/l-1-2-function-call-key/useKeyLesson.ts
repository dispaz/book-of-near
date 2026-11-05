/**
 * The ONE state of lesson 1.2, shared by the 2D and the 3D view. Everything on chain goes through
 * useChain(). The "agent" is a keyword script (key.ts): it turns a prompt into a transaction and signs it
 * with the limited key, and the chain accepts or refuses. No three.js here, so 2D never loads 3D code.
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
  AGENT_GAS_TGAS,
  ATTACKS,
  DEFAULT_ALLOWANCE_TEXT,
  NOT_UNDERSTOOD,
  OTHER_CONTRACT,
  SUGGESTION,
  THIEF,
  agentLine,
  near,
  nextHint,
  readAllowance,
  readPrompt,
  refusedKinds,
  ALLOWED_PROMPT,
  type Attempt,
  type Intent,
} from "./key";

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
  const [agentKey, setAgentKey] = useState<PublicKey | null>(null);
  const [keyInfo, setKeyInfo] = useState<AccessKeyInfo | null>(null);
  const [initial, setInitial] = useState<bigint | null>(null);
  const [keyState, setKeyState] = useState<KeyState>("none");
  const [counter, setCounter] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [prompt, setPrompt] = useState(ALLOWED_PROMPT);
  const [says, setSays] = useState<string | null>(null);
  const [aim, setAim] = useState<Intent | null>(null);
  const [hints, setHints] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [noHints, setNoHints] = useState(false);
  const [busy, setBusy] = useState<null | "add" | "ask" | "revoke">(null);
  const [error, setError] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

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
        // A reload must not orphan a key from an earlier visit: pick up a function-call key that
        // targets this account, so the learner can use it and delete it.
        const keys = await chain.listKeys(acc.accountId).catch(() => []);
        const found = keys.find(
          (k) => k.permission.type === "FunctionCall" && k.permission.receiverId === acc.accountId,
        );
        if (found && live) {
          const num = await chain.viewCall(acc.accountId, "get_num", {}).catch(() => null);
          if (!live) return;
          setAgentKey(found.publicKey);
          setKeyInfo(found);
          if (found.permission.type === "FunctionCall") setInitial(found.permission.allowance ?? null);
          setKeyState("active");
          if (num) setCounter(Number(num.result));
        }
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
  const shownAllowance = initial ?? (typed.ok ? typed.amount : null);
  const varsRef = useRef(setVars);
  varsRef.current = setVars;
  const allowanceVar = shownAllowance !== null ? near(shownAllowance) : undefined;
  // After the key is deleted the chain no longer lists it: keep the last allowance we saw.
  const lastLeft = useRef<bigint | null>(null);
  if (left !== null) lastLeft.current = left;
  const leftVar = lastLeft.current !== null ? near(lastLeft.current) : undefined;
  useEffect(() => {
    const v: Record<string, string> = {};
    if (allowanceVar) v.allowance = allowanceVar;
    if (leftVar) v.left = leftVar;
    else if (allowanceVar) v.left = allowanceVar;
    varsRef.current?.(v);
  }, [allowanceVar, leftVar]);

  // Evidence for the completion record: never keys, only counts and a transaction hash.
  const evidenceRef = useRef(reportEvidence);
  evidenceRef.current = reportEvidence;
  useEffect(() => {
    if (!txHash) return;
    evidenceRef.current?.({
      txHash,
      hintsUsed: String(hints),
      noHintMode: noHints ? "on" : "off",
      refusedAttacks: String(refused.length),
    });
  }, [txHash, hints, noHints, refused.length]);

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
      setAgentKey(key);
      setInitial(r.amount);
      setTxHash(out.transaction.hash);
      setKeyState("active");
      await refresh(me.accountId, key);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  /** What each intent asks the chain to do, signed with the agent's limited key. */
  async function requestFor(intent: Intent, key: PublicKey, account: string): Promise<TransactionRequest> {
    const gas = tgas(AGENT_GAS_TGAS);
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
              { new_account_id: "agent-made.testnet", new_public_key: key },
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

  async function ask() {
    if (!me || !agentKey || busy || keyState !== "active") return;
    const text = prompt.trim();
    const intent = readPrompt(text);
    if (!intent) {
      setSays(NOT_UNDERSTOOD);
      return;
    }
    setBusy("ask");
    setError(null);
    setAim(intent);
    setSays(agentLine(intent, me.accountId));
    const id = attempts.length + 1;
    try {
      const out = await chain.sendTransaction(await requestFor(intent, agentKey, me.accountId), { pace });
      const failed = out.status.type === "Failure";
      const msg = out.status.type === "Failure" ? out.status.error.message : "The chain accepted it.";
      // Included but failed: no `reason` (only refused transactions have one), so it is not a refused attack.
      setAttempts((a) => [...a, { id, intent, prompt: text, ok: !failed, message: msg }]);
      setSays(
        failed
          ? `The chain included it, but it failed: ${msg} It does not count as a refused attack. The gas was still paid.`
          : "Done. The chain accepted it.",
      );
      await refresh(me.accountId, agentKey);
    } catch (e) {
      if (isChainError(e) && e.kind === "InvalidTransaction") {
        setAttempts((a) => [
          ...a,
          { id, intent, prompt: text, ok: false, reason: e.reason, message: e.message },
        ]);
        setSays(`Refused by the chain: ${e.message}`);
      } else {
        setError(message(e));
      }
    } finally {
      setBusy(null);
      setPrompt(intent === "count" ? ALLOWED_PROMPT : "");
    }
  }

  async function revoke() {
    if (!me || !agentKey || busy || keyState !== "active") return;
    setBusy("revoke");
    setError(null);
    try {
      const out = await chain.sendTransaction(
        {
          signerId: me.accountId,
          receiverId: me.accountId,
          actions: [actions.deleteKey(agentKey)],
        },
        { pace },
      );
      if (out.status.type === "Failure") {
        setError(out.status.error.message);
        return;
      }
      const info = await readKey(agentKey, me.accountId);
      if (info) {
        setError("The key is still on the chain. Please try again.");
        return;
      }
      setTxHash(out.transaction.hash);
      setKeyState("revoked");
      setAim(null);
      setSays("My key is gone. Anything I sign now is refused.");
      setBalance((await chain.viewAccount(me.accountId)).amount);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  function showHint() {
    if (noHints) return;
    const next = nextHint(attempts);
    setHints((h) => h + 1);
    setHint(next ? SUGGESTION[next] : "You have tried everything. Press Next.");
  }

  const state = [
    `step:${step}`,
    `key:${keyState}`,
    `counter:${counter}`,
    `refused:${refused.length}`,
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
      keyState === "none" ? "Add the agent's key first (step 3)." : counted ? "It worked. Press Next." : null;
  else if (step === ATTACK)
    status =
      keyState === "none"
        ? "Add the agent's key first (step 3)."
        : refused.length >= ATTACKS.length
          ? "Three attacks refused. Press Next."
          : `${refused.length} of ${ATTACKS.length} attacks refused.`;
  else if (step === REVOKE && keyState === "revoked") status = "The key is revoked. Press Next.";

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
    agentKey,
    initial,
    left,
    keyState,
    counter,
    attempts,
    refused,
    prompt,
    setPrompt,
    says,
    aim,
    hints,
    hint,
    noHints,
    setNoHints: (on: boolean) => {
      setNoHints(on);
      if (on) setHint(null);
    },
    busy,
    error,
    passed,
    pass: () => setPassed(true),
    state,
    status,
    canAdd: step === ADD && keyState === "none" && busy === null && !!me,
    canAsk: (step === CALL || step === ATTACK) && keyState === "active" && busy === null,
    canRevoke: step === REVOKE && keyState === "active" && busy === null,
    addKey,
    ask,
    revoke,
    showHint,
    otherContract: OTHER_CONTRACT,
    thief: THIEF,
  };
}

function message(e: unknown): string {
  return isChainError(e) ? e.message : "Something went wrong. Please try again.";
}
