/**
 * Lesson 1.2 after a reload: the chain still holds the app's key, so the lesson picks it up again (a key
 * must not be orphaned). The chain cannot say what the key's allowance was at the start or which
 * transaction added it, so the lesson remembers both in this browser when it adds the key. Storage may be
 * blocked: then they are simply unknown (null). Everything on chain goes through the Chain interface.
 */
import type { AccessKeyInfo, AccountId, Chain, PublicKey } from "../../../chain/types";

/** What the lesson remembers about the key it added. */
export type KeyMemo = { allowance: bigint; addKeyTxHash?: string };

export type ResumedKey = {
  key: PublicKey;
  info: AccessKeyInfo;
  /** The counter's value, or null if it could not be read. */
  counter: number | null;
  /** The allowance the key was added with; null when this browser did not remember it. */
  initial: bigint | null;
  /** The transaction that added the key; null when this browser did not remember it. */
  addKeyTxHash: string | null;
};

type GetStorage = () => Storage | undefined;
const defaultStorage: GetStorage = () => globalThis.localStorage;

const slot = (account: AccountId, key: PublicKey) => `bon:l-1-2:key:${account}:${key}`;

export function rememberKey(
  account: AccountId,
  key: PublicKey,
  memo: KeyMemo,
  storage: GetStorage = defaultStorage,
): void {
  try {
    storage()?.setItem(
      slot(account, key),
      JSON.stringify({ allowance: memo.allowance.toString(), addKeyTxHash: memo.addKeyTxHash }),
    );
  } catch {
    // Storage blocked: after a reload the original allowance is unknown, which the lesson handles.
  }
}

export function forgetKey(account: AccountId, key: PublicKey, storage: GetStorage = defaultStorage): void {
  try {
    storage()?.removeItem(slot(account, key));
  } catch {
    // Nothing to forget.
  }
}

function recall(account: AccountId, key: PublicKey, storage: GetStorage): KeyMemo | null {
  try {
    const raw = storage()?.getItem(slot(account, key));
    if (!raw) return null;
    const v = JSON.parse(raw) as { allowance?: unknown; addKeyTxHash?: unknown };
    if (typeof v.allowance !== "string" || !/^\d+$/.test(v.allowance)) return null;
    return {
      allowance: BigInt(v.allowance),
      ...(typeof v.addKeyTxHash === "string" ? { addKeyTxHash: v.addKeyTxHash } : {}),
    };
  } catch {
    return null;
  }
}

/** A function-call key on `account` that targets the account itself (the app's key from an earlier visit). */
export async function findResumableKey(
  chain: Chain,
  account: AccountId,
  storage: GetStorage = defaultStorage,
): Promise<ResumedKey | null> {
  const keys = await chain.listKeys(account).catch(() => []);
  const info = keys.find((k) => k.permission.type === "FunctionCall" && k.permission.receiverId === account);
  if (!info) return null;
  const num = await chain.viewCall(account, "get_num", {}).catch(() => null);
  const memo = recall(account, info.publicKey, storage);
  return {
    key: info.publicKey,
    info,
    counter: num ? Number(num.result) : null,
    initial: memo?.allowance ?? null,
    addKeyTxHash: memo?.addKeyTxHash ?? null,
  };
}
