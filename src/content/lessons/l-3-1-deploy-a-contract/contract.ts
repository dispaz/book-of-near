/**
 * Pure helpers for lesson 3.1: where the contract lives, what storage staking locks, what the Wasm file
 * looks like. No chain access and no React here; the lesson state (useDeploy.ts) goes through useChain().
 */
import { accountIdProblem, isEthImplicitAccountId, isImplicitAccountId } from "../../../chain/accountId";
import { formatNear, parseNear, tgas } from "../../../chain/units";
import type { AccountId, Yocto } from "../../../chain/types";

/** Storage staking: 1 NEAR per 100 KB, i.e. 10^19 yoctoNEAR per byte (docs: storage staking). */
export const STORAGE_YOCTO_PER_BYTE = 10n ** 19n;
/** What the batch sends the new contract account: room for its code's deposit and a little state. */
export const CONTRACT_FUNDING = parseNear("0.05");
/** What a fresh named parent gets when the practice account is a hex id (it pays for the batch above). */
export const PARENT_FUNDING = parseNear("0.3");
/** Gas for a plain call (increment, reset). */
export const CALL_GAS = tgas(30);
/** Gas for call_other: its own work plus 20 Tgas for `fail` and 20 Tgas for the callback. */
export const CALLBACK_GAS = tgas(100);
/** The sub-account's first label. */
export const LABEL = "counter";

export interface StorageView {
  amount: Yocto;
  locked: Yocto;
  storageUsage: number;
}

/** NEAR an account must keep for `bytes` of storage. */
export function storageLock(bytes: number): Yocto {
  return BigInt(bytes) * STORAGE_YOCTO_PER_BYTE;
}

/** Spendable NEAR: the balance minus the storage deposit (the part staking does not already cover). */
export function availableOf(v: StorageView): Yocto {
  const need = storageLock(v.storageUsage) - v.locked;
  return v.amount - (need > 0n ? need : 0n);
}

/** The balance gauge: locked for storage vs available, and the locked share of the balance (0..1). */
export function gaugeOf(v: StorageView | null): { lock: Yocto; available: Yocto; share: number } {
  if (!v || v.amount <= 0n) return { lock: 0n, available: 0n, share: 0 };
  const lock = storageLock(v.storageUsage);
  const available = availableOf(v);
  const share = Number((lock * 10_000n) / v.amount) / 10_000;
  return { lock, available, share: Math.max(0, Math.min(1, share)) };
}

/** NEAR for people: up to 5 decimals, so a few bytes of storage still show. */
export const nearText = (yocto: Yocto) => formatNear(yocto, 5);

export const bytesText = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "byte" : "bytes"}`;

/**
 * The contract's account, `counter.<parent>`, or null when `parent` cannot have one: a hex (implicit)
 * account has no sub-accounts, and no account id may pass 64 characters.
 */
export function contractIdFor(parent: AccountId): AccountId | null {
  if (isImplicitAccountId(parent) || isEthImplicitAccountId(parent)) return null;
  const id = `${LABEL}.${parent}`;
  return accountIdProblem(id) ? null : id;
}

/** A fresh short top-level name for a parent (`bon-xxxxxxxx.testnet`). `random` returns [0, 1). */
export function newParentName(random: () => number = Math.random): AccountId {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[Math.floor(random() * abc.length) % abc.length];
  return `bon-${s}.testnet`;
}

/** What the scroll shows of the Wasm file: its size and first 8 bytes (magic `\0asm` + version 1). */
export function wasmFacts(bytes: Uint8Array): { size: number; header: string; isWasm: boolean } {
  const head = Array.from(bytes.slice(0, 8), (b) => b.toString(16).padStart(2, "0"));
  return {
    size: bytes.length,
    header: head.join(" "),
    isWasm: head.slice(0, 4).join("") === "0061736d",
  };
}
