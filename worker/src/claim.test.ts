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
/** Lesson 0.3's transaction: one Transfer action. */
const transfer = (signerId: string, receiverId: string) => ok(signerId, receiverId, [{ type: "Transfer" }]);

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
        lookup: lookup({ T0: transfer(ME, "book-of-near.testnet") }),
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

  it("stage 6: signs with 6.1's practice vote and 6.2's recorded trade, looks nothing up, refuses without them", async () => {
    const k = await testKey();
    const deps = { contractId: CONTRACT, signingKey: k.secret, lookup: lookup({}), now: NOW };
    const evidence = {
      "l-6-1-vote-on-a-proposal": { proposalId: "42", voteCast: "true", kind: "practice" },
      "l-6-2-live-money-map": { pair: "USDC/USDt", amountIn: "100000", kind: "recorded" },
    };
    const r = await claim({ accountId: ME, stage: 6, evidence }, deps);
    expect(r.status).toBe(200);
    const body = r.body as { expiresAtMs: number; signature: string };
    expect(await k.verify(body.signature, stageMessage(CONTRACT, ME, 6, body.expiresAtMs))).toBe(true);
    expect(deps.lookup.asked).toEqual([]);

    const noTrade = await claim(
      {
        accountId: ME,
        stage: 6,
        evidence: { "l-6-1-vote-on-a-proposal": evidence["l-6-1-vote-on-a-proposal"] },
      },
      deps,
    );
    expect(noTrade.status).toBe(403);
    expect((noTrade.body as { error: string }).error).toMatch(/lesson 6\.2/);
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
      TR: transfer(ME, "x.testnet"),
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

  it("stage 5 has no transaction to check: it signs without asking testnet (the contract needs stage 4 first)", async () => {
    const k = await testKey();
    const look = lookup({});
    const deps = { contractId: CONTRACT, signingKey: k.secret, lookup: look, now: NOW };
    const r = await claim({ accountId: ME, stage: 5, evidence: {} }, deps);
    expect(r.status).toBe(200);
    const body = r.body as { stage: number; expiresAtMs: number; signature: string };
    expect(body.stage).toBe(5);
    expect(await k.verify(body.signature, stageMessage(CONTRACT, ME, 5, body.expiresAtMs))).toBe(true);
    expect(look.asked).toEqual([]);
    // Stage 7 has no rule yet.
    for (const stage of [7])
      expect((await claim({ accountId: ME, stage, evidence: {} }, deps)).status).toBe(400);
  });

  it("stage 3 refuses someone else's deploy, even when the evidence names its parent", async () => {
    const k = await testKey();
    const txs = { ...stage1Txs, ALICE: ok("alice.testnet", "x.alice.testnet", [{ type: "DeployContract" }]) };
    const deps = { contractId: CONTRACT, signingKey: k.secret, lookup: lookup(txs), now: NOW };
    const ev = {
      ...stage1Evidence,
      "l-3-1-deploy-a-contract": { txHash: "ALICE", contractId: "x.alice.testnet" },
    };
    expect((await claim({ accountId: ME, stage: 3, evidence: ev }, deps)).status).toBe(403);
  });

  it("stage 3 accepts a deploy from a parent the learner made in 3.1 (an implicit account has no sub-accounts)", async () => {
    const k = await testKey();
    const made = ok(ME, "testnet", [
      { type: "FunctionCall", methodName: "create_account", args: { new_account_id: "bon-abc.testnet" } },
    ]);
    const txs = {
      ...stage1Txs,
      PARENT: made,
      DEP: ok("bon-abc.testnet", "counter.bon-abc.testnet", [{ type: "DeployContract" }]),
      ALICE: ok("alice.testnet", "x.alice.testnet", [{ type: "DeployContract" }]),
    };
    const deps = { contractId: CONTRACT, signingKey: k.secret, lookup: lookup(txs), now: NOW };
    const ev = (e: Record<string, string>) => ({ ...stage1Evidence, "l-3-1-deploy-a-contract": e });
    const good = ev({ txHash: "DEP", contractId: "counter.bon-abc.testnet", parentTxHash: "PARENT" });
    expect((await claim({ accountId: ME, stage: 3, evidence: good }, deps)).status).toBe(200);
    // A parent-creation tx that made a different name does not vouch for alice.testnet.
    const bad = ev({ txHash: "ALICE", contractId: "x.alice.testnet", parentTxHash: "PARENT" });
    expect((await claim({ accountId: ME, stage: 3, evidence: bad }, deps)).status).toBe(403);
  });

  it("stages 0 and 2 need the one-transfer transaction lessons 0.3 and 2.1 really use", async () => {
    const k = await testKey();
    const txs = {
      CALL: ok(ME, "x.testnet", [{ type: "FunctionCall", methodName: "anything" }]),
      KEY: ok(ME, ME, [{ type: "AddKey" }]),
    };
    const deps = { contractId: CONTRACT, signingKey: k.secret, lookup: lookup(txs), now: NOW };
    for (const h of ["CALL", "KEY"]) {
      const s0 = { "l-0-3-send-a-transaction": { txHash: h } };
      const s2 = { "l-2-1-follow-across-shards": { txHash: h } };
      expect((await claim({ accountId: ME, stage: 0, evidence: s0 }, deps)).status).toBe(403);
      expect((await claim({ accountId: ME, stage: 2, evidence: s2 }, deps)).status).toBe(403);
    }
  });

  it("refuses one hash used for two lessons' evidence in the same claim", async () => {
    const k = await testKey();
    const both = ok("me-name.testnet", "me-name.testnet", [{ type: "AddKey" }, { type: "DeleteKey" }]);
    const deps = {
      contractId: CONTRACT,
      signingKey: k.secret,
      lookup: lookup({ ...stage1Txs, BOTH: both }),
      now: NOW,
    };
    const ev = { ...stage1Evidence, "l-1-2-function-call-key": { addKeyTxHash: "BOTH", txHash: "BOTH" } };
    const r = await claim({ accountId: ME, stage: 1, evidence: ev }, deps);
    expect(r.status).toBe(403);
    expect((r.body as { error: string }).error).toMatch(/more than once/);
  });

  it("answers 502, not 'not found', when testnet RPC fails", async () => {
    const k = await testKey();
    const down: TxLookup = {
      tx: () => Promise.reject(new Error("rpc down")),
    };
    const r = await claim(
      { accountId: ME, stage: 0, evidence: { "l-0-3-send-a-transaction": { txHash: "T0" } } },
      { contractId: CONTRACT, signingKey: k.secret, lookup: down, now: NOW },
    );
    expect(r.status).toBe(502);
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

  it("refuses a body over 4 KB (413) and one that is not JSON (400)", async () => {
    const k = await testKey();
    const e = { ...env, CLAIM_SIGNING_KEY: k.secret, BADGE_CONTRACT_ID: CONTRACT };
    const o = { counters: memoryCounters(), lookup: lookup({}), now: () => NOW };
    const post = (body: string) =>
      new Request("https://worker.example/claim", {
        method: "POST",
        headers: { origin: "https://book-of-near.pages.dev", "cf-connecting-ip": "1.2.3.4" },
        body,
      });
    const big = JSON.stringify({ accountId: ME, stage: 0, evidence: { pad: { x: "a".repeat(5000) } } });
    expect((await handle(post(big), e, o)).status).toBe(413);
    expect((await handle(post("{not json"), e, o)).status).toBe(400);
  });

  it("is rate-limited per address", async () => {
    const k = await testKey();
    const e = { ...env, CLAIM_SIGNING_KEY: k.secret, BADGE_CONTRACT_ID: CONTRACT };
    const o = {
      counters: memoryCounters(),
      lookup: lookup({ T0: transfer(ME, "x.testnet") }),
      now: () => NOW,
    };
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await handle(req(), e, o)).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});
