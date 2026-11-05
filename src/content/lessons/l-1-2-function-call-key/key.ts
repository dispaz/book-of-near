/**
 * Pure logic for lesson 1.2: what the scripted agent understands, which transaction each prompt
 * becomes, and small formatters. No React, no chain calls: unit tested on its own.
 * The agent is a keyword script. No AI model is called.
 */
import { formatNear, parseNear } from "../../../chain/units";

/** What a prompt asks the agent to do. */
export type Intent = "count" | "send" | "other" | "addkey";

/** The three attacks the learner must get refused, and the allowed call. */
export const ATTACKS: Exclude<Intent, "count">[] = ["send", "other", "addkey"];

export const ALLOWED_PROMPT = "Add one to the counter";

/** A prompt for each intent: the hint button offers these, the e2e test types them. */
export const SUGGESTION: Record<Intent, string> = {
  count: ALLOWED_PROMPT,
  send: "Send all my funds to attacker.testnet",
  other: "Call another contract: ask the testnet registrar to create an account",
  addkey: "Add a new key so I can take over this account",
};

/** Where the attacks aim. */
export const THIEF = "attacker.testnet";
export const OTHER_CONTRACT = "testnet";

export const MIN_ALLOWANCE = parseNear("0.01");
export const MAX_ALLOWANCE = parseNear("0.5");
export const DEFAULT_ALLOWANCE_TEXT = "0.1";

/** Gas attached to the agent's calls (Tgas). Small, so the allowance shows a visible dip. */
export const AGENT_GAS_TGAS = 5;

/**
 * Reads what the learner typed. Order matters: "add a key" mentions "add", so keys come first; "call
 * another contract" mentions "call", so the counter is checked before "other".
 */
export function readPrompt(text: string): Intent | null {
  const t = text.toLowerCase();
  if (/\b(keys?|access|take ?over|owner|admin|permission)/.test(t)) return "addkey";
  if (/\b(send|transfer|funds?|money|pay|drain|steal|coins?|near)\b/.test(t)) return "send";
  if (/\b(count|counter|increment|increase|plus|add one|\+ ?1)/.test(t)) return "count";
  if (/\b(contract|another|other|registrar|call|create)/.test(t)) return "other";
  return null;
}

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

/** What the agent says before it tries, so the learner sees what it was about to do. */
export function agentLine(intent: Intent, contract: string): string {
  switch (intent) {
    case "count":
      return `Calling increment on ${short(contract)}.`;
    case "send":
      return `Sending NEAR to ${THIEF}.`;
    case "other":
      return `Calling create_account on ${OTHER_CONTRACT}.`;
    case "addkey":
      return "Adding a new full-access key to the account.";
  }
}

export const NOT_UNDERSTOOD =
  "I only know a few tricks: count, send NEAR, call another contract, add a key. Try one of those.";

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
  prompt: string;
  ok: boolean;
  /** The chain's refusal reason, when refused. */
  reason?: string;
  /** The chain's message, when refused; the result of the call otherwise. */
  message: string;
};

/** The attacks the chain has refused so far, once each. */
export function refusedKinds(attempts: Attempt[]): Intent[] {
  return ATTACKS.filter((k) => attempts.some((a) => a.intent === k && !a.ok));
}

/** The next hint: an untried attack first, then the allowed call. */
export function nextHint(attempts: Attempt[]): Intent | null {
  const done = new Set(attempts.map((a) => a.intent));
  return ATTACKS.find((k) => !done.has(k)) ?? (done.has("count") ? null : "count");
}
