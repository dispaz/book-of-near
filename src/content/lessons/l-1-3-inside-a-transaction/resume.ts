/**
 * Lesson 1.3: finding the workshop account again after a reload. The workshop account holds the practice
 * account's own key, which this app keeps, so a later visit can use it again; no new account (and no new
 * deposit) is needed. Everything on chain goes through the Chain interface.
 */
import type { AccessKeyInfo, Chain, PracticeAccount, PublicKey, TxOutcome } from "../../../chain/types";
import { readRemembered, workshopLabel, type Remembered } from "./batch";

/** How many workshop names the lesson tries: tx-abc, tx-abc-2 … */
const WORKSHOP_TRIES = 6;

/** A workshop account from an earlier visit. */
export interface FoundWorkshop {
  id: string;
  /** The transaction that made it; null when this browser no longer knows it. */
  outcome: TxOutcome | null;
  balance: bigint;
}

/** Where the lesson remembers the workshop transaction id, so a later visit can show it again. */
const storeKey = (network: string) => `bon:l-1-3:workshop:${network}`;

export function rememberWorkshop(network: string, value: Remembered) {
  try {
    localStorage.setItem(storeKey(network), JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the lesson still works, it just cannot show the old transaction.
  }
}

function recall(network: string): Remembered | null {
  try {
    return readRemembered(localStorage.getItem(storeKey(network)));
  } catch {
    return null;
  }
}

/** True when `keys` belong to a workshop account the lesson made: our key is its one full-access key. */
function onlyOurs(keys: AccessKeyInfo[], publicKey: PublicKey): boolean {
  const full = keys.filter((k) => k.permission.type === "FullAccess");
  return full.length === 1 && full[0]!.publicKey === publicKey;
}

/**
 * The workshop account from an earlier visit (`found`), or else the first workshop name nobody has
 * (`freeId`, null when none is free). The account remembered in this browser is tried first, then the
 * names the lesson would have made.
 */
export async function findWorkshop(
  chain: Chain,
  me: PracticeAccount,
): Promise<{ found: FoundWorkshop | null; freeId: string | null }> {
  const stored = recall(chain.network);
  const named = Array.from(
    { length: WORKSHOP_TRIES },
    (_, i) => `${workshopLabel(me.accountId, i + 1)}.testnet`,
  );
  const candidates = stored ? [stored.id, ...named.filter((n) => n !== stored.id)] : named;
  for (const id of candidates) {
    if (!(await chain.accountExists(id))) {
      // Only the lesson's own names can be made; stop at the first free one.
      if (named.includes(id)) return { found: null, freeId: id };
      continue;
    }
    // Reuse it only when our key is its one full-access key: then nobody else controls it.
    const keys = await chain.listKeys(id).catch(() => []);
    if (!onlyOurs(keys, me.publicKey)) continue;
    const outcome =
      stored?.id === id ? await chain.getTransaction(stored.txHash, me.accountId).catch(() => null) : null;
    const balance = (await chain.viewAccount(id)).amount;
    return { found: { id, outcome, balance }, freeId: null };
  }
  return { found: null, freeId: null };
}
