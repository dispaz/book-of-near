import { describe, expect, it, vi } from "vitest";
import { ANSWER_KEY } from "../../src/exam/answerKey";
import { questionsFor } from "../../src/exam/bank";
import { examMessage } from "../../src/exam/grade";
import { b58encode, b64decode, b64urlDecode } from "./bytes";
import { exam, rpcBadges, type BadgeReader } from "./exam";
import { handle, type Env } from "./index";
import { memoryCounters } from "./limits";

const CONTRACT = "badges.owner.testnet";
const ME = "learner.testnet";
const NOW = new Date("2026-11-13T10:00:00Z");

async function testKey() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const secret = `ed25519:${b58encode(new Uint8Array([...b64urlDecode(jwk.d!), ...b64urlDecode(jwk.x!)]))}`;
  const verify = (sigB64: string, text: string) =>
    crypto.subtle.verify("Ed25519", pair.publicKey, b64decode(sigB64), new TextEncoder().encode(text));
  return { secret, verify };
}

const holding = (stages: number[]): BadgeReader => ({
  hasBadge: async (account, stage) => account === ME && stages.includes(stage),
});
const right = (route: "general" | "developer") => questionsFor(route).map((q) => ANSWER_KEY[q.id]!.answer);
const wrong = (route: "general" | "developer", n: number) =>
  right(route).map((p, i) => (i < n ? (p + 1) % questionsFor(route)[i]!.options.length : p));

describe("exam", () => {
  it("grades a pass and signs a receipt the final badge can check", async () => {
    const k = await testKey();
    const r = await exam(
      { accountId: ME, route: "general", answers: wrong("general", 2) },
      { contractId: CONTRACT, signingKey: k.secret, badges: holding([0, 1, 2]), now: NOW },
    );
    expect(r.status).toBe(200);
    const body = r.body as {
      score: number;
      passed: boolean;
      results: unknown[];
      receipt: { signature: string; passedAtMs: number };
    };
    expect(body).toMatchObject({ score: 13, total: 15, passMark: 12, passed: true });
    expect(body.results).toHaveLength(15);
    expect(body.receipt.passedAtMs).toBe(NOW.getTime());
    const text = examMessage(CONTRACT, ME, "general", 13, 15, NOW.getTime());
    expect(await k.verify(body.receipt.signature, text)).toBe(true);
  });

  it("grades a fail without a receipt", async () => {
    const k = await testKey();
    const r = await exam(
      { accountId: ME, route: "developer", answers: wrong("developer", 4) },
      { contractId: CONTRACT, signingKey: k.secret, badges: holding([0, 1, 2, 3, 4]), now: NOW },
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ score: 11, passed: false });
    expect((r.body as { receipt?: unknown }).receipt).toBeUndefined();
  });

  it("refuses an account without the route's badges, checked on chain", async () => {
    const k = await testKey();
    const deps = { contractId: CONTRACT, signingKey: k.secret, badges: holding([0, 1, 2]), now: NOW };
    const r = await exam({ accountId: ME, route: "developer", answers: right("developer") }, deps);
    expect(r).toEqual({
      status: 403,
      body: { error: "Claim the stage 3 and 4 badges first.", missing: [3, 4] },
    });
  });

  it("answers 502 when testnet cannot be read", async () => {
    const k = await testKey();
    const down: BadgeReader = { hasBadge: () => Promise.reject(new Error("down")) };
    const r = await exam(
      { accountId: ME, route: "general", answers: right("general") },
      { contractId: CONTRACT, signingKey: k.secret, badges: down, now: NOW },
    );
    expect(r.status).toBe(502);
  });

  it("refuses a bad request", async () => {
    const k = await testKey();
    const deps = { contractId: CONTRACT, signingKey: k.secret, badges: holding([0, 1, 2]), now: NOW };
    expect(
      (await exam({ accountId: "NOT VALID", route: "general", answers: right("general") }, deps)).status,
    ).toBe(400);
    expect((await exam({ accountId: ME, route: "mainnet", answers: right("general") }, deps)).status).toBe(
      400,
    );
    expect((await exam({ accountId: ME, route: "general", answers: [0, 1] }, deps)).status).toBe(400);
    expect((await exam("nope", deps)).status).toBe(400);
  });
});

describe("rpcBadges", () => {
  it("reads has_badge with a view call and falls back to the next node", async () => {
    const bytes = [...new TextEncoder().encode("true")];
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { result: bytes } })));
    const r = rpcBadges(CONTRACT, ["https://a", "https://b"], fetchFn as unknown as typeof fetch);
    expect(await r.hasBadge(ME, 2)).toBe(true);
    const body = JSON.parse(String((fetchFn.mock.calls[1] as [string, RequestInit])[1].body)) as {
      params: { account_id: string; method_name: string; args_base64: string };
    };
    expect(body.params).toMatchObject({ account_id: CONTRACT, method_name: "has_badge" });
    expect(JSON.parse(atob(body.params.args_base64))).toEqual({ account_id: ME, stage: 2 });
  });

  it("throws when every node fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("down"));
    await expect(
      rpcBadges(CONTRACT, ["https://a"], fetchFn as unknown as typeof fetch).hasBadge(ME, 0),
    ).rejects.toThrow();
  });
});

describe("POST /exam route", () => {
  const env: Env = { ALLOWED_ORIGINS: "https://book-of-near.pages.dev", EXAM_PER_ACCOUNT_DAILY: "2" };
  const req = (body: unknown = { accountId: ME, route: "general", answers: right("general") }) =>
    new Request("https://worker.example/exam", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://book-of-near.pages.dev",
        "cf-connecting-ip": "1.2.3.4",
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("is not set up without the claim key", async () => {
    expect((await handle(req(), env, { counters: memoryCounters() })).status).toBe(503);
  });

  it("refuses a body over 2 KB (413) and one that is not JSON (400)", async () => {
    const k = await testKey();
    const e = { ...env, CLAIM_SIGNING_KEY: k.secret, BADGE_CONTRACT_ID: CONTRACT };
    const o = { counters: memoryCounters(), badges: holding([0, 1, 2]), now: () => NOW };
    expect((await handle(req({ pad: "a".repeat(3000) }), e, o)).status).toBe(413);
    expect((await handle(req("{not json"), e, o)).status).toBe(400);
  });

  it("grades, and is rate-limited per account", async () => {
    const k = await testKey();
    const e = { ...env, CLAIM_SIGNING_KEY: k.secret, BADGE_CONTRACT_ID: CONTRACT };
    const o = { counters: memoryCounters(), badges: holding([0, 1, 2]), now: () => NOW };
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await handle(req(), e, o)).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});
