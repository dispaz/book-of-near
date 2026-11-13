/**
 * Badge calls shared by DemoChain and TestnetChain: both talk to a badge contract with the same
 * methods (contracts/badge), so the Chain methods are thin wrappers over these.
 */
import { isRarity, type FinalClaim, type StageClaim } from "../badges/message";
import type { AccountId, Chain, FinalBadge, SendOptions, StageBadge, TxOutcome } from "./types";
import { tgas } from "./units";

type Sender = Pick<Chain, "sendTransaction">;
type Viewer = Pick<Chain, "viewCall">;

/** `claim_stage` from the practice account. A refused claim resolves with a Failure status. */
export function sendStageClaim(
  chain: Sender,
  contractId: AccountId,
  claim: StageClaim,
  options?: SendOptions,
): Promise<TxOutcome> {
  return chain.sendTransaction(
    {
      receiverId: contractId,
      actions: [
        {
          type: "FunctionCall",
          methodName: "claim_stage",
          args: { stage: claim.stage, expires_at_ms: claim.expiresAtMs, signature: claim.signature },
          gas: tgas(30),
          deposit: 0n,
        },
      ],
    },
    options,
  );
}

/** `claim_final` from the practice account. A refused claim resolves with a Failure status. */
export function sendFinalClaim(
  chain: Sender,
  contractId: AccountId,
  claim: FinalClaim,
  options?: SendOptions,
): Promise<TxOutcome> {
  return chain.sendTransaction(
    {
      receiverId: contractId,
      actions: [
        {
          type: "FunctionCall",
          methodName: "claim_final",
          args: {
            route: claim.route,
            rarity: claim.rarity,
            expires_at_ms: claim.expiresAtMs,
            signature: claim.signature,
          },
          gas: tgas(30),
          deposit: 0n,
        },
      ],
    },
    options,
  );
}

interface JsonToken {
  token_id: string;
  owner_id: string;
  metadata?: { media?: string | null; issued_at?: string | null; extra?: string | null };
}

/** The account's stage badges (NEP-171 `nft_tokens_for_owner`), oldest first. */
export async function readStageBadges(
  chain: Viewer,
  contractId: AccountId,
  accountId: AccountId,
): Promise<StageBadge[]> {
  const { result } = await chain.viewCall<JsonToken[]>(contractId, "nft_tokens_for_owner", {
    account_id: accountId,
    limit: 50,
  });
  const out: StageBadge[] = [];
  for (const t of result ?? []) {
    let extra: { kind?: string; stage?: number } = {};
    try {
      extra = JSON.parse(t.metadata?.extra ?? "{}") as typeof extra;
    } catch {
      /* not one of ours */
    }
    if (extra.kind !== "stage" || typeof extra.stage !== "number") continue;
    out.push({
      tokenId: t.token_id,
      owner: t.owner_id,
      stage: extra.stage,
      mintedAtMs: Number(t.metadata?.issued_at ?? 0),
      media: t.metadata?.media ?? undefined,
    });
  }
  return out.sort((a, b) => a.stage - b.stage);
}

/** The account's final badge (`extra.kind === "final"`), or null. */
export async function readFinalBadge(
  chain: Viewer,
  contractId: AccountId,
  accountId: AccountId,
): Promise<FinalBadge | null> {
  const { result } = await chain.viewCall<JsonToken[]>(contractId, "nft_tokens_for_owner", {
    account_id: accountId,
    limit: 50,
  });
  for (const t of result ?? []) {
    let extra: { kind?: string; route?: unknown; rarity?: unknown } = {};
    try {
      extra = JSON.parse(t.metadata?.extra ?? "{}") as typeof extra;
    } catch {
      /* not one of ours */
    }
    if (extra.kind !== "final" || typeof extra.route !== "string" || !isRarity(extra.rarity)) continue;
    return {
      tokenId: t.token_id,
      owner: t.owner_id,
      route: extra.route,
      rarity: extra.rarity,
      mintedAtMs: Number(t.metadata?.issued_at ?? 0),
      media: t.metadata?.media ?? undefined,
    };
  }
  return null;
}

export async function readHasBadge(
  chain: Viewer,
  contractId: AccountId,
  accountId: AccountId,
  stage: number,
) {
  const { result } = await chain.viewCall<boolean>(contractId, "has_badge", { account_id: accountId, stage });
  return result === true;
}
