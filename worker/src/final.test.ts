import { describe, expect, it } from "vitest";
import { examMessage, type ExamReceipt } from "../../src/exam/grade";
import { finalMessage } from "../../src/badges/message";
import { b58encode, b64decode, b64urlDecode } from "./bytes";
import { signText } from "./claim";
import { final, signedByKey } from "./final";
import { handle, type Env } from "./index";
import { memoryCounters } from "./limits";

const CONTRACT = "badges.owner.testnet";
const ME = "learner.testnet";
const NOW = new Date("2026-11-13T10:00:00Z");
const IN_WINDOW = Date.UTC(2026, 10, 13, 9);
const AFTER_WINDOW = Date.UTC(2026, 10, 20);

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

/** A receipt as `/exam` signs it, with any field changed before signing. */
async function receipt(secret: string, over: Partial<ExamReceipt> = {}): Promise<ExamReceipt> {
  const r = {
    contractId: CONTRACT,
    accountId: ME,
    route: "general" as const,
    score: 14,
    total: 15,
    passedAtMs: IN_WINDOW,
    signature: "",
    ...over,
  };
  r.signature = await signText(
    secret,
    examMessage(r.contractId, r.accountId, r.route, r.score, r.total, r.passedAtMs),
  );
  return r;
}

describe("final", () => {
  it("signs the contract's exact final claim for a valid receipt, with the rarity it earned", async () => {
    const k = await testKey();
    const rec = await receipt(k.secret);
    const r = await final(
      { accountId: ME, route: "general", receipt: rec },
      { contractId: CONTRACT, signingKey: k.secret, now: NOW },
    );
    expect(r.status).toBe(200);
    const body = r.body as { rarity: string; expiresAtMs: number; signature: string; route: string };
    // 14 of 15 is rare; inside the hackathon window it goes up one tier.
    expect(body.rarity).toBe("epic");
    expect(body.route).toBe("general");
    expect(body.expiresAtMs).toBe(NOW.getTime() + 5 * 60_000);
    expect(
      await k.verify(body.signature, `bon-badge-v1|${CONTRACT}|${ME}|final|general|epic|${body.expiresAtMs}`),
    ).toBe(true);
    expect(
      await k.verify(body.signature, finalMessage(CONTRACT, ME, "general", "epic", body.expiresAtMs)),
    ).toBe(true);
  });

  it("works out the rarity from the signed score and pass time, never from the client", async () => {
    const k = await testKey();
    const deps = { contractId: CONTRACT, signingKey: k.secret, now: NOW };
    const cases: [number, number, string][] = [
      [15, IN_WINDOW, "legendary"],
      [15, AFTER_WINDOW, "epic"],
      [13, AFTER_WINDOW, "rare"],
      [12, AFTER_WINDOW, "common"],
      [12, IN_WINDOW, "rare"],
    ];
    for (const [score, passedAtMs, want] of cases) {
      const rec = await receipt(k.secret, { score, passedAtMs });
      const r = await final({ accountId: ME, route: "general", receipt: rec, rarity: "legendary" }, deps);
      expect((r.body as { rarity: string }).rarity, `${score} at ${passedAtMs}`).toBe(want);
    }
  });

  it("refuses a forged receipt: signed by another key, or a field changed after signing", async () => {
    const k = await testKey();
    const other = await testKey();
    const deps = { contractId: CONTRACT, signingKey: k.secret, now: NOW };
    const forged = await receipt(other.secret, { score: 15 });
    const r1 = await final({ accountId: ME, route: "general", receipt: forged }, deps);
    expect(r1.status).toBe(403);
    expect((r1.body as { error: string }).error).toMatch(/signature/);
    const raised = { ...(await receipt(k.secret, { score: 12 })), score: 15 };
    expect((await final({ accountId: ME, route: "general", receipt: raised }, deps)).status).toBe(403);
    const moved = { ...(await receipt(k.secret, { passedAtMs: AFTER_WINDOW })), passedAtMs: IN_WINDOW };
    expect((await final({ accountId: ME, route: "general", receipt: moved }, deps)).status).toBe(403);
    const junk = { ...(await receipt(k.secret)), signature: "not base64!" };
    expect((await final({ accountId: ME, route: "general", receipt: junk }, deps)).status).toBe(403);
  });

  it("refuses a receipt for another badge contract", async () => {
    const k = await testKey();
    const rec = await receipt(k.secret, { contractId: "badges.someone-else.testnet" });
    const r = await final(
      { accountId: ME, route: "general", receipt: rec },
      { contractId: CONTRACT, signingKey: k.secret, now: NOW },
    );
    expect(r.status).toBe(403);
    expect((r.body as { error: string }).error).toMatch(/another badge contract/);
  });

  it("refuses a receipt for another account", async () => {
    const k = await testKey();
    const rec = await receipt(k.secret, { accountId: "someone.testnet" });
    const r = await final(
      { accountId: ME, route: "general", receipt: rec },
      { contractId: CONTRACT, signingKey: k.secret, now: NOW },
    );
    expect(r.status).toBe(403);
    expect((r.body as { error: string }).error).toMatch(/another account/);
  });

  it("refuses a failed exam, even with a valid signature", async () => {
    const k = await testKey();
    const rec = await receipt(k.secret, { score: 11 });
    const r = await final(
      { accountId: ME, route: "general", receipt: rec },
      { contractId: CONTRACT, signingKey: k.secret, now: NOW },
    );
    expect(r.status).toBe(403);
    expect((r.body as { error: string }).error).toMatch(/not for a passed exam/);
  });

  it("refuses another route, a wrong total, a bad account id and a missing receipt", async () => {
    const k = await testKey();
    const deps = { contractId: CONTRACT, signingKey: k.secret, now: NOW };
    const rec = await receipt(k.secret);
    expect((await final({ accountId: ME, route: "developer", receipt: rec }, deps)).status).toBe(403);
    const short = await receipt(k.secret, { score: 9, total: 10 });
    expect((await final({ accountId: ME, route: "general", receipt: short }, deps)).status).toBe(403);
    expect((await final({ accountId: "Not An Account", route: "general", receipt: rec }, deps)).status).toBe(
      400,
    );
    expect((await final({ accountId: ME, route: "mainnet", receipt: rec }, deps)).status).toBe(400);
    expect((await final({ accountId: ME, route: "general" }, deps)).status).toBe(403);
    expect((await final(null, deps)).status).toBe(400);
  });

  it("signedByKey checks the public half of the claim key", async () => {
    const k = await testKey();
    const sig = await signText(k.secret, "hello");
    expect(await signedByKey(k.secret, "hello", sig)).toBe(true);
    expect(await signedByKey(k.secret, "hellO", sig)).toBe(false);
    expect(await signedByKey(k.secret, "hello", "AAAA")).toBe(false);
  });
});

describe("POST /final route", () => {
  const env: Env = { ALLOWED_ORIGINS: "https://book-of-near.pages.dev", FINAL_PER_ACCOUNT_DAILY: "2" };
  const req = (body: unknown) =>
    new Request("https://worker.example/final", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://book-of-near.pages.dev",
        "cf-connecting-ip": "1.2.3.4",
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("is not set up without the claim key", async () => {
    expect((await handle(req({}), env, { counters: memoryCounters() })).status).toBe(503);
  });

  it("refuses a body over 2 KB (413) and one that is not JSON (400)", async () => {
    const k = await testKey();
    const e = { ...env, CLAIM_SIGNING_KEY: k.secret, BADGE_CONTRACT_ID: CONTRACT };
    const o = { counters: memoryCounters(), now: () => NOW };
    expect((await handle(req({ pad: "a".repeat(3000) }), e, o)).status).toBe(413);
    expect((await handle(req("{not json"), e, o)).status).toBe(400);
  });

  it("signs with CORS for the app's origin, and is rate-limited per account", async () => {
    const k = await testKey();
    const e = { ...env, CLAIM_SIGNING_KEY: k.secret, BADGE_CONTRACT_ID: CONTRACT };
    const o = { counters: memoryCounters(), now: () => NOW };
    const body = { accountId: ME, route: "general", receipt: await receipt(k.secret) };
    const first = await handle(req(body), e, o);
    expect(first.status).toBe(200);
    expect(first.headers.get("access-control-allow-origin")).toBe("https://book-of-near.pages.dev");
    expect(((await first.json()) as { rarity: string }).rarity).toBe("epic");
    expect((await handle(req(body), e, o)).status).toBe(200);
    expect((await handle(req(body), e, o)).status).toBe(429);
  });
});
