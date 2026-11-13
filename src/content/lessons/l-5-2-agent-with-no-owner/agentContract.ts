/**
 * A model of the Shade Agent Framework's reference agent contract (docs/lessons/stage-5/5.2-topic.md,
 * [sa-contract]), run in the browser: `register_agent` with its four checks and `request_signature`
 * gated by `require_valid_agent`, with the contract's own error texts. No agent and no agent contract
 * run for this lesson, and the page says so. Pure: no React, no network.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { ECDSA_DOMAIN, SIGNER_CONTRACT } from "../../../chain/chainSigMath";
import { RECORDED_ATTESTATION } from "../../../chain/nearai";

/** The example agent contract (no such contract is deployed; the name only feeds the derivation). */
export const AGENT_CONTRACT = "agent.example.testnet";
/** The developer who wrote the agent, signing from their own account. */
export const DEVELOPER = "developer.testnet";
/** The path the reference template signs Ethereum transactions with. */
export const AGENT_PATH = "ethereum-1";
/** An example PPID (an id of one physical TEE machine): not a real machine's. */
export const EXAMPLE_PPID = "example-ppid-0001";
/** How long a registration stays valid (the contract's `attestation_expiration_time_ms`; example). */
const EXPIRATION_MS = 7 * 24 * 3600 * 1000;

/** Five of the six measurements an agent contract compares (the sixth, the key provider digest, is
 * not in the recorded quote). */
export interface Measurements {
  mrtd: string;
  rtmr0: string;
  rtmr1: string;
  rtmr2: string;
  /** The app compose hash: changes with the agent's Docker Compose file, so with its code. */
  composeHash: string;
}

/** Example values: the real measurements of the NEAR AI Cloud quote recorded on 13 Nov 2026 (5.1). */
export const AGENT_MEASUREMENTS: Measurements = {
  mrtd: RECORDED_ATTESTATION.measurements.mrtd,
  rtmr0: RECORDED_ATTESTATION.measurements.rtmr0,
  rtmr1: RECORDED_ATTESTATION.measurements.rtmr1,
  rtmr2: RECORDED_ATTESTATION.measurements.rtmr2,
  composeHash: RECORDED_ATTESTATION.composeHash,
};

/** A changed copy of the agent: same machine, same image, a different compose file. */
export const CHANGED_MEASUREMENTS: Measurements = {
  ...AGENT_MEASUREMENTS,
  composeHash: bytesToHex(sha256(utf8ToBytes(`${AGENT_MEASUREMENTS.composeHash}+changed`))),
};

/** What the agent contract keeps. */
export interface AgentContract {
  approvedMeasurements: Measurements[];
  approvedPpids: string[];
  agents: Record<string, { measurements: Measurements; ppid: string; validUntilMs: number }>;
  expirationMs: number;
}

/** A contract in TEE mode, owner-approved for the agent's measurements and the example PPID. */
export function newAgentContract(): AgentContract {
  return {
    approvedMeasurements: [AGENT_MEASUREMENTS],
    approvedPpids: [EXAMPLE_PPID],
    agents: {},
    expirationMs: EXPIRATION_MS,
  };
}

/** A booted agent: only its account. The private key stays in `bootAgent`'s scope and is dropped. */
export interface Agent {
  accountId: string;
}

/** Start the agent: a fresh ed25519 key, made here (standing in for the enclave). Its implicit account
 * is the public key in hex. A restart makes a new one. */
export function bootAgent(): Agent {
  const secret = ed25519.utils.randomSecretKey();
  return { accountId: bytesToHex(ed25519.getPublicKey(secret)) };
}

/** 64 bytes of report data: the implicit account's 32 bytes, then zeros (as the contract builds it). */
export function reportDataFor(accountId: string): string {
  return accountId + "00".repeat(32);
}

/** The parts of an attestation the contract reads. */
export interface Quote {
  genuine: boolean;
  measurements: Measurements;
  ppid: string;
  reportData: string;
}

/** The quote an agent hands over: genuine, from the example machine, bound to its own account. */
export function quoteFor(accountId: string, measurements = AGENT_MEASUREMENTS): Quote {
  return { genuine: true, measurements, ppid: EXAMPLE_PPID, reportData: reportDataFor(accountId) };
}

export type RegCheckId = "genuine" | "measurements" | "ppid" | "reportData";
export interface RegCheck {
  id: RegCheckId;
  label: string;
  ok: boolean;
}

export const REG_CHECK_LABELS: Record<RegCheckId, string> = {
  genuine: "The quote is a genuine TEE attestation.",
  measurements: "Its measurements are on the approved list.",
  ppid: "Its machine (PPID) is approved.",
  reportData: "Its report data holds the caller's own account.",
};

export type Registration =
  | { ok: true; checks: RegCheck[]; contract: AgentContract }
  | { ok: false; error: string; checks: RegCheck[]; contract: AgentContract };

const IMPLICIT = /^[0-9a-f]{64}$/;
const same = (a: Measurements, b: Measurements) =>
  (Object.keys(a) as (keyof Measurements)[]).every((k) => a[k] === b[k]);

/** `register_agent(attestation)`, called by `caller`. Returns the new contract state on success. */
export function registerAgent(
  contract: AgentContract,
  caller: string,
  quote: Quote,
  nowMs: number,
): Registration {
  if (!IMPLICIT.test(caller))
    return { ok: false, error: "Account ID must be implicit account", checks: [], contract };
  const checks: RegCheck[] = (
    [
      ["genuine", quote.genuine],
      ["measurements", contract.approvedMeasurements.some((m) => same(m, quote.measurements))],
      ["ppid", contract.approvedPpids.includes(quote.ppid)],
      ["reportData", quote.reportData === reportDataFor(caller)],
    ] as const
  ).map(([id, ok]) => ({ id, label: REG_CHECK_LABELS[id], ok }));
  // On chain the crate's own reason follows the colon; the page names the failed check instead.
  if (checks.some((c) => !c.ok))
    return { ok: false, error: "Attestation verification failed: …", checks, contract };
  const agents = {
    ...contract.agents,
    [caller]: {
      measurements: quote.measurements,
      ppid: quote.ppid,
      validUntilMs: nowMs + contract.expirationMs,
    },
  };
  return { ok: true, checks, contract: { ...contract, agents } };
}

/** The cross-contract call a valid `request_signature` makes. */
export interface SignCall {
  from: string;
  receiver: string;
  method: "sign";
  deposit: "1 yoctoNEAR";
  args: { request: { payload_v2: { Ecdsa: string }; path: string; domain_id: number } };
}

export type SignRequest = { ok: true; call: SignCall } | { ok: false; error: string };

/** `request_signature(path, payload, "Ecdsa")`: `require_valid_agent`, then `sign` on the signer. */
export function requestSignature(
  contract: AgentContract,
  caller: string,
  nowMs: number,
  { path, payload }: { path: string; payload: string },
): SignRequest {
  const agent = contract.agents[caller];
  if (!agent) return { ok: false, error: "Agent not registered" };
  const reasons: string[] = [];
  if (agent.validUntilMs < nowMs) reasons.push("ExpiredAttestation");
  if (!contract.approvedMeasurements.some((m) => same(m, agent.measurements)))
    reasons.push("InvalidMeasurements");
  if (!contract.approvedPpids.includes(agent.ppid)) reasons.push("InvalidPpid");
  if (reasons.length) return { ok: false, error: `Invalid agent: [${reasons.join(", ")}]` };
  return {
    ok: true,
    call: {
      from: AGENT_CONTRACT,
      receiver: SIGNER_CONTRACT,
      method: "sign",
      deposit: "1 yoctoNEAR",
      args: { request: { payload_v2: { Ecdsa: payload }, path, domain_id: ECDSA_DOMAIN } },
    },
  };
}
