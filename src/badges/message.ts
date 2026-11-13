/**
 * The claim text the badge contract checks (contracts/badge, `stage_message`). Pure, no imports:
 * the Worker, the demo signer and the demo contract all build the same line.
 */

/** How long a signed claim stays valid. Short, so a leaked claim is soon useless. */
export const CLAIM_TTL_MS = 5 * 60_000;

/** `bon-badge-v1|<contract>|<account>|stage|<stage>|<expires_at_ms>`, signed as UTF-8 bytes. */
export function stageMessage(
  contractId: string,
  accountId: string,
  stage: number,
  expiresAtMs: number,
): string {
  return `bon-badge-v1|${contractId}|${accountId}|stage|${stage}|${expiresAtMs}`;
}

/** A claim signed by the claim key, ready for `claim_stage`. */
export interface StageClaim {
  stage: number;
  expiresAtMs: number;
  /** base64 of the 64-byte ed25519 signature over `stageMessage`. */
  signature: string;
}

/** The four final badge tiers the contract accepts (`claim_final`), lowest first. */
export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITIES: readonly Rarity[] = ["common", "rare", "epic", "legendary"];
export const isRarity = (v: unknown): v is Rarity => RARITIES.includes(v as Rarity);

/**
 * `bon-badge-v1|<contract>|<account>|final|<route>|<rarity>|<expires_at_ms>`, signed as UTF-8 bytes.
 * The contract rebuilds it with the caller (the predecessor) as `<account>` (contracts/badge `final_message`).
 */
export function finalMessage(
  contractId: string,
  accountId: string,
  route: string,
  rarity: Rarity,
  expiresAtMs: number,
): string {
  return `bon-badge-v1|${contractId}|${accountId}|final|${route}|${rarity}|${expiresAtMs}`;
}

/** A final badge claim signed by the claim key, ready for `claim_final`. */
export interface FinalClaim {
  route: string;
  rarity: Rarity;
  expiresAtMs: number;
  /** base64 of the 64-byte ed25519 signature over `finalMessage`. */
  signature: string;
}
