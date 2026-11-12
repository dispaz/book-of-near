import { describe, expect, it } from "vitest";
import { stageMessage } from "../../src/badges/message";
import { b58encode, b64decode, b64urlDecode } from "./bytes";
import { claim, type TxInfo, type TxLookup } from "./claim";
import { handle, type Env } from "./index";
import { memoryCounters } from "./limits";

const CONTRACT = "badges.owner.testnet";
const ME = "learner.testnet";
const NOW = new Date("2026-11-12T10:00:00Z");

/** A fresh ed25519 key in NEAR's `ed25519:<base58 seed+public>` form, plus a verifier. */
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

const ok = (signerId: string, receiverId: string, actions: TxInfo["actions"] = []): TxInfo => ({
  signerId,
  receiverId,
  ok: true,
  actions,
});

function lookup(txs: Record<string, TxInfo>): TxLookup & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async tx(hash, sender) {
      asked.push(`${hash}@${sender}`);
      const t = txs[hash];
      return t && t.signerId === sender ? t : null;
    },
  };
}

const stage1Txs = {
  NAME: ok(ME, "testnet", [
    { type: "FunctionCall", methodName: "create_account", args: { new_account_id: "me-name.testnet" } },
  ]),
  ADD: ok("me-name.testnet", "me-name.testnet", [{ type: "AddKey" }]),
  DEL: ok("me-name.testnet", "me-name.testnet", [{ type: "DeleteKey" }]),
};
const stage1Evidence = {
  "l-1-1-claim-your-name": { txHash: "NAME", accountId: "me-name.testnet" },
  "l-1-2-function-call-key": { addKeyTxHash: "ADD", txHash: "DEL" },
};

describe("claim (POST /claim): checks evidence on testnet, then signs", () => {
  it("signs a stage 0 claim in the contract's message format when 0.3's transaction is the learner's", async () => {
    const k = await testKey();
    const r = await claim(
      { accountId: ME, stage: 0, evidence: { "l-0-3-send-a-transaction": { txHash: "T0" } } },
      {
        contractId: CONTRACT,
        signingKey: k.secret,
        lookup: lookup({ T0: ok(ME, "book-of-near.testnet") }),
        now: NOW,
      },
    );
    expect(r.status).toBe(200);
    const body = r.body as { stage: number; expiresAtMs: number; signature: string; contractId: string };
    expect(body.contractId).toBe(CONTRACT);
    expect(body.expiresAtMs).toBe(NOW.getTime() + 5 * 60_000);
    expect(await k.verify(body.signature, stageMessage(CONTRACT, ME, 0, body.expiresAtMs))).toBe(true);
  });

  it("refuses when the transaction is someone else's or failed", async () => {
    const k = await testKey();
    const deps = (t: TxInfo) => ({
      contractId: CONTRACT,
      signingKey: k.secret,
      lookup: lookup({ T0: t }),
      now: NOW,
    });
    const body = { accountId: ME, stage: 0, evidence: { "l-0-3-send-a-transaction": { txHash: "T0" } } };
    expect((await claim(body, deps(ok("other.testnet", "x.testnet")))).status).toBe(403);
    expect((await claim(body, deps({ ...ok(ME, "x.testnet"), ok: false }))).status).toBe(403);
  });

  it("refuses a stage whose evidence is missing, and says what is missing", async () => {
    const k = await testKey();
    const r = await claim(
      { accountId: ME, stage: 0, evidence: {} },
      { contractId: CONTRACT, signingKey: k.secret, lookup: lookup({}), now: NOW },
    );
    expect(r.status).toBe(403);
    expect((r.body as { error: string }).error).toMatch(/lesson 0\.3/);
  });

  it("stage 1: the name made by the learner, and the key added and deleted on that name", async () => {
    const k = await testKey();
    const deps = { contractId: CONTRACT, signingKey: k.secret, lookup: lookup(stage1Txs), now: NOW };
    expect((await claim({ accountId: ME, stage: 1, evidence: stage1Evidence }, deps)).status).toBe(200);
    // A name someone else made does not count.
    const stolen = {
      ...stage1Evidence,
      "l-1-1-claim-your-name": { txHash: "NAME", accountId: "other.testnet" },
    };
    expect((await claim({ accountId: ME, stage: 1, evidence: stolen }, deps)).status).toBe(403);
  });

  it("stages 2 to 4 check their own transaction", async () => {
    const k = await testKey();
    const txs = {
      ...stage1Txs,
      TR: ok(ME, "x.testnet"),
      DEP: ok("me-name.testnet", "counter.me-name.testnet", [{ type: "DeployContract" }]),
      MPC: ok(ME, "v1.signer-prod.testnet", [{ type: "FunctionCall", methodName: "sign" }]),
    };
    const deps = { contractId: CONTRACT, signingKey: k.secret, lookup: lookup(txs), now: NOW };
    const ev = {
      ...stage1Evidence,
      "l-2-1-follow-across-shards": { txHash: "TR" },
      "l-3-1-deploy-a-contract": { txHash: "DEP", contractId: "counter.me-name.testnet" },
      "l-4-1-one-account-every-chain": { mpcTxHash: "MPC" },
    };
    for (const stage of [2, 3, 4])
      expect((await claim({ accountId: ME, stage, evidence: ev }, deps)).status).toBe(200);
    const wrongContract = { ...ev, "l-3-1-deploy-a-contract": { txHash: "DEP", contractId: "evil.testnet" } };
    expect((await claim({ accountId: ME, stage: 3, evidence: wrongContract }, deps)).status).toBe(403);
  });

  it("refuses a bad request", async () => {
    const k = await testKey();
    const deps = { contractId: CONTRACT, signingKey: k.secret, lookup: lookup({}), now: NOW };
    expect((await claim({ accountId: "NOT VALID", stage: 0, evidence: {} }, deps)).status).toBe(400);
    expect((await claim({ accountId: ME, stage: 9, evidence: {} }, deps)).status).toBe(400);
    expect((await claim("nope", deps)).status).toBe(400);
  });
});

describe("POST /claim route", () => {
  const env: Env = { ALLOWED_ORIGINS: "https://book-of-near.pages.dev", CLAIM_PER_IP_DAILY: "2" };
  const req = (ip = "1.2.3.4") =>
    new Request("https://worker.example/claim", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://book-of-near.pages.dev",
        "cf-connecting-ip": ip,
      },
      body: JSON.stringify({
        accountId: ME,
        stage: 0,
        evidence: { "l-0-3-send-a-transaction": { txHash: "T0" } },
      }),
    });

  it("is not set up without the claim key", async () => {
    expect((await handle(req(), env, { counters: memoryCounters() })).status).toBe(503);
  });

  it("is rate-limited per address", async () => {
    const k = await testKey();
    const e = { ...env, CLAIM_SIGNING_KEY: k.secret, BADGE_CONTRACT_ID: CONTRACT };
    const o = { counters: memoryCounters(), lookup: lookup({ T0: ok(ME, "x.testnet") }), now: () => NOW };
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await handle(req(), e, o)).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});
