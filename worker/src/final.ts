/**
 * POST /final: signs the final badge claim (issue #29) for a passed exam.
 *
 * Takes `{ accountId, route, receipt }`, where `receipt` is the one `POST /exam` signed for a pass.
 * The Worker checks the receipt's signature with its own claim key, that it names this badge
 * contract, this account and this route, and that it is a pass. Then it works out the rarity from the
 * receipt's signed score and pass time (src/badges/final.ts `rarityFor`) and signs
 * `bon-badge-v1|<contract>|<account>|final|<route>|<rarity>|<expires_at_ms>` with a short expiry it
 * chooses itself. The client never chooses the rarity or the expiry.
 *
 * Binding to the caller: `/exam` does not prove the caller controls `accountId`, and neither does
 * this route. The contract does: `claim_final` rebuilds the signed text with the predecessor (the
 * account that signs the transaction) as `<account>`. A claim signed for someone else's account
 * fails "Invalid claim signature" when anyone but that account sends it, so it can only ever mint to
 * the account the receipt names.
 */
import { questionsFor } from "../../src/exam/bank";
import { isExamRoute } from "../../src/exam/routes";
import type { ExamReceipt } from "../../src/exam/grade";
import { rarityFor, receiptProblem, receiptText } from "../../src/badges/final";
import { CLAIM_TTL_MS, finalMessage } from "../../src/badges/message";
import { b58decode, b64decode } from "./bytes";
import { signText, type Reply } from "./claim";

/** An account, a route and a receipt (a few ids, numbers and an 88-character signature). */
export const MAX_FINAL_BODY_BYTES = 2 * 1024;

export interface FinalDeps {
  contractId: string;
  signingKey: string;
  now: Date;
}

const ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const isAccount = (v: unknown): v is string =>
  typeof v === "string" && v.length >= 2 && v.length <= 64 && ACCOUNT.test(v);

/** Did the claim key (the public half of `secretKey`) sign `text`? */
export async function signedByKey(secretKey: string, text: string, signatureB64: string): Promise<boolean> {
  const raw = b58decode(secretKey.replace(/^ed25519:/, ""));
  if (raw.length !== 64) throw new Error("CLAIM_SIGNING_KEY must be a 64-byte ed25519 secret key");
  let sig: Uint8Array;
  try {
    sig = b64decode(signatureB64);
  } catch {
    return false;
  }
  if (sig.length !== 64) return false;
  const key = await crypto.subtle.importKey("raw", raw.slice(32), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify("Ed25519", key, sig, new TextEncoder().encode(text));
}

export async function final(input: unknown, deps: FinalDeps): Promise<Reply> {
  const bad = (error: string, status = 400): Reply => ({ status, body: { error } });
  if (!input || typeof input !== "object") return bad("Send JSON with accountId, route and receipt.");
  const { accountId, route, receipt } = input as { accountId?: unknown; route?: unknown; receipt?: unknown };
  if (!isAccount(accountId)) return bad("That is not a NEAR account id.");
  if (!isExamRoute(route)) return bad("Unknown exam route.");
  const problem = receiptProblem(receipt, {
    contractId: deps.contractId,
    accountId,
    route,
    total: questionsFor(route).length,
  });
  if (problem) return bad(problem, 403);
  const r = receipt as ExamReceipt;
  if (!(await signedByKey(deps.signingKey, receiptText(r), r.signature)))
    return bad("The receipt's signature does not match. Take the exam again in testnet mode.", 403);

  const rarity = rarityFor(r.score, r.total, r.passedAtMs);
  const expiresAtMs = deps.now.getTime() + CLAIM_TTL_MS;
  const signature = await signText(
    deps.signingKey,
    finalMessage(deps.contractId, accountId, route, rarity, expiresAtMs),
  );
  return {
    status: 200,
    body: { contractId: deps.contractId, accountId, route, rarity, expiresAtMs, signature },
  };
}
