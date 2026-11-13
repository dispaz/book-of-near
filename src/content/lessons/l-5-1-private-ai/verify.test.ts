// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RECORDED_ATTESTATION, type Attestation } from "../../../chain/nearai";
import { checkAgainst, tamperCheck, verifyAttestation } from "./verify";

const live = (over: Partial<Attestation>): Attestation => ({
  ...RECORDED_ATTESTATION,
  source: "live",
  recordedOn: undefined,
  ...over,
});

describe("verifyAttestation (lesson 5.1, step 5)", () => {
  it("passes all eight checks on the recorded quote, with no notice", async () => {
    const v = await verifyAttestation(RECORDED_ATTESTATION);
    expect(v).toMatchObject({ ok: true, attestation: RECORDED_ATTESTATION, notice: null });
    expect("checks" in v && v.checks).toHaveLength(8);
  });

  it("names the recording's nonce for the recorded quote", async () => {
    const checks = await checkAgainst(RECORDED_ATTESTATION);
    expect(checks.find((c) => c.id === "report-data")!.label).toMatch(
      /nonce sent when this quote was recorded/,
    );
  });

  it("falls back to the recorded quote, with a notice, when a live quote cannot be read", async () => {
    for (const quote of ["not hex", "04000200" + "00".repeat(100)]) {
      const v = await verifyAttestation(live({ quote }));
      expect(v).toMatchObject({ ok: true, attestation: RECORDED_ATTESTATION });
      expect(v.notice).toMatch(
        /^The live quote could not be read: .+ Checking the quote recorded on 13 Nov 2026 instead\.$/,
      );
    }
  });

  it("falls back to the recorded quote, with a notice, when a live quote fails a check", async () => {
    const v = await verifyAttestation(live({ nonce: "00".repeat(32) }));
    expect(v).toMatchObject({ ok: true, attestation: RECORDED_ATTESTATION });
    expect(v.notice).toMatch(
      /^The live quote failed: .*nonce this page just sent\. Checking the quote recorded/,
    );
  });

  it("does not hide a recorded quote that cannot be read", async () => {
    const v = await verifyAttestation({ ...RECORDED_ATTESTATION, quote: "zz" });
    expect(v).toMatchObject({
      error: expect.any(String),
      notice: expect.stringMatching(/could not be read/),
    });
  });
});

describe("tamperCheck", () => {
  it("fails the signature once one byte changes", async () => {
    const checks = await tamperCheck(RECORDED_ATTESTATION);
    expect(checks!.find((c) => c.id === "quote-signature")!.ok).toBe(false);
  });

  it("returns null instead of throwing on a quote it cannot read", async () => {
    expect(await tamperCheck({ ...RECORDED_ATTESTATION, quote: "zz" })).toBeNull();
  });
});
