import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ed25519 } from "@noble/curves/ed25519.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";
import { describe, expect, it, vi } from "vitest";
import { DEMO_CLAIM_SEED } from "../chain/demo/badges";
import { DemoChain } from "../chain/DemoChain";
import { examMessage, type ExamReceipt } from "../exam/grade";
import { addDemoFinal, DEMO_FINALS_KEY, keepDemoFinals, loadDemoFinals } from "./demoLedger";
import { EVENT_WINDOW, inEventWindow, rarityFor, receiptProblem } from "./final";
import { claimFinalBadge, demoSignFinal, plainFinalError } from "./finalFlow";
import { finalMessage, RARITIES } from "./message";

const IN = Date.UTC(2026, 10, 2);
const AFTER = Date.UTC(2026, 11, 1);

describe("rarityFor (score sets the tier, a pass in the event window raises it one)", () => {
  it("maps score and time to the four tiers the contract accepts", () => {
    expect(rarityFor(12, 15, AFTER)).toBe("common");
    expect(rarityFor(13, 15, AFTER)).toBe("rare");
    expect(rarityFor(14, 15, AFTER)).toBe("rare");
    expect(rarityFor(15, 15, AFTER)).toBe("epic");
    expect(rarityFor(12, 15, IN)).toBe("rare");
    expect(rarityFor(14, 15, IN)).toBe("epic");
    expect(rarityFor(15, 15, IN)).toBe("legendary");
    for (const s of [12, 13, 14, 15])
      for (const t of [IN, AFTER]) expect(RARITIES).toContain(rarityFor(s, 15, t));
  });

  it("the event window is the hackathon: 1 Nov 2026 00:00 UTC to the end of 14 Nov 2026 UTC", () => {
    expect(inEventWindow(EVENT_WINDOW.startMs - 1)).toBe(false);
    expect(inEventWindow(Date.UTC(2026, 10, 1))).toBe(true);
    expect(inEventWindow(Date.UTC(2026, 10, 14, 23, 59, 59, 999))).toBe(true);
    expect(inEventWindow(Date.UTC(2026, 10, 15))).toBe(false);
  });
});

describe("finalMessage", () => {
  it("is the contract's final claim text", () => {
    expect(finalMessage("badges.x.testnet", "alice.testnet", "general", "epic", 1_800_000_000_000)).toBe(
      "bon-badge-v1|badges.x.testnet|alice.testnet|final|general|epic|1800000000000",
    );
  });

  it("has exactly the bytes contracts/badge final_message builds (same format, same argument order)", () => {
    const rs = readFileSync(join(__dirname, "../../contracts/badge/src/lib.rs"), "utf8");
    const fn = rs.slice(rs.indexOf("pub fn final_message"), rs.indexOf("// ---------- Public views"));
    const format = /format!\(\s*"([^"]+)",([\s\S]*?)\)\s*\}/.exec(fn);
    expect(format).not.toBeNull();
    const args = format![2]!
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    expect(args).toEqual(["env::current_account_id()", "account_id", "route", "rarity", "expires_at_ms"]);
    const values: Record<string, string> = {
      "env::current_account_id()": "badges.x.testnet",
      account_id: "alice.testnet",
      route: "developer",
      rarity: "legendary",
      expires_at_ms: "1800000000000",
    };
    let i = 0;
    const rebuilt = format![1]!.replace(/\{\}/g, () => values[args[i++]!]!);
    const ours = finalMessage(
      "badges.x.testnet",
      "alice.testnet",
      "developer",
      "legendary",
      1_800_000_000_000,
    );
    expect(new TextEncoder().encode(ours)).toEqual(new TextEncoder().encode(rebuilt));
    // The contract checks the caller as the account: `final_message(account.clone(), ...)` with the predecessor.
    const claim = rs.slice(rs.indexOf("pub fn claim_final"), rs.indexOf("pub fn stage_message"));
    expect(claim).toMatch(/let account = env::predecessor_account_id\(\);/);
    expect(claim).toMatch(/self\.final_message\(\s*account\.clone\(\)/);
  });
});

const CONTRACT = "badges.book-of-near.testnet";

function demoReceipt(over: Partial<ExamReceipt> = {}, seed = DEMO_CLAIM_SEED): ExamReceipt {
  const r: ExamReceipt = {
    contractId: CONTRACT,
    accountId: "me.testnet",
    route: "general",
    score: 15,
    total: 15,
    passedAtMs: IN,
    signature: "",
    ...over,
  };
  r.signature = base64.encode(
    ed25519.sign(
      utf8ToBytes(examMessage(r.contractId, r.accountId, r.route, r.score, r.total, r.passedAtMs)),
      seed,
    ),
  );
  return r;
}

describe("receiptProblem", () => {
  const want = { contractId: CONTRACT, accountId: "me.testnet", route: "general" as const, total: 15 };
  it("accepts a pass for this contract, account and route", () => {
    expect(receiptProblem(demoReceipt(), want)).toBeNull();
  });
  it("names what is wrong", () => {
    expect(receiptProblem(null, want)).toMatch(/passed exam/);
    expect(receiptProblem({ ...demoReceipt(), score: "15" }, want)).toMatch(/not complete/);
    expect(receiptProblem(demoReceipt({ contractId: "other.testnet" }), want)).toMatch(
      /another badge contract/,
    );
    expect(receiptProblem(demoReceipt({ accountId: "you.testnet" }), want)).toMatch(/another account/);
    expect(receiptProblem(demoReceipt({ route: "developer" }), want)).toMatch(/another exam route/);
    expect(receiptProblem(demoReceipt({ score: 16 }), want)).toMatch(/does not fit/);
    expect(receiptProblem(demoReceipt({ score: 11 }), want)).toMatch(/not for a passed exam/);
  });
});

describe("demoSignFinal", () => {
  it("signs the claim with the demo key after checking the receipt's demo signature", () => {
    const c = demoSignFinal(CONTRACT, "me.testnet", "general", demoReceipt({ score: 14 }), 1000);
    expect(typeof c).not.toBe("string");
    if (typeof c === "string") return;
    expect(c).toMatchObject({ route: "general", rarity: "epic", expiresAtMs: 1000 + 5 * 60_000 });
  });
  it("refuses a receipt signed by any other key, or edited after signing", () => {
    const other = new Uint8Array(32).fill(7);
    expect(demoSignFinal(CONTRACT, "me.testnet", "general", demoReceipt({}, other), 0)).toMatch(/signature/);
    const edited = { ...demoReceipt({ score: 12, passedAtMs: AFTER }), score: 15 };
    expect(demoSignFinal(CONTRACT, "me.testnet", "general", edited, 0)).toMatch(/signature/);
  });
});

async function demoChainWith(stages: number[]) {
  const me = (await new DemoChain({ pace: "instant" }).practiceAccount()).accountId;
  const chain = new DemoChain({
    pace: "instant",
    badges: stages.map((stage) => ({ owner: me, stage, mintedAtMs: 1 })),
  });
  return { chain, me };
}

describe("claimFinalBadge in demo mode (no Worker, no network)", () => {
  it("claims the final badge with the rarity the receipt earned, and keeps it", async () => {
    const { chain, me } = await demoChainWith([0, 1, 2]);
    const keep = vi.fn();
    const r = await claimFinalBadge(chain, "general", demoReceipt({ accountId: me, score: 13 }), {
      keepDemoFinal: keep,
    });
    expect(r).toMatchObject({ ok: true, badge: { owner: me, route: "general", rarity: "epic" } });
    expect(await chain.finalBadgeOf(me)).toMatchObject({ rarity: "epic", route: "general" });
    expect(keep).toHaveBeenCalledWith({
      owner: me,
      route: "general",
      rarity: "epic",
      mintedAtMs: expect.any(Number),
    });
    // Stage badges are untouched, and the final token is not counted as one.
    expect((await chain.badgesOf(me)).map((b) => b.stage)).toEqual([0, 1, 2]);
  });

  it("one final badge per account", async () => {
    const { chain, me } = await demoChainWith([0, 1, 2]);
    expect((await claimFinalBadge(chain, "general", demoReceipt({ accountId: me }), {})).ok).toBe(true);
    const again = await claimFinalBadge(chain, "general", demoReceipt({ accountId: me }), {});
    expect(again).toMatchObject({ ok: false, error: "You already hold the final badge." });
  });

  it("refuses with no receipt, or a receipt for another account", async () => {
    const { chain } = await demoChainWith([0, 1, 2]);
    expect(await claimFinalBadge(chain, "general", undefined, {})).toMatchObject({ ok: false });
    const r = await claimFinalBadge(chain, "general", demoReceipt({ accountId: "someone.testnet" }), {});
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/another account/) });
  });

  it("the contract still needs the route's stage badges", async () => {
    const { chain, me } = await demoChainWith([0, 1, 2]);
    const r = await claimFinalBadge(
      chain,
      "developer",
      demoReceipt({ accountId: me, route: "developer" }),
      {},
    );
    expect(r).toEqual({ ok: false, error: "Your account is missing a stage badge this exam route needs." });
  });
});

describe("claim_final on the demo contract binds the claim to the caller", () => {
  it("a claim signed for another account fails the signature check when the caller sends it", async () => {
    const { chain } = await demoChainWith([0, 1, 2]);
    const now = (await chain.block("final")).timestampMs;
    const expiresAtMs = now + 60_000;
    const sig = ed25519.sign(
      utf8ToBytes(finalMessage(CONTRACT, "someone.testnet", "general", "legendary", expiresAtMs)),
      DEMO_CLAIM_SEED,
    );
    const out = await chain.claimFinal({
      route: "general",
      rarity: "legendary",
      expiresAtMs,
      signature: base64.encode(sig),
    });
    expect(out.status.type).toBe("Failure");
    expect(out.status.type === "Failure" && out.status.error.message).toMatch(/Invalid claim signature/);
  });

  it("refuses a raised rarity, an unknown route and an expired claim", async () => {
    const { chain, me } = await demoChainWith([0, 1, 2]);
    const now = (await chain.block("final")).timestampMs;
    const signed = demoSignFinal(
      CONTRACT,
      me,
      "general",
      demoReceipt({ accountId: me, score: 12, passedAtMs: AFTER }),
      now,
    );
    if (typeof signed === "string") throw new Error(signed);
    expect(signed.rarity).toBe("common");
    const raised = await chain.claimFinal({ ...signed, rarity: "legendary" });
    expect(raised.status.type === "Failure" && raised.status.error.message).toMatch(
      /Invalid claim signature/,
    );
    const route = await chain.claimFinal({ ...signed, route: "mainnet" });
    expect(route.status.type === "Failure" && route.status.error.message).toMatch(/Unknown route/);
    const old = await chain.claimFinal({ ...signed, expiresAtMs: now - 1 });
    expect(old.status.type === "Failure" && old.status.error.message).toMatch(/Claim expired/);
    expect((await chain.claimFinal(signed)).status.type).toBe("SuccessValue");
  });

  it("a final badge kept from an earlier visit is seeded back", async () => {
    const me = (await new DemoChain({ pace: "instant" }).practiceAccount()).accountId;
    const chain = new DemoChain({
      pace: "instant",
      badges: [0, 1, 2].map((stage) => ({ owner: me, stage, mintedAtMs: 1 })),
      finalBadges: [{ owner: me, route: "general", rarity: "rare", mintedAtMs: 5 }],
    });
    expect(await chain.finalBadgeOf(me)).toMatchObject({ tokenId: "3", rarity: "rare", mintedAtMs: 5 });
    expect((await chain.viewCall(CONTRACT, "has_final_badge", { account_id: me })).result).toBe(true);
    expect((await chain.viewCall(CONTRACT, "get_route", { route: "developer" })).result).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });
});

describe("claimFinalBadge in testnet mode (the Worker signs)", () => {
  it("sends the receipt to POST /final and submits the claim it signs", async () => {
    const { chain, me } = await demoChainWith([0, 1, 2]);
    const testnetLike = Object.assign(Object.create(chain) as DemoChain, { network: "testnet" as const });
    const receipt = demoReceipt({ accountId: me });
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { accountId: string; route: string };
      const expiresAtMs = (await chain.block("final")).timestampMs + 60_000;
      const sig = ed25519.sign(
        utf8ToBytes(finalMessage(CONTRACT, body.accountId, body.route, "legendary", expiresAtMs)),
        DEMO_CLAIM_SEED,
      );
      return new Response(
        JSON.stringify({
          route: body.route,
          rarity: "legendary",
          expiresAtMs,
          signature: base64.encode(sig),
        }),
      );
    });
    const r = await claimFinalBadge(testnetLike, "general", receipt, {
      workerUrl: "https://w.example/",
      fetch: fetchFn as unknown as typeof fetch,
    });
    expect(r).toMatchObject({ ok: true, badge: { rarity: "legendary" } });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://w.example/final");
    expect(JSON.parse(String(init.body))).toEqual({ accountId: me, route: "general", receipt });
  });

  it("shows the Worker's refusal, and says plainly when there is no Worker", async () => {
    const { chain, me } = await demoChainWith([0, 1, 2]);
    const testnetLike = Object.assign(Object.create(chain) as DemoChain, { network: "testnet" as const });
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "The receipt is for another account." }), { status: 403 }),
    );
    const r = await claimFinalBadge(testnetLike, "general", demoReceipt({ accountId: me }), {
      workerUrl: "https://w.example",
      fetch: fetchFn,
    });
    expect(r).toEqual({ ok: false, error: "The receipt is for another account." });
    const none = await claimFinalBadge(testnetLike, "general", demoReceipt({ accountId: me }), {});
    expect(!none.ok && none.error).toMatch(/not set up/);
  });

  it("explains the contract's refusals in plain words", () => {
    expect(plainFinalError("Smart contract panicked: Unknown route")).toMatch(/owner has to set it up/);
    expect(plainFinalError("Daily mint cap reached")).toMatch(/today's badges/);
  });
});

describe("demo final badge ledger", () => {
  it("keeps one final badge per account and drops malformed entries", () => {
    const store = new Map<string, string>();
    const s = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    keepDemoFinals(
      [
        { owner: "a.testnet", route: "general", rarity: "rare", mintedAtMs: 1 },
        { owner: "a.testnet", route: "general", rarity: "epic", mintedAtMs: 2 },
        { owner: "b.testnet", route: "general", rarity: "mythic" as never, mintedAtMs: 1 },
      ],
      s,
    );
    expect(loadDemoFinals(s)).toEqual([
      { owner: "a.testnet", route: "general", rarity: "rare", mintedAtMs: 1 },
    ]);
    store.set(DEMO_FINALS_KEY, "not json");
    expect(loadDemoFinals(s)).toEqual([]);
  });

  it("addDemoFinal replaces an account's earlier entry", () => {
    localStorage.clear();
    addDemoFinal({ owner: "a.testnet", route: "general", rarity: "rare", mintedAtMs: 1 });
    addDemoFinal({ owner: "b.testnet", route: "developer", rarity: "epic", mintedAtMs: 2 });
    addDemoFinal({ owner: "a.testnet", route: "general", rarity: "legendary", mintedAtMs: 3 });
    expect(loadDemoFinals().map((f) => [f.owner, f.rarity])).toEqual([
      ["b.testnet", "epic"],
      ["a.testnet", "legendary"],
    ]);
  });
});
