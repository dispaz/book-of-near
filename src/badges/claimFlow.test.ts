import { describe, expect, it, vi } from "vitest";
import { DemoChain } from "../chain/DemoChain";
import type { CompletionRecord } from "../progress/types";
import { claimStageBadge } from "./claimFlow";

const rec = (
  lessonId: string,
  evidence?: Record<string, string>,
  mode: "demo" | "testnet" = "demo",
): CompletionRecord => ({
  lessonId,
  stage: Number(lessonId.split("-")[1]),
  route: "newcomer",
  mode,
  completedAt: "2026-11-12T00:00:00.000Z",
  ...(evidence ? { evidence } : {}),
});

const stage0 = [
  rec("l-0-1-blockchain-basics"),
  rec("l-0-2-make-a-wallet"),
  rec("l-0-3-send-a-transaction", { txHash: "H0", mode: "demo" }),
];
const stage1 = [
  rec("l-1-1-claim-your-name", { txHash: "A", accountId: "me.testnet" }),
  rec("l-1-2-function-call-key", { txHash: "D", addKeyTxHash: "K" }),
  rec("l-1-3-inside-a-transaction"),
];

describe("claimStageBadge in demo mode (signs in the browser, no Worker, no network)", () => {
  it("claims stage 0 after its lessons and keeps the badge", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const keep = vi.fn();
    const r = await claimStageBadge(chain, 0, stage0, { keepDemoBadges: keep });
    expect(r).toMatchObject({ ok: true, tokenId: "0" });
    const me = await chain.practiceAccount();
    expect(await chain.hasBadge(me.accountId, 0)).toBe(true);
    expect(keep).toHaveBeenCalledWith([{ owner: me.accountId, stage: 0, mintedAtMs: expect.any(Number) }]);
  });

  it("refuses before the stage is finished, saying what is missing", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const r = await claimStageBadge(chain, 0, stage0.slice(0, 1), {});
    expect(r).toEqual({ ok: false, error: "Finish lesson 0.2." });
  });

  it("says when the badge is already held (a reused claim)", async () => {
    const chain = new DemoChain({ pace: "instant" });
    await claimStageBadge(chain, 0, stage0, {});
    const again = await claimStageBadge(chain, 0, stage0, {});
    expect(again).toEqual({ ok: false, error: "You already hold this badge." });
  });

  it("stage 1 needs the stage 0 badge first", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const r = await claimStageBadge(chain, 1, [...stage0, ...stage1], {});
    expect(r).toEqual({ ok: false, error: "Claim the stage 0 badge first." });
    expect((await claimStageBadge(chain, 0, [...stage0, ...stage1], {})).ok).toBe(true);
    expect((await claimStageBadge(chain, 1, [...stage0, ...stage1], {})).ok).toBe(true);
  });
});

describe("claimStageBadge in testnet mode (the Worker signs)", () => {
  it("explains that testnet badges need testnet evidence", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const testnetLike = Object.assign(Object.create(chain) as DemoChain, { network: "testnet" as const });
    const r = await claimStageBadge(testnetLike, 0, stage0, { workerUrl: "https://w.example" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/demo mode/);
  });

  it("sends the testnet evidence to the Worker and submits the claim it signs", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const testnetLike = Object.assign(Object.create(chain) as DemoChain, { network: "testnet" as const });
    const testnet0 = stage0.map((c) => ({ ...c, mode: "testnet" as const }));
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Send your first transaction in lesson 0.3." }), {
          status: 403,
        }),
    );
    const r = await claimStageBadge(testnetLike, 0, testnet0, {
      workerUrl: "https://w.example",
      fetch: fetchFn,
    });
    expect(r).toEqual({ ok: false, error: "Send your first transaction in lesson 0.3." });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://w.example/claim");
    const sent = JSON.parse(String(init.body)) as {
      accountId: string;
      stage: number;
      evidence: Record<string, unknown>;
    };
    expect(sent.stage).toBe(0);
    expect(sent.evidence["l-0-3-send-a-transaction"]).toEqual({ txHash: "H0", mode: "demo" });
  });

  it("says plainly when there is no Worker to sign", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const testnetLike = Object.assign(Object.create(chain) as DemoChain, { network: "testnet" as const });
    const testnet0 = stage0.map((c) => ({ ...c, mode: "testnet" as const }));
    const r = await claimStageBadge(testnetLike, 0, testnet0, {});
    expect(!r.ok && r.error).toMatch(/not set up/);
  });
});
