/**
 * The learner's testnet practice account: a throwaway key made in the browser, kept in
 * localStorage, and funded by a faucet. Only the PUBLIC key ever leaves the browser.
 *
 * Funding order (issue #7):
 *   1. our Worker faucet (`VITE_WORKER_URL` + `/faucet`), rate-limited, makes an implicit account;
 *   2. the public helper `helper.testnet.near.org/account` (10 NEAR, makes a `bon-….testnet` name);
 *   3. otherwise the app falls back to demo mode and says why (ChainProvider).
 */
import type { AccountId, PublicKey } from "../types";

export const PRACTICE_STORAGE_KEY = "bon:testnet-practice-account:v1";
export const HELPER_URL = "https://helper.testnet.near.org/account";

export interface StoredPracticeAccount {
  warning: string;
  network: "testnet";
  accountId: AccountId;
  publicKey: PublicKey;
  secretKey: string;
  fundedBy: string;
  createdAt: string;
}

const WARNING =
  "Throwaway practice key for NEAR TESTNET only, made by Book of NEAR. Testnet tokens have no value. " +
  "Never send real funds to this account or reuse this key on mainnet.";

export interface PracticeStore {
  load(): StoredPracticeAccount | null;
  save(account: StoredPracticeAccount): void;
  clear(): void;
}

/** localStorage store. Every access is wrapped: storage may be blocked or missing. */
export function localPracticeStore(
  storage: () => Storage | undefined = () => globalThis.localStorage,
): PracticeStore {
  return {
    load() {
      try {
        const raw = storage()?.getItem(PRACTICE_STORAGE_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<StoredPracticeAccount>;
        return v.network === "testnet" && v.accountId && v.publicKey && v.secretKey
          ? (v as StoredPracticeAccount)
          : null;
      } catch {
        return null;
      }
    },
    save(account) {
      try {
        storage()?.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(account, null, 1));
      } catch {
        /* the account still works for this visit */
      }
    },
    clear() {
      try {
        storage()?.removeItem(PRACTICE_STORAGE_KEY);
      } catch {
        /* nothing stored */
      }
    },
  };
}

export function memoryPracticeStore(initial: StoredPracticeAccount | null = null): PracticeStore {
  let v = initial;
  return {
    load: () => v,
    save: (a) => (v = a),
    clear: () => (v = null),
  };
}

export function newPracticeRecord(
  accountId: AccountId,
  publicKey: PublicKey,
  secretKey: string,
  fundedBy: string,
  now = new Date(),
): StoredPracticeAccount {
  return {
    warning: WARNING,
    network: "testnet",
    accountId,
    publicKey,
    secretKey,
    fundedBy,
    createdAt: now.toISOString(),
  };
}

// ---------- Funding ----------

export interface Funded {
  accountId: AccountId;
  /** Which faucet paid: "worker" or "helper". */
  fundedBy: string;
}

/** Creates and funds an account for `publicKey`. Rejects with a short, plain reason. */
export interface Funder {
  name: string;
  fund(publicKey: PublicKey): Promise<Funded>;
}

export class FundingError extends Error {
  constructor(readonly reasons: string[]) {
    super(
      reasons.length
        ? `No faucet could fund a practice account (${reasons.join("; ")}).`
        : "No faucet is configured.",
    );
    this.name = "FundingError";
  }
}

async function postJson(doFetch: typeof fetch, url: string, body: unknown, timeoutMs: number) {
  const res = await doFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { res, json, text };
}

/** Our Worker: `POST <url>/faucet { publicKey }` → `{ accountId }`. */
export function workerFunder(workerUrl: string, doFetch: typeof fetch = (...a) => fetch(...a)): Funder {
  const url = `${workerUrl.replace(/\/+$/, "")}/faucet`;
  return {
    name: "worker",
    async fund(publicKey) {
      let out;
      try {
        out = await postJson(doFetch, url, { publicKey }, 45_000);
      } catch {
        throw new Error("the Book of NEAR faucet did not answer");
      }
      const body = out.json as { accountId?: string; error?: string } | null;
      if (!out.res.ok || !body?.accountId)
        throw new Error(body?.error ?? `the Book of NEAR faucet answered ${out.res.status}`);
      return { accountId: body.accountId, fundedBy: "worker" };
    },
  };
}

function randomName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

/** NEAR's public testnet helper: creates `bon-<random>.testnet` with 10 NEAR. Undocumented limits. */
export function helperFunder(
  doFetch: typeof fetch = (...a) => fetch(...a),
  makeId: () => AccountId = () => `bon-${randomName()}.testnet`,
  url = HELPER_URL,
): Funder {
  return {
    name: "helper",
    async fund(publicKey) {
      const accountId = makeId();
      let out;
      try {
        out = await postJson(
          doFetch,
          url,
          { newAccountId: accountId, newAccountPublicKey: publicKey },
          45_000,
        );
      } catch {
        throw new Error("NEAR's public testnet faucet did not answer");
      }
      const failed = JSON.stringify(out.json ?? "").includes('"Failure"');
      if (!out.res.ok || failed) throw new Error(`NEAR's public testnet faucet answered ${out.res.status}`);
      return { accountId, fundedBy: "helper" };
    },
  };
}

/** Try each funder in order; the first that works wins. */
export async function fundPracticeAccount(publicKey: PublicKey, funders: Funder[]): Promise<Funded> {
  const reasons: string[] = [];
  for (const f of funders) {
    try {
      return await f.fund(publicKey);
    } catch (e) {
      reasons.push((e as Error).message);
    }
  }
  throw new FundingError(reasons);
}
