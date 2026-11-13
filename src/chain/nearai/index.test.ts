import { describe, expect, it, vi } from "vitest";
import {
  fetchAttestation,
  MAX_REPORT_BYTES,
  newNonce,
  parseReport,
  RECORDED_ATTESTATION,
  recordedDate,
  TUTOR_MODEL,
} from "./index";
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

  it("refuses a report for another nonce (an old one replayed)", async () => {
    const fetch = async () => new Response(JSON.stringify(report("cd".repeat(32))));
    await expect(fetchAttestation("ab".repeat(32), { fetch })).rejects.toThrow(
      "NEAR AI Cloud sent a quote for another nonce.",
    );
  });

  it("refuses a report that has no entry for the tutor model", () => {
    const json = report("ab".repeat(32));
    json.model_attestations[0]!.model_name = "some/other-model";
    expect(() => parseReport(json)).toThrow(`NEAR AI Cloud sent no report for ${TUTOR_MODEL}.`);
  });

  it("refuses a body that says it is over 1 MB, without reading it", async () => {
    const pull = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull });
    const fetch = async () =>
      new Response(body, { headers: { "content-length": String(MAX_REPORT_BYTES + 1) } });
    await expect(fetchAttestation("00", { fetch })).rejects.toThrow("NEAR AI Cloud sent more than 1 MB.");
  });

  it("stops reading a body that grows past 1 MB with no length given", async () => {
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        sent += 64 * 1024;
        c.enqueue(new Uint8Array(64 * 1024).fill(0x20));
      },
    });
    await expect(fetchAttestation("00", { fetch: async () => new Response(body) })).rejects.toThrow(
      "NEAR AI Cloud sent more than 1 MB.",
    );
    // It stopped soon after the cap instead of reading forever.
    expect(sent).toBeLessThan(MAX_REPORT_BYTES + 4 * 64 * 1024);
  });

  it("gives up when the service does not answer in time", async () => {
    const hang = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError"))),
      );
    await expect(fetchAttestation("00", { fetch: hang, timeoutMs: 20 })).rejects.toThrow(
      "NEAR AI Cloud did not answer.",
    );
  });

  it("gives up when the body stalls past the timeout", async () => {
    const stalled = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) });
    await expect(
      fetchAttestation("00", { fetch: async () => new Response(stalled), timeoutMs: 20 }),
    ).rejects.toThrow("NEAR AI Cloud did not answer.");
  });
});
