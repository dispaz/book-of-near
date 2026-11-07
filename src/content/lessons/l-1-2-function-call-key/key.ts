/**
 * Pure logic for lesson 1.2 (topic: docs/lessons/stage-1/1.2-topic.md): what the Counter app can be made
 * to try with its function-call key, what each try asks the chain to do, and small formatters. No React,
 * no chain calls: unit tested on its own. The app is played by the lesson itself; nothing else is called.
 */
import { formatNear, parseNear } from "../../../chain/units";

/** What a transaction signed with the app's key tries to do. */
export type Intent = "count" | "send" | "other" | "addkey";

/** The three things a hacked app should not be able to do, in the order the buttons show them. */
export const ATTACKS: Exclude<Intent, "count">[] = ["send", "other", "addkey"];

/** The button for each try. */
export const ATTEMPT_LABEL: Record<Intent, string> = {
  count: "Count",
  send: "Send NEAR to the attacker",
  other: "Call another contract",
  addkey: "Add a full-access key for the attacker",
};

/** Short button labels for phones (the full label stays the button's accessible name). */
export const ATTEMPT_SHORT: Record<Intent, string> = {
  count: "Count",
  send: "Send NEAR",
  other: "Other contract",
  addkey: "Add a key",
};

/** Where the attacks aim. */
export const THIEF = "attacker.testnet";
export const OTHER_CONTRACT = "testnet";

export const MIN_ALLOWANCE = parseNear("0.01");
export const MAX_ALLOWANCE = parseNear("0.5");
export const DEFAULT_ALLOWANCE_TEXT = "0.1";

/** Gas attached to the app's calls (Tgas). Small, so the allowance shows a visible dip. */
export const APP_GAS_TGAS = 5;

export type AllowanceRead = { ok: true; amount: bigint } | { ok: false; problem: string };

/** The allowance field: 0.01 to 0.5 NEAR. */
export function readAllowance(text: string): AllowanceRead {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return { ok: false, problem: "Type a number, for example 0.1." };
  const amount = parseNear(t);
  if (amount < MIN_ALLOWANCE || amount > MAX_ALLOWANCE)
    return { ok: false, problem: "Pick an allowance from 0.01 to 0.5 NEAR." };
  return { ok: true, amount };
}

/** "0.094" style: up to 4 decimals, no trailing zeros. */
export function near(amount: bigint): string {
  return formatNear(amount, 4);
}

/** Short form of a long account id: "cf4342…c3c5". */
export function short(id: string, head = 6, tail = 4): string {
  return id.length > head + tail + 1 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}

/** What the transaction signed with the app's key asks the chain to do. */
export function appLine(intent: Intent, account: string): string {
  switch (intent) {
    case "count":
      return `The app calls increment on the counter at ${short(account)}.`;
    case "send":
      return `Signed with the app's key: send NEAR to ${THIEF}.`;
    case "other":
      return `Signed with the app's key: call create_account on ${OTHER_CONTRACT}.`;
    case "addkey":
      return "Signed with the app's key: add a full-access key to your account.";
  }
}

/** The chain's refusal reasons, in plain words for the log. */
export const REASON_TEXT: Record<string, string> = {
  RequiresFullAccess: "This key may only call contract methods. It cannot send NEAR or change keys.",
  ReceiverMismatch: "This key may call only one contract, and this is another.",
  MethodNameMismatch: "This key may not call that method.",
  DepositWithFunctionCall: "This key cannot attach NEAR to a call.",
  NotEnoughAllowance: "The key's allowance is used up.",
  AccessKeyNotFound: "The account has no such key. It was deleted.",
};

export type Attempt = {
  id: number;
  intent: Intent;
  /** The button the learner pressed. */
  label: string;
  ok: boolean;
  /** The chain's refusal reason. Set only when the chain refused the transaction (not when it ran and failed). */
  reason?: string;
  /** The chain's message, when refused; the result of the call otherwise. */
  message: string;
  /** Tried after the key was deleted. */
  afterDelete?: boolean;
};

/** The attacks the chain has refused so far, once each. */
export function refusedKinds(attempts: Attempt[]): Intent[] {
  return ATTACKS.filter((k) => attempts.some((a) => a.intent === k && !a.ok && a.reason && !a.afterDelete));
}

/** True once a Count signed with the deleted key was refused because the key no longer exists. */
export function keyGoneShown(attempts: Attempt[]): boolean {
  return attempts.some((a) => a.afterDelete && !a.ok && a.reason === "AccessKeyNotFound");
}
