import { describe, expect, it } from "vitest";
import { DemoChain } from "./DemoChain";
import {
  deriveEvmAccount,
  finalizeEvmTransaction,
  parseSignResponse,
  prepareEvmTransfer,
  recoverEvmSigner,
  requestSignature,
  rootPublicKey,
  signRequestArgs,
  SIGNER_CONTRACT,
  SIGN_DEPOSIT,
} from "./chainSignatures";
import { callMethod } from "./ops";
import { isChainError } from "./errors";

/** The testnet signer's root key, read with the `public_key` view on 10 Nov 2026 (v1.signer-prod.testnet). */
const TESTNET_ROOT =
  "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3"; // public key, not a secret: secret-scan:allow

describe("address derivation (offline)", () => {
  it("matches the address the spike derived for predecessor testnet, path ethereum-1", () => {
    // docs/spikes-seed.md, spike 5: testnet + ethereum-1 → 0x2F9e1556Ae1F8Fa558C6cDC25257dE8253511280.
    const a = deriveEvmAccount(TESTNET_ROOT, "testnet", "ethereum-1");
    expect(a.address).toBe("0x2F9e1556Ae1F8Fa558C6cDC25257dE8253511280");
  });

  it("matches the contract's own derived_public_key view", () => {
    // derived_public_key({ path: "ethereum-1", predecessor: "testnet", domain_id: 0 }), 10 Nov 2026.
    const a = deriveEvmAccount(TESTNET_ROOT, "testnet", "ethereum-1");
    expect(a.publicKey).toBe(
      "secp256k1:5CGv9fbY8RDd9yF8diidJrZh5iUkSsdwZ3m9cXYT1aYTWB5GjjbDsRm3S6Gi3GCiYXsz819M9JTfk2NYmCrsGdeq", // public key: secret-scan:allow
    );
  });

  it("gives a different address for another path or another account, the same for the same inputs", () => {
    const a = deriveEvmAccount(TESTNET_ROOT, "alice.testnet", "ethereum-1").address;
    expect(deriveEvmAccount(TESTNET_ROOT, "alice.testnet", "ethereum-1").address).toBe(a);
    expect(deriveEvmAccount(TESTNET_ROOT, "alice.testnet", "ethereum-2").address).not.toBe(a);
    expect(deriveEvmAccount(TESTNET_ROOT, "bob.testnet", "ethereum-1").address).not.toBe(a);
  });
});

describe("the sign request and its answer", () => {
  it("builds the contract's raw arguments: payload_v2 Ecdsa hex, path, domain 0", () => {
    const payload = `0x${"ab".repeat(32)}` as const;
    expect(signRequestArgs(payload, "ethereum-1")).toEqual({
      request: { payload_v2: { Ecdsa: "ab".repeat(32) }, path: "ethereum-1", domain_id: 0 },
    });
  });

  it("reads the MPC answer (big_r, s, recovery_id) into r, s and yParity", () => {
    const r = "11".repeat(32);
    const s = "22".repeat(32);
    expect(
      parseSignResponse({
        scheme: "Secp256k1",
        big_r: { affine_point: `03${r}` },
        s: { scalar: s },
        recovery_id: 1,
      }),
    ).toEqual({ r: `0x${r}`, s: `0x${s}`, yParity: 1 });
    expect(() => parseSignResponse({ nope: 1 })).toThrow();
  });
});

describe("the whole flow on DemoChain", () => {
  it("derives, prepares, signs through the signer contract, and the signature recovers to the address", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const me = (await chain.practiceAccount()).accountId;
    const root = await rootPublicKey(chain);
    expect(root).toMatch(/^secp256k1:/);
    const account = deriveEvmAccount(root, me, "ethereum-1");
    const prepared = prepareEvmTransfer({ from: account.address });
    expect(prepared.payload).toMatch(/^0x[0-9a-f]{64}$/);
    expect(prepared.fields.nonce).toBe(0);

    const phases: string[] = [];
    const out = await requestSignature(chain, prepared.payload, "ethereum-1", {
      pace: "instant",
      onPhase: (e) => phases.push(e.phase),
    });
    expect(phases).toContain("final");
    expect(out.txHash).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
    // The answer comes back in a later block than the request: the request waits for the network.
    expect(out.waitBlocks).toBeGreaterThanOrEqual(5);

    const signed = finalizeEvmTransaction(prepared, out.signature);
    expect(signed).toMatch(/^0x02/);
    expect(await recoverEvmSigner(signed)).toBe(account.address);
  });

  it("refuses a sign call without the 1 yoctoNEAR deposit", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const out = await callMethod(chain, SIGNER_CONTRACT, "sign", signRequestArgs(`0x${"00".repeat(32)}`, "x"), {
      pace: "instant",
    });
    expect(out.status.type).toBe("Failure");
    expect(SIGN_DEPOSIT).toBe(1n);
  });

  it("takes about five seconds in real time", async () => {
    const waits: number[] = [];
    const chain = new DemoChain({ sleep: async (ms) => void waits.push(ms) });
    const prepared = prepareEvmTransfer({ from: "0x2F9e1556Ae1F8Fa558C6cDC25257dE8253511280" });
    await requestSignature(chain, prepared.payload, "ethereum-1", { pace: "realtime" });
    const total = waits.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(4000);
    expect(total).toBeLessThan(9000);
  });

  it("reports a refused signature as a chain error", async () => {
    const chain = new DemoChain({ pace: "instant", practiceBalance: 0n });
    const e = await requestSignature(chain, `0x${"00".repeat(32)}`, "ethereum-1", { pace: "instant" }).catch(
      (x: unknown) => x,
    );
    expect(isChainError(e)).toBe(true);
  });
});
