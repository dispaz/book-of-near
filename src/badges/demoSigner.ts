/**
 * Demo mode signs badge claims in the browser with the public demo claim key, without the Worker.
 * The rules it checks first (the stage's evidence) are the same `claimReadiness` the Worker uses.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";
import { DEMO_CLAIM_SEED } from "../chain/demo/badges";
import { CLAIM_TTL_MS, stageMessage, type StageClaim } from "./message";

/** Sign a stage claim that expires `ttlMs` after `nowMs` (the chain's block time). */
export function demoSignClaim(
  contractId: string,
  accountId: string,
  stage: number,
  nowMs: number,
  ttlMs = CLAIM_TTL_MS,
): StageClaim {
  const expiresAtMs = nowMs + ttlMs;
  const sig = ed25519.sign(
    utf8ToBytes(stageMessage(contractId, accountId, stage, expiresAtMs)),
    DEMO_CLAIM_SEED,
  );
  return { stage, expiresAtMs, signature: base64.encode(sig) };
}
