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
