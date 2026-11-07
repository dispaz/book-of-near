/**
 * Pure helpers for lesson 1.3: the workshop account's name, the builder's items and what happened to each
 * action. No chain access here; the scene goes through useChain().
 */
import { accountIdProblem } from "../../../chain/accountId";
import { isChainError } from "../../../chain/errors";
import { actions } from "../../../chain/ops";
import type { Action, PublicKey, TxOutcome } from "../../../chain/types";
import { formatNear, parseNear } from "../../../chain/units";

/** What the practice account sends the workshop account through the registrar (script, section 6). */
export const WORKSHOP_DEPOSIT = parseNear("0.1");
export const MIN_AMOUNT = parseNear("0.01");
export const MAX_AMOUNT = parseNear("0.05");
export const DEFAULT_AMOUNT_TEXT = "0.02";
export const DEFAULT_LABEL = "shop";

/** "tx-" + the first six letters or digits of the practice account, and "-2", "-3"… if taken. */
export function workshopLabel(practiceId: string, attempt = 1): string {
  // Helper-made practice accounts are all called bon-<random>.testnet: skip the shared prefix.
  const head = practiceId
    .replace(/^bon-/, "")
    .replace(/[^a-z\d]/g, "")
    .slice(0, 6);
  return `tx-${head}${attempt > 1 ? `-${attempt}` : ""}`;
}

export type LabelRead = { ok: true; id: string } | { ok: false; problem: string };

/** The new account's name: the part before `.<workshop>`. */
export function readLabel(text: string, parent: string): LabelRead {
  const label = text.trim().toLowerCase();
  if (!label) return { ok: false, problem: "Type a name, such as shop." };
  if (label.includes(".")) return { ok: false, problem: "Leave out the dot. The app adds it." };
  const id = `${label}.${parent}`;
  const problem = accountIdProblem(id);
  return problem ? { ok: false, problem } : { ok: true, id };
}

export type AmountRead = { ok: true; amount: bigint } | { ok: false; problem: string };

/** The amount box: 0.01 to 0.05 NEAR. */
export function readAmount(text: string): AmountRead {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return { ok: false, problem: "Type a number, for example 0.02." };
  const amount = parseNear(t);
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT)
    return { ok: false, problem: "Pick an amount from 0.01 to 0.05 NEAR." };
  return { ok: true, amount };
}

/** One row of the builder. "again" adds the batch's last key a second time, so it fails. */
export type ItemKind = "create" | "transfer" | "addkey" | "again";
export interface Item {
  id: number;
  kind: ItemKind;
}

export const ITEM_NAME: Record<ItemKind, string> = {
  create: "Create account",
  transfer: "Send NEAR",
  addkey: "Add a key",
  again: "Add that key again",
};

/** A short name for an action, written on its slab in the 3D view. */
export const SHORT_NAME: Record<ItemKind, string> = {
  create: "create",
  transfer: "send",
  addkey: "key",
  again: "same key",
};

/** The text on a row, with the learner's own values. */
export function itemText(kind: ItemKind, amount: string, receiver: string): string {
  switch (kind) {
    case "create":
      return `Create account ${receiver}`;
    case "transfer":
      return `Send ${amount} NEAR`;
    case "addkey":
      return "Add a key (full access)";
    case "again":
      return "Add the same key again";
  }
}

/** Moves item `i` by `by` (-1 up, +1 down). Out of range: unchanged. */
export function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function hasAllKinds(list: Item[]): boolean {
  return (["create", "transfer", "addkey"] as const).every((k) => list.some((i) => i.kind === k));
}

/**
 * The chain actions for the builder's rows. Each "addkey" uses the next fresh key from `keys`; "again"
 * repeats the last key added before it (or the first fresh key, if none was added yet).
 */
export function toActions(list: Item[], amount: bigint, keys: PublicKey[]): Action[] {
  let next = 0;
  let last: PublicKey | null = null;
  return list.map((item) => {
    switch (item.kind) {
      case "create":
        return actions.createAccount();
      case "transfer":
        return actions.transfer(amount);
      case "addkey": {
        last = keys[next++] ?? keys[0]!;
        return actions.addFullAccessKey(last);
      }
      case "again":
        return actions.addFullAccessKey(last ?? keys[0]!);
    }
  });
}

/** How many fresh keys a batch needs. */
export const keysNeeded = (list: Item[]) => Math.max(1, list.filter((i) => i.kind === "addkey").length);

export type Fate = "done" | "undone" | "failed" | "skipped";

export const FATE_TEXT: Record<Fate, string> = {
  done: "Done",
  undone: "Ran, then undone",
  failed: "Failed",
  skipped: "Never ran",
};

/** What happened to each of `count` actions: all done, or undone up to the failing one. */
export function fates(count: number, out: Pick<TxOutcome, "status">): Fate[] {
  const s = out.status;
  if (s.type !== "Failure") return Array.from({ length: count }, () => "done");
  // A storage shortfall is checked after every action ran (nearcore gives it no action index), so all
  // of them ran and all were undone.
  if (s.error.type === "ActionError" && s.error.kind.type === "LackBalanceForState")
    return Array.from({ length: count }, () => "undone");
  const at = s.error.type === "ActionError" ? (s.error.index ?? 0) : 0;
  return Array.from({ length: count }, (_, i) => (i < at ? "undone" : i === at ? "failed" : "skipped"));
}

/** Names to try for a new account, in order: `shop`, `shop2`, `shop3`… (from `start`; 1 = the bare name). */
export function labelCandidates(base: string, start = 1, count = 20): string[] {
  return Array.from({ length: count }, (_, i) => (start + i === 1 ? base : `${base}${start + i}`));
}

/** The end of the "break it" note: what happens to the NEAR the batch sent. */
export function comesBack(deposit: bigint): string {
  return deposit > 0n
    ? `and the NEAR sent to it (${near(deposit)} NEAR) comes back`
    : "and no NEAR was sent to it, so none moves";
}

/** The workshop account and the id of the transaction that made it, as kept in the browser. */
export interface Remembered {
  id: string;
  txHash: string;
}

/** Reads what the lesson kept in localStorage; anything malformed is ignored. */
export function readRemembered(raw: string | null): Remembered | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const { id, txHash } = v as Record<string, unknown>;
    if (typeof id !== "string" || accountIdProblem(id)) return null;
    if (typeof txHash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(txHash)) return null;
    return { id, txHash };
  } catch {
    return null;
  }
}

/** The NEAR a batch sends: the amount once per Send row. */
export function deposited(list: Item[], amount: bigint): bigint {
  return BigInt(list.filter((i) => i.kind === "transfer").length) * amount;
}

/**
 * A failure that shows a roll back: something ran and was undone, on an account that did not exist
 * before and still does not. A failure at the first action, or on an existing account, undoes nothing.
 */
export function isRollback(s: {
  ok: boolean;
  fates: Fate[];
  existedBefore: boolean;
  existsAfter: boolean;
}): boolean {
  return !s.ok && s.fates.includes("undone") && !s.existedBefore && !s.existsAfter;
}

/** A plain message and a way forward when an account is short of NEAR; null for other errors. */
export function balanceProblem(
  e: unknown,
  who: string,
  fix = "Lower the amount, or continue in demo mode, which needs no NEAR.",
): string | null {
  if (!isChainError(e) || (e.reason !== "NotEnoughBalance" && e.reason !== "LackBalanceForState"))
    return null;
  return `${who} has too little NEAR left for this. ${fix}`;
}

/** "0.0194" style: up to 4 decimals. */
export const near = (x: bigint) => formatNear(x, 4);

/** Short form of a long id or hash: "cf4342…c3c5". */
export function short(id: string, head = 6, tail = 4): string {
  return id.length > head + tail + 1 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}

/** One action in plain words, for the transaction's field list. */
export function describeAction(a: Action): string {
  switch (a.type) {
    case "CreateAccount":
      return "CreateAccount";
    case "Transfer":
      return `Transfer ${near(a.deposit)} NEAR`;
    case "AddKey":
      return `AddKey ${short(a.publicKey, 12, 4)}`;
    case "DeleteKey":
      return `DeleteKey ${short(a.publicKey, 12, 4)}`;
    case "DeployContract":
      return "DeployContract";
    case "DeleteAccount":
      return `DeleteAccount → ${a.beneficiaryId}`;
    case "FunctionCall":
      return `FunctionCall ${a.methodName}${a.deposit > 0n ? ` with ${near(a.deposit)} NEAR` : ""}`;
  }
}
