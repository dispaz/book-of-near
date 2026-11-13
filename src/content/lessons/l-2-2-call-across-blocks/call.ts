/**
 * Lesson 2.2's model of one cross-contract call: the transaction, then each receipt in the order it ran,
 * block by block. Pure: no React, no three.js. Read from a TxOutcome (demo mode) or a recorded real
 * testnet call (recorded.ts). Topic: docs/lessons/stage-2/2.2-topic.md.
 */
import type { TxOutcome } from "../../../chain/types";
import { formatTgas } from "../../../chain/units";

/**
 * transaction: the signed transaction, run on the signer's shard. call: an action receipt that runs a
 * method. callback: the action receipt that waited for the called contract's answer (its data receipt).
 * refund: unused gas going back to the signer.
 */
export type HopKind = "transaction" | "call" | "callback" | "refund";

export interface Hop {
  index: number;
  kind: HopKind;
  /** Transaction hash or receipt id. */
  id: string;
  from: string;
  to: string;
  /** The method it runs; null for a refund or a plain transaction step. */
  method: string | null;
  shardId: number;
  blockHeight: number;
  gasBurnt: bigint;
  ok: boolean;
  /** Its logs, or the error, in plain words. */
  note: string;
}

export type CallSource = "demo" | "recorded" | "illustration";

export interface CrossCall {
  txHash: string;
  source: CallSource;
  signerId: string;
  /** Contract A: the transaction's receiver, which calls B and gets the callback. */
  caller: string;
  /** Contract B: the contract A calls. */
  callee: string;
  /** Gas the signer attached to the transaction. */
  attachedGas: bigint;
  hops: Hop[];
  /** Every contract receipt worked. */
  ok: boolean;
  /** Hops between the two contracts: A → B (action receipt) and B → A (data receipt to the callback). */
  receiptHops: number;
}

/** Read a finished cross-contract call from the chain's outcome. */
export function callFromOutcome(out: TxOutcome, source: CallSource): CrossCall {
  const tx = out.transaction;
  const caller = tx.receiverId;
  const first = tx.actions[0];
  const t = out.transactionOutcome;
  const hops: Hop[] = [
    {
      index: 0,
      kind: "transaction",
      id: tx.hash,
      from: tx.signerId,
      to: caller,
      method: first?.type === "FunctionCall" ? first.methodName : null,
      shardId: t.shardId,
      blockHeight: t.blockHeight,
      gasBurnt: t.gasBurnt,
      ok: t.status.type !== "Failure",
      note: "Signed and checked on the signer's shard; turned into a receipt for the contract.",
    },
  ];
  for (const r of out.receipts) {
    const a = r.actions[0];
    const method = a?.type === "FunctionCall" ? a.methodName : null;
    const kind: HopKind = r.isRefund
      ? "refund"
      : r.predecessorId === r.receiverId && r.receiverId === caller
        ? "callback"
        : "call";
    const ok = r.status.type !== "Failure";
    const note =
      r.status.type === "Failure"
        ? r.status.error.message
        : r.isRefund
          ? "Unused gas back to the signer."
          : r.logs.join(" ") || "Done.";
    hops.push({
      index: hops.length,
      kind,
      id: r.id,
      from: r.predecessorId,
      to: r.receiverId,
      method,
      shardId: r.shardId,
      blockHeight: r.blockHeight,
      gasBurnt: r.gasBurnt,
      ok,
      note,
    });
  }
  return finish({
    txHash: tx.hash,
    source,
    signerId: tx.signerId,
    caller,
    attachedGas: first?.type === "FunctionCall" ? first.gas : 0n,
    hops,
  });
}

/** Fill in what follows from the hops: the callee, success and the number of hops between contracts. */
export function finish(c: Omit<CrossCall, "callee" | "ok" | "receiptHops">): CrossCall {
  const contract = c.hops.filter((h) => h.kind === "call" || h.kind === "callback");
  const callee = contract.find((h) => h.from === c.caller && h.to !== c.caller)?.to ?? c.caller;
  const receiptHops =
    contract.filter((h) => h.kind === "call" && h.from === c.caller && h.to !== c.caller).length +
    contract.filter((h) => h.kind === "callback").length;
  return { ...c, callee, ok: contract.every((h) => h.ok), receiptHops };
}

/** The receipts that ran contract code, in order: A's method, B's method, A's callback. */
export function contractHops(c: CrossCall): Hop[] {
  return c.hops.filter((h) => h.kind === "call" || h.kind === "callback");
}

export interface GasUse {
  /** Gas burnt by the whole transaction, refunds included: the fee. */
  total: bigint;
  /** Gas burnt running the contracts' receipts. All of it is burned. */
  contractGas: bigint;
  /** The gas each contract's receipts burnt, in the order the contracts first ran. */
  byContract: { accountId: string; gas: bigint }[];
}

/**
 * Where the call's gas went, exact from its own receipts. All of it is burned: the 30% contract reward
 * ended with protocol version 87 (topic, NEAR docs; mainnet and testnet report burnt_gas_reward 0).
 */
export function gasUse(c: CrossCall): GasUse {
  const total = c.hops.reduce((s, h) => s + h.gasBurnt, 0n);
  const by = new Map<string, bigint>();
  for (const h of contractHops(c)) by.set(h.to, (by.get(h.to) ?? 0n) + h.gasBurnt);
  const byContract = [...by].map(([accountId, gas]) => ({ accountId, gas }));
  const contractGas = byContract.reduce((s, b) => s + b.gas, 0n);
  return { total, contractGas, byContract };
}

const num = (n: number) => n.toLocaleString("en-US");

/** The learner's own numbers for the manifest's placeholders. */
export function varsFor(c: CrossCall): Record<string, string> {
  const [, b, cb] = contractHops(c);
  const g = gasUse(c);
  return {
    firstBlock: b ? num(b.blockHeight) : "?",
    secondBlock: cb ? num(cb.blockHeight) : "?",
    gasSpent: formatTgas(g.contractGas),
  };
}

/**
 * Testnet mode has no shop that fails on demand, so the failure step draws the recorded call's shape with
 * the called contract failing. It is marked as an illustration and never sent.
 */
export function illustrateFailure(c: CrossCall): CrossCall {
  const callee = c.callee;
  const hops = c.hops.map((h): Hop => {
    if (h.kind === "call" && h.to === callee)
      return { ...h, ok: false, note: "Fails with an error (illustration, not a real receipt)." };
    if (h.kind === "callback")
      return {
        ...h,
        note: "Is told the call failed, and must undo the caller's own changes (illustration).",
      };
    return h;
  });
  return finish({ ...c, source: "illustration", hops });
}
