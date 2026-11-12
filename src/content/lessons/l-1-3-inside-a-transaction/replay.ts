/**
 * Lesson 1.3, step 5: an old signed transaction sent again, unchanged, and the words for what the chain
 * said. Everything on chain goes through the Chain interface.
 */
import { isChainError } from "../../../chain/errors";
import type { Chain, InvalidTxReason, SendOptions, SignedTransaction } from "../../../chain/types";

/** An old signed transaction sent again. */
export interface Replay {
  n: number;
  which: "worked" | "failed";
  /** True when the chain would not run it again (the expected case). */
  notRun: boolean;
  /** The chain's reason, when it gives one. */
  reason: InvalidTxReason | null;
  message: string;
  txNonce: bigint;
  keyNonce: bigint | null;
}

/**
 * Sends `signed` again and records what the chain said. A refusal (an invalid transaction) is the
 * expected answer and is returned; any other error is thrown.
 */
export async function sendAgain(
  chain: Chain,
  signed: SignedTransaction,
  { n, which, pace }: { n: number; which: Replay["which"]; pace?: SendOptions["pace"] },
): Promise<Replay> {
  const base = { n, which, txNonce: signed.nonce };
  try {
    await chain.sendSignedTransaction(signed, { pace });
    // Not expected: the chain ran the copy.
    return { ...base, notRun: false, reason: null, message: "The chain ran the copy.", keyNonce: null };
  } catch (e) {
    if (!isChainError(e) || e.kind !== "InvalidTransaction") throw e;
    const keys = await chain.listKeys(signed.signerId).catch(() => []);
    const keyNonce = keys.find((k) => k.publicKey === signed.publicKey)?.nonce ?? null;
    return { ...base, notRun: true, reason: e.reason ?? null, message: e.message, keyNonce };
  }
}

/** Why a copy did not run, in plain words. The nonce is named only when the chain said InvalidNonce. */
export function replayWhy(r: Pick<Replay, "reason" | "message" | "keyNonce">): string {
  const end = "Nothing ran, and nothing was charged.";
  if (r.reason === "InvalidNonce")
    return `The chain will not run it again: its nonce is used.${
      r.keyNonce !== null ? ` The key's nonce is now ${r.keyNonce.toString()}.` : ""
    } ${end}`;
  if (r.reason === "Expired")
    return `The chain will not run it: it is too old. Its block hash is from too many blocks ago, so its deadline has passed. ${end}`;
  return `The chain refused it: ${r.message} ${end}`;
}

/** The same reason in a few words, for the label in the 3D view. */
export function replayShort(reason: InvalidTxReason | null): string {
  if (reason === "InvalidNonce") return "its nonce is used";
  if (reason === "Expired") return "it is too old";
  return "the chain refused it";
}
