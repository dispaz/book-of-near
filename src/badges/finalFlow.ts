/**
 * Claiming the final badge (issue #29), from a passed exam's receipt to the token on chain.
 *
 * Testnet mode: the Worker (`POST /final`) checks the receipt it signed after the exam, works out the
 * rarity and signs the final claim; the practice account then sends `claim_final` through the Chain
 * interface. Demo mode does the same checks in the browser with the public demo key (no network, by
 * rule) and claims on the DemoChain badge contract.
 *
 * Only the testnet edition is built: there is no mainnet mint (owner decision for the hackathon).
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base58, base64 } from "@scure/base";
import { DEMO_CLAIM_PUBLIC_KEY, DEMO_CLAIM_SEED, type DemoFinalSeed } from "../chain/demo/badges";
import type { Chain, FinalBadge, TxOutcome } from "../chain/types";
import { questionsFor } from "../exam/bank";
import type { ExamReceipt } from "../exam/grade";
import type { ExamRoute } from "../exam/routes";
import { rarityFor, receiptProblem, receiptText } from "./final";
import { CLAIM_TTL_MS, finalMessage, isRarity, type FinalClaim } from "./message";

export type FinalResult =
  { ok: true; badge: FinalBadge; txHash: string } | { ok: false; error: string; badge?: FinalBadge };

export interface FinalDeps {
  /** The Worker that signs testnet claims (VITE_WORKER_URL). */
  workerUrl?: string;
  fetch?: typeof fetch;
  /** Demo mode: called with the new final badge after a claim, so a reload keeps it. */
  keepDemoFinal?: (seed: DemoFinalSeed) => void;
}

/** The contract's refusals, in plain English. */
export function plainFinalError(message: string): string {
  if (/Final badge already claimed/.test(message)) return "You already hold the final badge.";
  if (/stage this route requires is missing/.test(message))
    return "Your account is missing a stage badge this exam route needs.";
  if (/Unknown route/.test(message))
    return "The badge contract does not know this exam route yet. The project owner has to set it up.";
  if (/Claim expired/.test(message))
    return "The claim ran out of time before it reached the chain. Try again.";
  if (/Invalid claim signature/.test(message)) return "The claim's signature did not match. Try again.";
  if (/Daily mint cap/.test(message)) return "The book has given out today's badges. Try again tomorrow.";
  return `The chain refused the claim: ${message}`;
}

/** Demo mode: the Worker's checks, with the public demo key. */
export function demoSignFinal(
  contractId: string,
  accountId: string,
  route: ExamRoute,
  receipt: ExamReceipt,
  nowMs: number,
): FinalClaim | string {
  const problem = receiptProblem(receipt, {
    contractId,
    accountId,
    route,
    total: questionsFor(route).length,
  });
  if (problem) return problem;
  const pk = base58.decode(DEMO_CLAIM_PUBLIC_KEY.slice("ed25519:".length));
  let ok: boolean;
  try {
    ok = ed25519.verify(base64.decode(receipt.signature), utf8ToBytes(receiptText(receipt)), pk);
  } catch {
    ok = false;
  }
  if (!ok) return "The receipt's signature does not match. Take the exam again.";
  const rarity = rarityFor(receipt.score, receipt.total, receipt.passedAtMs);
  const expiresAtMs = nowMs + CLAIM_TTL_MS;
  const sig = ed25519.sign(
    utf8ToBytes(finalMessage(contractId, accountId, route, rarity, expiresAtMs)),
    DEMO_CLAIM_SEED,
  );
  return { route, rarity, expiresAtMs, signature: base64.encode(sig) };
}

async function workerSign(
  accountId: string,
  route: ExamRoute,
  receipt: ExamReceipt,
  deps: FinalDeps,
): Promise<FinalClaim | string> {
  if (!deps.workerUrl)
    return "Testnet badges are signed by the app's server, which is not set up here. Demo mode works.";
  let res: Response;
  try {
    res = await (deps.fetch ?? fetch)(`${deps.workerUrl.replace(/\/$/, "")}/final`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, route, receipt }),
    });
  } catch {
    return "The app's server could not be reached. Try again in a minute.";
  }
  const body = (await res.json().catch(() => ({}))) as Partial<FinalClaim> & { error?: string };
  if (
    !res.ok ||
    typeof body.signature !== "string" ||
    typeof body.expiresAtMs !== "number" ||
    !isRarity(body.rarity)
  )
    return body.error ?? "The app's server did not sign the claim. Try again later.";
  return { route, rarity: body.rarity, expiresAtMs: body.expiresAtMs, signature: body.signature };
}

export async function claimFinalBadge(
  chain: Chain,
  route: ExamRoute,
  receipt: ExamReceipt | undefined,
  deps: FinalDeps,
): Promise<FinalResult> {
  if (!receipt) return { ok: false, error: "Pass the exam first: the claim needs its signed receipt." };
  const me = (await chain.practiceAccount()).accountId;
  if (receipt.accountId !== me)
    return { ok: false, error: "This receipt is for another account. Take the exam with this one." };
  const held = await chain.finalBadgeOf(me);
  if (held) return { ok: false, error: "You already hold the final badge.", badge: held };

  let claim: FinalClaim;
  if (chain.network === "testnet") {
    const signed = await workerSign(me, route, receipt, deps);
    if (typeof signed === "string") return { ok: false, error: signed };
    claim = signed;
  } else {
    const now = (await chain.block("final")).timestampMs;
    const signed = demoSignFinal(await chain.badgeContractId(), me, route, receipt, now);
    if (typeof signed === "string") return { ok: false, error: signed };
    claim = signed;
  }

  const out: TxOutcome = await chain.claimFinal(claim);
  if (out.status.type === "Failure") return { ok: false, error: plainFinalError(out.status.error.message) };
  const badge = await chain.finalBadgeOf(me);
  if (!badge) return { ok: false, error: "The claim went through, but the badge could not be read yet." };
  if (chain.network !== "testnet")
    deps.keepDemoFinal?.({
      owner: badge.owner,
      route: badge.route,
      rarity: badge.rarity,
      mintedAtMs: badge.mintedAtMs,
    });
  return { ok: true, badge, txHash: out.transaction.hash };
}
