// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hexToBytes, INTEL_SGX_ROOT_SHA256, parseTdxQuote, verifyTdxQuote, type CheckId } from "./tdx";
import recorded from "./recorded-attestation.json";

const bytes = () => hexToBytes(recorded.intel_quote);
const expected = {
  address: recorded.signing_address,
  nonce: recorded.request_nonce,
  measurements: recorded.tcb_info,
};
const okOf = (checks: { id: CheckId; ok: boolean }[]) => Object.fromEntries(checks.map((c) => [c.id, c.ok]));

describe("parseTdxQuote (the recorded NEAR AI Cloud quote, 13 Nov 2026)", () => {
  it("reads an Intel TDX quote, version 4, with its measurements and report data", () => {
    const q = parseTdxQuote(bytes());
    expect(q.version).toBe(4);
    expect(q.tee).toBe("Intel TDX");
    expect(q.size).toBe(5006);
    expect(q.mrtd).toBe(recorded.tcb_info.mrtd);
    expect(q.rtmr).toEqual([
      recorded.tcb_info.rtmr0,
      recorded.tcb_info.rtmr1,
      recorded.tcb_info.rtmr2,
      recorded.tcb_info.rtmr3,
    ]);
    // Report data: the model's signing address (padded to 32 bytes), then the request's nonce.
    expect(q.reportData.startsWith(recorded.signing_address.slice(2))).toBe(true);
    expect(q.reportData.endsWith(recorded.request_nonce)).toBe(true);
    // TDATTRIBUTES 0000001000000000: the DEBUG bit (bit 0) is clear.
    expect(q.tdAttributes).toBe("0000001000000000");
    expect(q.debug).toBe(false);
    expect(q.certs.map((c) => c.name)).toEqual([
      "Intel SGX PCK Certificate",
      "Intel SGX PCK Platform CA",
      "Intel SGX Root CA",
    ]);
  });

  it("refuses bytes that are not a TDX quote", () => {
    expect(() => parseTdxQuote(new Uint8Array(40))).toThrow(/not a TDX quote/i);
    const sgx = bytes();
    sgx[4] = 0; // TEE type 0 is SGX, not TDX
    expect(() => parseTdxQuote(sgx)).toThrow(/not a TDX quote/i);
  });
});

describe("verifyTdxQuote", () => {
  it("passes every check on the recorded quote, ending at Intel's published root", async () => {
    const checks = await verifyTdxQuote(parseTdxQuote(bytes()), expected);
    expect(checks.map((c) => c.id)).toEqual([
      "quote-signature",
      "qe-binds-key",
      "qe-signature",
      "chain",
      "intel-root",
      "report-data",
      "measurements",
      "not-debug",
    ]);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(INTEL_SGX_ROOT_SHA256).toBe("44a0196b2b99f889b8e149e95b807a350e7424964399e885a7cbb8ccfab674d3");
  });

  it("fails the quote signature when one byte of the signed report changes", async () => {
    const b = bytes();
    b[48 + 136] = b[48 + 136]! ^ 0x01; // one bit of MRTD
    const ok = okOf(await verifyTdxQuote(parseTdxQuote(b), expected));
    expect(ok["quote-signature"]).toBe(false);
    expect(ok["measurements"]).toBe(false);
    expect(ok["chain"]).toBe(true);
  });

  it("fails the report-data check for another nonce (an old quote replayed)", async () => {
    const ok = okOf(await verifyTdxQuote(parseTdxQuote(bytes()), { ...expected, nonce: "00".repeat(32) }));
    expect(ok["report-data"]).toBe(false);
    expect(ok["quote-signature"]).toBe(true);
  });

  it("fails the root check when the chain ends somewhere other than Intel's root", async () => {
    const ok = okOf(await verifyTdxQuote(parseTdxQuote(bytes()), expected, { rootSha256: "ab".repeat(32) }));
    expect(ok["intel-root"]).toBe(false);
  });

  it("fails the debug check when the TD runs in debug mode", async () => {
    const b = bytes();
    b[48 + 120] = b[48 + 120]! | 0x01; // TDATTRIBUTES bit 0: DEBUG
    const q = parseTdxQuote(b);
    expect(q.debug).toBe(true);
    const ok = okOf(await verifyTdxQuote(q, expected));
    expect(ok["not-debug"]).toBe(false);
    // The signed report changed, so its signature fails too; the rest still hold.
    expect(ok["quote-signature"]).toBe(false);
    expect(ok["measurements"]).toBe(true);
    expect(ok["chain"]).toBe(true);
  });

  it("fails the debug check on its own merit, with the signature left valid", async () => {
    const q = { ...parseTdxQuote(bytes()), debug: true };
    const ok = okOf(await verifyTdxQuote(q, expected));
    expect(ok["not-debug"]).toBe(false);
    expect(ok["quote-signature"]).toBe(true);
  });

  it("fails the chain when the intermediate certificate's signature is broken", async () => {
    const q = parseTdxQuote(bytes());
    const platformCa = q.certs[1]!; // Intel SGX PCK Platform CA, signed by the root
    platformCa.signature[10] = platformCa.signature[10]! ^ 0x01;
    const ok = okOf(await verifyTdxQuote(q, expected));
    expect(ok["chain"]).toBe(false);
    expect(ok["qe-signature"]).toBe(true);
    expect(ok["intel-root"]).toBe(true);
  });

  it("fails the quoting-enclave binding when its report data does not end in zeros", async () => {
    const q = parseTdxQuote(bytes());
    const qeReport = new Uint8Array(q.qeReport);
    qeReport[360] = 1;
    const ok = okOf(await verifyTdxQuote({ ...q, qeReport }, expected));
    expect(ok["qe-binds-key"]).toBe(false);
  });
});
