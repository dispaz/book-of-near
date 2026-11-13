/**
 * POST /claim: the badge claim signer (issue #68, docs/badge-contract.md "Worker requirements").
 * Checks a stage's evidence on testnet (the lessons' transaction hashes, signed by the learner or by
 * the name the learner made in lesson 1.1), then signs a short-lived claim in the contract's format.
 * The client never chooses the expiry. Required lessons and evidence keys: src/badges/rules.ts.
 */
import { CLAIM_TTL_MS, stageMessage } from "../../src/badges/message";
import { lessonNumber, ruleFor } from "../../src/badges/rules";
import { b58decode, b64encode, b64urlEncode } from "./bytes";

/** A claim body is a few hashes: anything bigger is refused before it is parsed. */
export const MAX_CLAIM_BODY_BYTES = 4 * 1024;

export interface TxAction {
  type: string;
  methodName?: string;
  args?: Record<string, unknown>;
}

/** A testnet transaction, as the claim check needs it. */
export interface TxInfo {
  signerId: string;
  receiverId: string;
  /** The transaction's final status is a success. */
  ok: boolean;
  actions: TxAction[];
}

export interface TxLookup {
  /** The transaction `hash` sent by `senderId`, or null when that account sent no such transaction. */
  tx(hash: string, senderId: string): Promise<TxInfo | null>;
}

export interface ClaimDeps {
  contractId: string;
  /** `ed25519:<base58 of the 64-byte secret key>` (Worker secret CLAIM_SIGNING_KEY). */
  signingKey: string;
  lookup: TxLookup;
  now: Date;
}

export interface Reply {
  status: number;
  body: unknown;
}

const ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const isAccount = (v: unknown): v is string =>
  typeof v === "string" && v.length >= 2 && v.length <= 64 && ACCOUNT.test(v);
/** The signer contract of lesson 4.1 (Chain Signatures on testnet). */
const MPC_SIGNER = "v1.signer-prod.testnet";

type Evidence = Record<string, Record<string, string>>;

class Refused extends Error {}

const refuse = (text: string): never => {
  throw new Refused(text);
};

/**
 * The first sender in `senders` that really sent `hash`, or a refusal naming the lesson. A lookup that
 * throws (RPC down) is not "not found": it propagates and `claim` answers 502.
 */
async function findTx(lookup: TxLookup, hash: string, senders: string[], lessonId: string): Promise<TxInfo> {
  for (const s of new Set(senders)) {
    const t = await lookup.tx(hash, s);
    if (t && t.signerId === s) {
      if (!t.ok) refuse(`The transaction from lesson ${lessonNumber(lessonId)} failed on testnet.`);
      return t;
    }
  }
  return refuse(
    `The transaction from lesson ${lessonNumber(lessonId)} was not found on testnet from your account.`,
  );
}

/** Lesson 1.1: the learner's own `create_account` call that made the name. Returns the name. */
async function verifiedName(find: Find, account: string, ev: Evidence): Promise<string | null> {
  const e = ev["l-1-1-claim-your-name"];
  if (!e?.txHash || !isAccount(e.accountId)) return null;
  const t = await find(e.txHash, [account], "l-1-1-claim-your-name");
  if (!madeName(t, e.accountId!)) refuse("The name from lesson 1.1 was not made by your account.");
  return e.accountId!;
}

const parentOf = (id: string) => id.slice(id.indexOf(".") + 1);

/** `t` is a `create_account` call that made `name`. */
const madeName = (t: TxInfo, name: string) =>
  t.actions.some((a) => a.methodName === "create_account" && a.args?.new_account_id === name);

/** `id` is one of the learner's own accounts, or a sub-account of one. */
const isOwn = (id: string, mine: string[]) => mine.some((m) => id === m || id.endsWith(`.${m}`));

/** Lesson 0.3 sends one Transfer and nothing else; lesson 2.1 follows that same transaction. */
const isTransfer = (t: TxInfo) => t.actions.length === 1 && t.actions[0]!.type === "Transfer";

type Find = (hash: string, senders: string[], lessonId: string) => Promise<TxInfo>;

/** `findTx` for one claim: each hash may stand for one piece of evidence only. */
function finder(lookup: TxLookup): Find {
  const used = new Set<string>();
  return (hash, senders, lessonId) => {
    if (used.has(hash))
      refuse(`The same transaction is given more than once (lesson ${lessonNumber(lessonId)}).`);
    used.add(hash);
    return findTx(lookup, hash, senders, lessonId);
  };
}

async function checkStage(stage: number, account: string, ev: Evidence, lookup: TxLookup) {
  const find = finder(lookup);
  const named = stage >= 1 ? await verifiedName(find, account, ev) : null;
  const mine = named ? [account, named] : [account];
  switch (stage) {
    case 0: {
      const t = await find(ev["l-0-3-send-a-transaction"]!.txHash!, mine, "l-0-3-send-a-transaction");
      if (!isTransfer(t)) refuse("Lesson 0.3's transaction is not a transfer.");
      return;
    }
    case 1: {
      if (!named) refuse("Claim your name in lesson 1.1.");
      const e = ev["l-1-2-function-call-key"]!;
      const add = await find(e.addKeyTxHash!, mine, "l-1-2-function-call-key");
      const del = await find(e.txHash!, mine, "l-1-2-function-call-key");
      if (!add.actions.some((a) => a.type === "AddKey") || !del.actions.some((a) => a.type === "DeleteKey"))
        refuse("Lesson 1.2's transactions do not add and delete a key.");
      return;
    }
    case 2: {
      const t = await find(ev["l-2-1-follow-across-shards"]!.txHash!, mine, "l-2-1-follow-across-shards");
      if (!isTransfer(t)) refuse("Lesson 2.1's transaction is not the transfer from lesson 0.3.");
      return;
    }
    case 3: {
      const e = ev["l-3-1-deploy-a-contract"]!;
      // Only the learner's own accounts count as senders, and the contract must live under one of them.
      // For an implicit account, 3.1 makes a fresh parent first: it counts only when the learner's own
      // `create_account` call made it (parentTxHash).
      const owners = [...mine];
      const parent = parentOf(e.contractId!);
      if (!isOwn(e.contractId!, owners) && e.parentTxHash) {
        const p = await find(e.parentTxHash, mine, "l-3-1-deploy-a-contract");
        if (madeName(p, parent)) owners.push(parent);
      }
      if (!isOwn(e.contractId!, owners)) refuse("Lesson 3.1's contract is not under your account.");
      const t = await find(e.txHash!, owners, "l-3-1-deploy-a-contract");
      if (t.receiverId !== e.contractId || !t.actions.some((a) => a.type === "DeployContract"))
        refuse("Lesson 3.1's transaction does not deploy your contract.");
      return;
    }
    case 4: {
      const t = await find(
        ev["l-4-1-one-account-every-chain"]!.mpcTxHash!,
        mine,
        "l-4-1-one-account-every-chain",
      );
      if (t.receiverId !== MPC_SIGNER) refuse("Lesson 4.1's transaction is not a chain-signature request.");
      return;
    }
    case 5:
      // Lessons 5.1 and 5.2 send nothing on chain (rules.ts), so there is nothing to look up. The badge
      // contract still refuses the claim until the account holds the stage 4 badge.
      return;
    case 6:
      // Nothing on chain to check: 6.1 is a practice vote and 6.2 reads recorded data. The rule's evidence
      // keys (checked in `claim`) show the steps were done; the contract refuses stage 6 until the account
      // holds stage 5, so the badge still rests on the earlier stages' on-chain work.
      return;
  }
}

/** Sign `text` with a NEAR `ed25519:` secret key through WebCrypto (Workers and Node 22 have Ed25519). */
export async function signText(secretKey: string, text: string): Promise<string> {
  const raw = b58decode(secretKey.replace(/^ed25519:/, ""));
  if (raw.length !== 64) throw new Error("CLAIM_SIGNING_KEY must be a 64-byte ed25519 secret key");
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "OKP", crv: "Ed25519", d: b64urlEncode(raw.slice(0, 32)), x: b64urlEncode(raw.slice(32)) },
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(text));
  return b64encode(new Uint8Array(sig));
}

export async function claim(input: unknown, deps: ClaimDeps): Promise<Reply> {
  const bad = (error: string): Reply => ({ status: 400, body: { error } });
  if (!input || typeof input !== "object") return bad("Send JSON with accountId, stage and evidence.");
  const { accountId, stage, evidence } = input as {
    accountId?: unknown;
    stage?: unknown;
    evidence?: unknown;
  };
  if (!isAccount(accountId)) return bad("That is not a NEAR account id.");
  const rule = typeof stage === "number" ? ruleFor(stage) : undefined;
  if (!rule) return bad("Unknown stage.");
  const ev: Evidence = evidence && typeof evidence === "object" ? (evidence as Evidence) : {};

  for (const need of rule.evidence) {
    const rec = ev[need.lessonId];
    if (!need.keys.every((k) => typeof rec?.[k] === "string" && rec[k]!.length > 0))
      return { status: 403, body: { error: need.todo, lessonId: need.lessonId } };
  }
  try {
    await checkStage(rule.stage, accountId, ev, deps.lookup);
  } catch (e) {
    if (e instanceof Refused) return { status: 403, body: { error: e.message } };
    return { status: 502, body: { error: "Testnet could not be reached. Try again in a minute." } };
  }
  const expiresAtMs = deps.now.getTime() + CLAIM_TTL_MS;
  const signature = await signText(
    deps.signingKey,
    stageMessage(deps.contractId, accountId, rule.stage, expiresAtMs),
  );
  return {
    status: 200,
    body: { contractId: deps.contractId, accountId, stage: rule.stage, expiresAtMs, signature },
  };
}

/** Transaction lookup through testnet RPC (`tx`), regular node first, then archival. */
export function rpcLookup(
  urls = ["https://rpc.testnet.fastnear.com", "https://archival-rpc.testnet.fastnear.com"],
  fetchFn: typeof fetch = fetch,
): TxLookup {
  return {
    async tx(hash, senderId) {
      let lastError: unknown = null;
      for (const url of urls) {
        try {
          const res = await fetchFn(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "claim",
              method: "tx",
              params: { tx_hash: hash, sender_account_id: senderId, wait_until: "FINAL" },
            }),
          });
          const json = (await res.json()) as { result?: RpcTx; error?: { cause?: { name?: string } } };
          if (json.result) return toTxInfo(json.result);
          const cause = json.error?.cause?.name;
          if (cause !== "UNKNOWN_TRANSACTION" && cause !== "INVALID_TRANSACTION")
            throw new Error(cause ?? "rpc");
        } catch (e) {
          lastError = e;
          continue;
        }
      }
      if (lastError) throw lastError;
      return null;
    },
  };
}

interface RpcTx {
  status: Record<string, unknown>;
  transaction: { signer_id: string; receiver_id: string; actions: (string | Record<string, unknown>)[] };
}

function toTxInfo(r: RpcTx): TxInfo {
  const actions: TxAction[] = r.transaction.actions.map((a) => {
    if (typeof a === "string") return { type: a };
    const [type, body] = Object.entries(a)[0] ?? ["Unknown", {}];
    if (type !== "FunctionCall") return { type };
    const fc = body as { method_name?: string; args?: string };
    let args: Record<string, unknown> | undefined;
    try {
      args = JSON.parse(atob(fc.args ?? "")) as Record<string, unknown>;
    } catch {
      args = undefined;
    }
    return { type, methodName: fc.method_name, args };
  });
  return {
    signerId: r.transaction.signer_id,
    receiverId: r.transaction.receiver_id,
    ok: !("Failure" in r.status),
    actions,
  };
}
