import { describe, expect, it, vi } from "vitest";
import { fetchAttestation, newNonce, RECORDED_ATTESTATION, recordedDate, TUTOR_MODEL } from "./index";
import recorded from "./recorded-attestation.json";

/** A report in the endpoint's shape (as recorded on 13 Nov 2026), trimmed to the fields the app reads. */
const report = (nonce: string) => ({
  gateway_attestation: {},
  model_attestations: [
    {
      model_name: recorded.model_name,
      signing_address: recorded.signing_address,
      request_nonce: nonce,
      intel_quote: recorded.intel_quote,
      nvidia_payload: JSON.stringify({ arch: "HOPPER", evidence_list: [{}, {}] }),
      info: {
        app_name: recorded.app_name,
        compose_hash: recorded.compose_hash,
        tcb_info: JSON.stringify(recorded.tcb_info),
      },
    },
  ],
});

describe("NEAR AI Cloud attestation", () => {
  it("labels the recorded report with its date", () => {
    expect(RECORDED_ATTESTATION.source).toBe("recorded");
    expect(recordedDate(RECORDED_ATTESTATION.recordedOn!)).toBe("13 Nov 2026");
    expect(RECORDED_ATTESTATION.gpus).toEqual({ arch: "HOPPER", count: 8 });
  });

  it("makes a fresh 32-byte nonce each time", () => {
    const a = newNonce();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(newNonce()).not.toBe(a);
  });

  it("asks for the tutor model's report with our nonce, with no key", async () => {
    const nonce = "ab".repeat(32);
    const fetch = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(report(nonce))),
    );
    const a = await fetchAttestation(nonce, { fetch });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(
      `https://cloud-api.near.ai/v1/attestation/report?model=${encodeURIComponent(TUTOR_MODEL)}&nonce=${nonce}&signing_algo=ecdsa`,
    );
    expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/authorization/i);
    expect(a).toMatchObject({ source: "live", nonce, gpus: { arch: "HOPPER", count: 2 } });
    expect(a.measurements).toEqual(recorded.tcb_info);
  });

  it("says why when the service fails", async () => {
    await expect(
      fetchAttestation("00", { fetch: async () => new Response("", { status: 503 }) }),
    ).rejects.toThrow("NEAR AI Cloud answered 503.");
    await expect(
      fetchAttestation("00", { fetch: async () => Promise.reject(new TypeError("Failed to fetch")) }),
    ).rejects.toThrow("NEAR AI Cloud did not answer.");
  });
});
