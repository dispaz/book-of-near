import { describe, expect, it } from "vitest";
import { RECORDED_ATTESTATION } from "../../../chain/nearai";
import {
  AGENT_CONTRACT,
  AGENT_MEASUREMENTS,
  bootAgent,
  CHANGED_MEASUREMENTS,
  DEVELOPER,
  EXAMPLE_PPID,
  newAgentContract,
  quoteFor,
  registerAgent,
  reportDataFor,
  requestSignature,
} from "./agentContract";

const NOW = 1_794_500_000_000;

describe("bootAgent: the agent's key is made inside the enclave", () => {
  it("makes a fresh ed25519 key whose public key, in hex, is the implicit account", () => {
    const a = bootAgent();
    const b = bootAgent();
    expect(a.accountId).toMatch(/^[0-9a-f]{64}$/);
    expect(a.accountId).not.toBe(b.accountId);
    // The private key is not part of what the lesson can show.
    expect(Object.keys(a)).toEqual(["accountId"]);
  });
});

describe("the example measurements", () => {
  it("are the real ones from the NEAR AI Cloud quote recorded in lesson 5.1", () => {
    expect(AGENT_MEASUREMENTS.mrtd).toBe(RECORDED_ATTESTATION.measurements.mrtd);
    expect(AGENT_MEASUREMENTS.rtmr2).toBe(RECORDED_ATTESTATION.measurements.rtmr2);
    expect(AGENT_MEASUREMENTS.composeHash).toBe(RECORDED_ATTESTATION.composeHash);
  });

  it("change only the app compose hash for the changed copy", () => {
    expect(CHANGED_MEASUREMENTS.composeHash).not.toBe(AGENT_MEASUREMENTS.composeHash);
    expect({ ...CHANGED_MEASUREMENTS, composeHash: "" }).toEqual({ ...AGENT_MEASUREMENTS, composeHash: "" });
  });
});

describe("registerAgent: the reference contract's checks", () => {
  it("puts the caller's account in the first 32 bytes of the 64-byte report data", () => {
    const id = "ab".repeat(32);
    expect(reportDataFor(id)).toBe("ab".repeat(32) + "00".repeat(32));
  });

  it("registers an agent whose quote is genuine, approved and bound to its own account", () => {
    const agent = bootAgent();
    const r = registerAgent(newAgentContract(), agent.accountId, quoteFor(agent.accountId), NOW);
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => [c.id, c.ok])).toEqual([
      ["genuine", true],
      ["measurements", true],
      ["ppid", true],
      ["reportData", true],
    ]);
    expect(r.contract.agents[agent.accountId]).toEqual({
      measurements: AGENT_MEASUREMENTS,
      ppid: EXAMPLE_PPID,
      validUntilMs: NOW + r.contract.expirationMs,
    });
  });

  it("refuses a changed copy: its measurements are not approved", () => {
    const copy = bootAgent();
    const r = registerAgent(
      newAgentContract(),
      copy.accountId,
      quoteFor(copy.accountId, CHANGED_MEASUREMENTS),
      NOW,
    );
    expect(r).toMatchObject({ ok: false, error: "Attestation verification failed: …" });
    expect(r.checks.find((c) => c.id === "measurements")!.ok).toBe(false);
    expect(r.contract.agents).toEqual({});
  });

  it("refuses someone else's quote replayed from another account", () => {
    const agent = bootAgent();
    const thief = bootAgent();
    const r = registerAgent(newAgentContract(), thief.accountId, quoteFor(agent.accountId), NOW);
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "reportData")!.ok).toBe(false);
  });

  it("refuses a named account: agents must be implicit accounts", () => {
    const r = registerAgent(newAgentContract(), DEVELOPER, quoteFor(DEVELOPER), NOW);
    expect(r).toMatchObject({ ok: false, error: "Account ID must be implicit account" });
  });
});

describe("requestSignature: agent-gated", () => {
  const registered = () => {
    const agent = bootAgent();
    const r = registerAgent(newAgentContract(), agent.accountId, quoteFor(agent.accountId), NOW);
    return { agent, contract: r.contract };
  };

  it("refuses the developer: 'Agent not registered'", () => {
    const { contract } = registered();
    const r = requestSignature(contract, DEVELOPER, NOW, { path: "ethereum-1", payload: "00".repeat(32) });
    expect(r).toEqual({ ok: false, error: "Agent not registered" });
  });

  it("lets a valid agent ask the signer to sign, with 1 yoctoNEAR, as the agent contract", () => {
    const { agent, contract } = registered();
    const payload = "11".repeat(32);
    const r = requestSignature(contract, agent.accountId, NOW, { path: "ethereum-1", payload });
    expect(r).toEqual({
      ok: true,
      call: {
        from: AGENT_CONTRACT,
        receiver: "v1.signer-prod.testnet",
        method: "sign",
        deposit: "1 yoctoNEAR",
        args: { request: { payload_v2: { Ecdsa: payload }, path: "ethereum-1", domain_id: 0 } },
      },
    });
  });

  it("refuses an expired registration as an invalid agent", () => {
    const { agent, contract } = registered();
    const late = NOW + contract.expirationMs + 1;
    const r = requestSignature(contract, agent.accountId, late, { path: "ethereum-1", payload: "00" });
    expect(r).toEqual({ ok: false, error: "Invalid agent: [ExpiredAttestation]" });
  });
});
