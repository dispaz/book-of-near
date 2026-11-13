/**
 * Claiming a stage badge, from the stage's evidence to the token on chain.
 * Demo mode: checks `claimReadiness`, signs with the public demo key in the browser, claims on the
 * DemoChain badge contract. Testnet mode: the Worker checks the evidence on testnet and signs
 * (`POST /claim`), then the practice account sends `claim_stage` through the Chain interface.
 */
import type { Chain, TxOutcome } from "../chain/types";
import type { DemoBadgeSeed } from "../chain/demo/badges";
import { demoSignClaim } from "./demoSigner";
import type { StageClaim } from "./message";
import { claimReadiness, type EvidenceRecord } from "./rules";

export type ClaimResult = { ok: true; tokenId: string; txHash: string } | { ok: false; error: string };

export interface ClaimDeps {
  /** The Worker that signs testnet claims (VITE_WORKER_URL). */
  workerUrl?: string;
  fetch?: typeof fetch;
  /** Demo mode: called with the learner's badges after a claim, so a reload keeps them. */
  keepDemoBadges?: (badges: DemoBadgeSeed[]) => void;
}

/** The contract's refusals, in plain English. */
export function plainClaimError(message: string, stage: number): string {
  if (/already claimed/.test(message)) return "You already hold this badge.";
  if (/previous stage first/.test(message)) return `Claim the stage ${stage - 1} badge first.`;
  if (/Claim expired/.test(message))
    return "The claim ran out of time before it reached the chain. Try again.";
  if (/Invalid claim signature/.test(message)) return "The claim's signature did not match. Try again.";
  if (/Daily mint cap/.test(message)) return "The book has given out today's badges. Try again tomorrow.";
  return `The chain refused the claim: ${message}`;
}

function tokenIdOf(out: TxOutcome): string {
  if (out.status.type !== "SuccessValue" || !out.status.value) return "";
  try {
    return String(JSON.parse(atob(out.status.value)));
  } catch {
    return "";
  }
}

async function workerClaim(
  accountId: string,
  stage: number,
  completions: EvidenceRecord[],
  deps: ClaimDeps,
): Promise<StageClaim | string> {
  if (!deps.workerUrl)
    return "Testnet badges are signed by the app's server, which is not set up here. Demo mode works.";
  const evidence: Record<string, Record<string, string>> = {};
  for (const c of completions) if (c.mode === "testnet" && c.evidence) evidence[c.lessonId] = c.evidence;
  let res: Response;
  try {
    res = await (deps.fetch ?? fetch)(`${deps.workerUrl.replace(/\/$/, "")}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, stage, evidence }),
    });
  } catch {
    return "The app's server could not be reached. Try again in a minute.";
  }
  const body = (await res.json().catch(() => ({}))) as Partial<StageClaim> & { error?: string };
  if (!res.ok || typeof body.signature !== "string" || typeof body.expiresAtMs !== "number")
    return body.error ?? "The app's server did not sign the claim. Try again later.";
  return { stage, expiresAtMs: body.expiresAtMs, signature: body.signature };
}

/**
 * For end-to-end tests and curious reviewers: `__bookOfNear.badges.replayLastClaim()` sends the last
 * signed claim again, straight to the contract, and returns its refusal ("ok" if it was accepted).
 * Dev server and e2e builds only (`VITE_E2E=1`, set by playwright.config.ts): never in a release build.
 */
function exposeReplay(chain: Chain, claim: StageClaim) {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== "1") return;
  if (typeof window === "undefined") return;
  const w = window as unknown as { __bookOfNear?: Record<string, unknown> };
  w.__bookOfNear = {
    ...w.__bookOfNear,
    badges: Object.freeze({
      replayLastClaim: async () => {
        const out = await chain.claimBadge(claim);
        return out.status.type === "Failure" ? out.status.error.message : "ok";
      },
    }),
  };
}

export async function claimStageBadge(
  chain: Chain,
  stage: number,
  completions: EvidenceRecord[],
  deps: ClaimDeps,
): Promise<ClaimResult> {
  const ready = claimReadiness(stage, completions, chain.network === "testnet" ? "testnet" : "demo");
  if (!ready.ready) return { ok: false, error: ready.missing[0]?.text ?? "This stage has no badge." };
  const me = (await chain.practiceAccount()).accountId;
  if (await chain.hasBadge(me, stage)) return { ok: false, error: "You already hold this badge." };
  if (stage > 0 && !(await chain.hasBadge(me, stage - 1)))
    return { ok: false, error: `Claim the stage ${stage - 1} badge first.` };

  let claim: StageClaim;
  if (chain.network === "testnet") {
    const signed = await workerClaim(me, stage, completions, deps);
    if (typeof signed === "string") return { ok: false, error: signed };
    claim = signed;
  } else {
    const now = (await chain.block("final")).timestampMs;
    claim = demoSignClaim(await chain.badgeContractId(), me, stage, now);
  }

  const out = await chain.claimBadge(claim);
  exposeReplay(chain, claim);
  if (out.status.type === "Failure")
    return { ok: false, error: plainClaimError(out.status.error.message, stage) };
  if (chain.network !== "testnet")
    deps.keepDemoBadges?.(
      (await chain.badgesOf(me)).map((b) => ({ owner: b.owner, stage: b.stage, mintedAtMs: b.mintedAtMs })),
    );
  return { ok: true, tokenId: tokenIdOf(out), txHash: out.transaction.hash };
}
