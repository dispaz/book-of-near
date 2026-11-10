import { describe, expect, it } from "vitest";
import { DemoChain } from "../../../chain/DemoChain";
import { transfer } from "../../../chain/ops";
import { parseNear } from "../../../chain/units";
import { RECORDED } from "./recorded";
import {
  breakdown,
  loadTrace,
  readSeenEvidence,
  timeSplit,
  touchedBlocks,
  touchedShards,
  varsFor,
} from "./trace";

describe("loadTrace on the demo chain", () => {
  it("builds the transfer's path: transaction, receipt, refund, in later blocks", async () => {
    const chain = new DemoChain();
    const me = await chain.practiceAccount();
    const out = await transfer(chain, await chain.returnAccount(), parseNear("0.01"), { pace: "instant" });
    const trace = await loadTrace(chain, out.transaction.hash, me.accountId, "demo");
    expect(trace.hops.map((h) => h.kind)).toEqual(["transaction", "receipt", "refund"]);
    expect(trace.hops.every((h) => h.chunkHash.length > 20)).toBe(true);
    const heights = trace.hops.map((h) => h.blockHeight);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    expect(trace.hops[0]!.sinceMs).toBe(0);
    expect(trace.workMs).toBeGreaterThan(0);
    expect(trace.shardIds).toEqual((await chain.shardLayout()).shardIds);
  });
});

describe("recorded example", () => {
  it("crosses three shards in five blocks", () => {
    expect(touchedShards(RECORDED)).toEqual([9, 4, 5]);
    expect(touchedBlocks(RECORDED)).toHaveLength(5);
    expect(RECORDED.shardIds).toHaveLength(10);
    expect(RECORDED.hops.map((h) => h.kind)).toContain("callback");
    expect(RECORDED.workMs).toBe(2369);
  });
  it("fills the lesson's numbers", () => {
    expect(varsFor(RECORDED)).toMatchObject({
      firstShard: "9",
      firstBlock: "275719637",
      hops: "7",
      shardsTouched: "3 shards",
      blocksCount: "5 blocks",
      workTime: "2.37 s",
    });
  });
});

describe("0.3 evidence", () => {
  it("reads numbers and splits the stopwatch", () => {
    const seen = readSeenEvidence({ txHash: "abc", mode: "demo", includedMs: "850", finalMs: "3250" })!;
    expect(seen).toEqual({ txHash: "abc", mode: "demo", includedMs: 850, finalMs: 3250 });
    const demoTrace = { ...RECORDED, source: "demo" as const, workMs: 1200 };
    expect(timeSplit(demoTrace, seen)).toEqual({
      includedMs: 850,
      workMs: 1200,
      restMs: 1200,
      finalMs: 3250,
    });
    expect(timeSplit(RECORDED, seen)).toBeNull();
    expect(readSeenEvidence({})).toBeNull();
  });
});

describe("time breakdown (step 5)", () => {
  it("splits the learner's own 0.3 stopwatch into hand-over, shard hops and finality", () => {
    const seen = readSeenEvidence({ txHash: "abc", mode: "demo", includedMs: "850", finalMs: "3250" })!;
    const own = { ...RECORDED, source: "demo" as const, workMs: 1200 };
    expect(breakdown(own, seen).map((p) => [p.key, p.ms])).toEqual([
      ["handover", 850],
      ["hops", 1200],
      ["finality", 1200],
    ]);
    expect(varsFor(own, seen).finalSeen).toBe("the 3.25 s until Final in 0.3");
  });

  it("shows only the shard hops for the recorded example (it has no stopwatch)", () => {
    expect(breakdown(RECORDED, null).map((p) => [p.key, p.ms])).toEqual([["hops", 2369]]);
    // A learner who skipped 0.3 never saw a wait: the caption talks about any transaction instead.
    expect(varsFor(RECORDED).finalSeen).toBe("the few seconds a transaction takes to become final");
  });

  it("every part has a plain label", () => {
    const seen = readSeenEvidence({ txHash: "abc", mode: "demo", includedMs: "850", finalMs: "3250" })!;
    for (const p of breakdown({ ...RECORDED, source: "demo" }, seen))
      expect(p.label.length).toBeGreaterThan(4);
  });
});
