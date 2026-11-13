import { describe, expect, it } from "vitest";
import { demoSignClaim } from "../../badges/demoSigner";
import { DemoChain } from "../DemoChain";
import type { Chain, TxOutcome } from "../types";

const failure = (out: TxOutcome) => (out.status.type === "Failure" ? out.status.error.message : null);

async function claim(chain: Chain, stage: number, opts: { ttlMs?: number; account?: string } = {}) {
  const me = await chain.practiceAccount();
  const now = (await chain.block("final")).timestampMs;
  const signed = demoSignClaim(
    await chain.badgeContractId(),
    opts.account ?? me.accountId,
    stage,
    now,
    opts.ttlMs,
  );
  return chain.claimBadge(signed);
}

describe("DemoChain badge contract (same rules as contracts/badge)", () => {
  it("mints a stage 0 badge for a valid claim, visible through badgesOf and hasBadge", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const me = await chain.practiceAccount();
    expect(await chain.hasBadge(me.accountId, 0)).toBe(false);
    const out = await claim(chain, 0);
    expect(failure(out)).toBeNull();
    expect(await chain.hasBadge(me.accountId, 0)).toBe(true);
    const badges = await chain.badgesOf(me.accountId);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toMatchObject({ stage: 0, owner: me.accountId, media: "stage-0.svg" });
    expect(out.receipts.flatMap((r) => r.logs).some((l) => l.includes('"event":"nft_mint"'))).toBe(true);
  });

  it("refuses a second badge for the same stage (a reused claim)", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const me = await chain.practiceAccount();
    const now = (await chain.block("final")).timestampMs;
    const signed = demoSignClaim(await chain.badgeContractId(), me.accountId, 0, now);
    expect(failure(await chain.claimBadge(signed))).toBeNull();
    expect(failure(await chain.claimBadge(signed))).toMatch(/already claimed/);
    expect(await chain.badgesOf(me.accountId)).toHaveLength(1);
  });

  it("refuses an expired claim", async () => {
    const chain = new DemoChain({ pace: "instant" });
    expect(failure(await claim(chain, 0, { ttlMs: -1 }))).toMatch(/Claim expired/);
  });

  it("refuses a stage whose previous stage is missing", async () => {
    const chain = new DemoChain({ pace: "instant" });
    expect(failure(await claim(chain, 1))).toMatch(/previous stage first/);
    expect(failure(await claim(chain, 0))).toBeNull();
    expect(failure(await claim(chain, 1))).toBeNull();
    const me = await chain.practiceAccount();
    expect((await chain.badgesOf(me.accountId)).map((b) => b.stage)).toEqual([0, 1]);
  });

  it("refuses a claim signed for another account", async () => {
    const chain = new DemoChain({ pace: "instant" });
    expect(failure(await claim(chain, 0, { account: "someone.testnet" }))).toMatch(/Invalid claim signature/);
  });

  it("refuses an unknown stage", async () => {
    const chain = new DemoChain({ pace: "instant" });
    expect(failure(await claim(chain, 6))).toMatch(/Unknown stage/);
  });

  it("starts with the badges of an earlier visit", async () => {
    const first = new DemoChain({ pace: "instant" });
    const me = await first.practiceAccount();
    await claim(first, 0);
    const kept = (await first.badgesOf(me.accountId)).map((b) => ({
      owner: b.owner,
      stage: b.stage,
      mintedAtMs: b.mintedAtMs,
    }));
    const again = new DemoChain({ pace: "instant", badges: kept });
    expect(await again.hasBadge(me.accountId, 0)).toBe(true);
    expect(failure(await claim(again, 1))).toBeNull();
    expect((await again.badgesOf(me.accountId)).map((b) => [b.tokenId, b.stage])).toEqual([
      ["0", 0],
      ["1", 1],
    ]);
  });

  it("shows nothing for an account without badges", async () => {
    const chain = new DemoChain({ pace: "instant" });
    expect(await chain.badgesOf("nobody.testnet")).toEqual([]);
  });
});
