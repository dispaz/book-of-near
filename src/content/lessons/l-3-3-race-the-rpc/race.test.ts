import { describe, expect, it } from "vitest";
import { DemoChain } from "../../../chain/DemoChain";
import type { BlockRef } from "../../../chain/types";
import { barShare, failover, historical, race, RACE_IDS, varsFor } from "./race";

const chain = () => new DemoChain({ pace: "instant" });
const probeOf = (c: DemoChain) => (id: string, ref?: BlockRef) => c.probeRpc(id, ref, { pace: "instant" });

describe("race", () => {
  it("asks the three regular providers at once and picks the fastest answer", async () => {
    const seen: string[] = [];
    const r = await race(probeOf(chain()), (p) => seen.push(p.endpointId));
    expect(r.results.map((p) => p.endpointId).sort()).toEqual([...RACE_IDS].sort());
    expect(seen).toHaveLength(3);
    // Demo mode uses the round trips recorded on 12 Nov 2026.
    expect(r.winner).toMatchObject({ endpointId: "fastnear", latencyMs: 77 });
    expect(r.slowest).toMatchObject({ endpointId: "near-org", latencyMs: 3079 });
  });
});

describe("failover", () => {
  it("skips a blocked provider with a simulated 503 and lets the next one answer", async () => {
    const f = await failover(probeOf(chain()), ["fastnear"]);
    expect(f.attempts).toMatchObject([
      { endpointId: "fastnear", ok: false, status: 503, simulated: true, latencyMs: 0 },
      { endpointId: "near-org", ok: true, simulated: false, latencyMs: 3079 },
    ]);
    expect(f.answeredBy).toBe("near-org");
    expect(f.totalMs).toBe(3079);
    expect(f.blockHeight).toBeGreaterThan(0);
  });

  it("goes down the whole list and reports no answer when every provider is blocked", async () => {
    const f = await failover(probeOf(chain()), [...RACE_IDS]);
    expect(f.attempts).toHaveLength(3);
    expect(f.answeredBy).toBeNull();
  });

  it("moves on when a real node fails too", async () => {
    const probe = async (id: string) =>
      id === "near-org"
        ? {
            ok: false as const,
            endpointId: id,
            latencyMs: 40,
            error: "Unavailable" as const,
            status: 429,
            message: "busy",
          }
        : { ok: true as const, endpointId: id, latencyMs: 90, blockHeight: 5, blockTimestampMs: 0 };
    const f = await failover(probe, ["fastnear"]);
    expect(f.attempts.map((a) => a.endpointId)).toEqual(["fastnear", "near-org", "fastnear-2"]);
    expect(f.answeredBy).toBe("fastnear-2");
    expect(f.totalMs).toBe(130);
  });
});

describe("historical", () => {
  it("a regular node does not keep block 100,000,000; the archival node does", async () => {
    const h = await historical(probeOf(chain()));
    expect(h.regular).toMatchObject({ ok: false, error: "UnknownBlock" });
    expect(h.archival).toMatchObject({ ok: true, blockHeight: 100_000_000 });
  });
});

describe("barShare", () => {
  it("scales to the slowest answer and never vanishes", () => {
    expect(barShare(3079, 3079)).toBe(1);
    expect(barShare(77, 3079)).toBeGreaterThanOrEqual(0.04);
    expect(barShare(0, 0)).toBe(0.04);
  });
});

describe("varsFor", () => {
  it("puts the learner's own numbers into the later text", async () => {
    const c = chain();
    const r = await race(probeOf(c));
    const f = await failover(probeOf(c), ["fastnear"]);
    expect(varsFor(r, f)).toEqual({
      fastest: "FastNEAR",
      fastestMs: "77",
      slowest: "NEAR Foundation",
      slowestMs: "3,079",
      backup: "NEAR Foundation",
      backupMs: "3,079",
    });
  });
});
