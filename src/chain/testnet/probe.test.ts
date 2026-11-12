import { describe, expect, it } from "vitest";
import { probeEndpoint } from "./probe";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A clock that moves `step` ms each time it is read. */
const clock = (step: number) => {
  let t = 1000;
  return () => (t += step);
};

describe("probeEndpoint", () => {
  it("times a block request and reads the height and time", async () => {
    let sent: unknown = null;
    const p = await probeEndpoint("fastnear", "https://x", "final", {
      now: clock(40),
      fetch: async (_url, init) => {
        sent = JSON.parse(String(init?.body));
        return json({ result: { header: { height: 123, timestamp_nanosec: "1662964982304434590" } } });
      },
    });
    expect(sent).toMatchObject({ method: "block", params: { finality: "final" } });
    expect(p).toEqual({
      ok: true,
      endpointId: "fastnear",
      latencyMs: 40,
      blockHeight: 123,
      blockTimestampMs: 1662964982304,
    });
  });

  it("asks for a height and reports a block the node does not keep", async () => {
    let sent: unknown = null;
    const p = await probeEndpoint(
      "fastnear",
      "https://x",
      { height: 100_000_000 },
      {
        fetch: async (_url, init) => {
          sent = JSON.parse(String(init?.body));
          return json({ error: { cause: { name: "UNKNOWN_BLOCK" } } }, 422);
        },
      },
    );
    expect(sent).toMatchObject({ params: { block_id: 100_000_000 } });
    expect(p).toMatchObject({ ok: false, error: "UnknownBlock", status: 422 });
  });

  it("reports a 503, a 429 and no answer as unavailable, never throws", async () => {
    for (const status of [503, 429]) {
      const p = await probeEndpoint("near-org", "https://x", "final", {
        fetch: async () => new Response("busy", { status }),
      });
      expect(p).toMatchObject({ ok: false, error: "Unavailable", status });
    }
    const p = await probeEndpoint("near-org", "https://x", "final", {
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(p).toMatchObject({ ok: false, error: "Unavailable" });
  });

  it("passes the caller's signal to fetch and rejects once it is aborted", async () => {
    const ctl = new AbortController();
    let seen: AbortSignal | null | undefined;
    const p = probeEndpoint("fastnear", "https://x", "final", {
      signal: ctl.signal,
      fetch: (_url, init) =>
        new Promise((_, reject) => {
          seen = init?.signal;
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    });
    ctl.abort();
    await expect(p).rejects.toThrow();
    expect(seen?.aborted).toBe(true);
  });
});
