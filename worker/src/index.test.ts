import { describe, expect, it, vi } from "vitest";
import { implicitIdOf, type FaucetSender } from "./faucet";
import { handle, type Env } from "./index";
import { memoryCounters } from "./limits";

const KEY = "ed25519:Ex4stLtTe43ynFmxGweGzMWLvRmRSUP6EjU6nvAdY2vg"; // public key from docs/lessons/stage-0/0.3.md
const IMPLICIT = "cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5";
const env: Env = { ALLOWED_ORIGINS: "https://book-of-near.pages.dev", PER_IP_DAILY: "3", GLOBAL_DAILY: "5" };

function fakeSender(): FaucetSender & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    fundImplicit: vi.fn(async (id: string, amount: string) => (calls.push(`send ${id} ${amount}`), "TX1")),
    createNamed: vi.fn(
      async (id: string, _k: string, amount: string) => (calls.push(`create ${id} ${amount}`), "TX2"),
    ),
    accountExists: vi.fn(async () => false),
  };
}

const post = (body: unknown, ip = "1.2.3.4", origin = "https://book-of-near.pages.dev") =>
  new Request("https://worker.example/faucet", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });

describe("POST /faucet", () => {
  it("funds the implicit account of the public key", async () => {
    const sender = fakeSender();
    const res = await handle(post({ publicKey: KEY }), env, { sender, counters: memoryCounters() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accountId: IMPLICIT, txHash: "TX1", amount: "0.5" });
    expect(sender.calls).toEqual([`send ${IMPLICIT} 0.5`]);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://book-of-near.pages.dev");
  });

  it("creates a named .testnet account when asked", async () => {
    const sender = fakeSender();
    const res = await handle(post({ publicKey: KEY, accountId: "learner-1.testnet" }), env, {
      sender,
      counters: memoryCounters(),
    });
    expect(res.status).toBe(200);
    expect(sender.calls).toEqual(["create learner-1.testnet 0.5"]);
  });

  it("refuses repeated calls from one address after 3 a day", async () => {
    const sender = fakeSender();
    const counters = memoryCounters();
    const statuses = [];
    for (let i = 0; i < 6; i++)
      statuses.push((await handle(post({ publicKey: KEY }), env, { sender, counters })).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429, 429]);
    expect(sender.calls).toHaveLength(3);
    // Concurrent bursts cannot slip past the limit either.
    const burst = await Promise.all(
      Array.from({ length: 10 }, () =>
        handle(post({ publicKey: KEY }, "9.9.9.9"), env, { sender, counters }),
      ),
    );
    expect(burst.filter((r) => r.status === 200)).toHaveLength(2); // global cap is 5: 3 + 2
    // The next day the address may ask again.
    const tomorrow = () => new Date(Date.now() + 86_400_000);
    const res = await handle(post({ publicKey: KEY }), env, { sender, counters, now: tomorrow });
    expect(res.status).toBe(200);
  });

  it("holds the global daily cap across addresses", async () => {
    const sender = fakeSender();
    const counters = memoryCounters();
    const statuses = [];
    for (let i = 0; i < 8; i++)
      statuses.push(
        (await handle(post({ publicKey: KEY }, `10.0.0.${i}`), env, { sender, counters })).status,
      );
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429, 429]);
    const body = (await (
      await handle(post({ publicKey: KEY }, "10.0.1.1"), env, { sender, counters })
    ).json()) as {
      error: string;
    };
    expect(body.error).toMatch(/today's testnet NEAR/);
  });

  it("counts failed attempts too, so errors cannot be used to drain it", async () => {
    const sender = fakeSender();
    sender.fundImplicit = async () => {
      throw new Error("rpc down");
    };
    const counters = memoryCounters();
    const statuses = [];
    for (let i = 0; i < 4; i++)
      statuses.push((await handle(post({ publicKey: KEY }), env, { sender, counters })).status);
    expect(statuses).toEqual([502, 502, 502, 429]);
  });

  it("validates input and refuses existing accounts", async () => {
    const sender = fakeSender();
    const counters = memoryCounters();
    expect((await handle(post({ publicKey: "nope" }), env, { sender, counters })).status).toBe(400);
    expect(
      (await handle(post({ publicKey: KEY, accountId: "Bad Name" }), env, { sender, counters })).status,
    ).toBe(400);
    expect(
      (await handle(post({ publicKey: KEY, accountId: "a.b.testnet" }), env, { sender, counters })).status,
    ).toBe(400);
    sender.accountExists = async () => true;
    expect((await handle(post({ publicKey: KEY }), env, { sender, counters })).status).toBe(409);
  });

  it("says when the faucet has no secrets configured", async () => {
    const res = await handle(
      post({ publicKey: KEY }),
      { ALLOWED_ORIGINS: env.ALLOWED_ORIGINS },
      { counters: memoryCounters() },
    );
    expect(res.status).toBe(503);
  });
});

describe("CORS", () => {
  it("allows the app origin and any localhost port, nothing else", async () => {
    const opts = { sender: fakeSender(), counters: memoryCounters() };
    const local = await handle(post({ publicKey: KEY }, "1.1.1.1", "http://localhost:5173"), env, opts);
    expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const evil = await handle(post({ publicKey: KEY }, "1.1.1.2", "https://evil.example"), env, opts);
    expect(evil.status).toBe(403);
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    const pre = await handle(
      new Request("https://w/faucet", {
        method: "OPTIONS",
        headers: { origin: "https://book-of-near.pages.dev" },
      }),
      env,
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("implicitIdOf", () => {
  it("decodes an ed25519 public key to its 64-hex account id", () => {
    expect(implicitIdOf(KEY)).toBe(IMPLICIT);
    expect(implicitIdOf("ed25519:abc")).toBeNull();
    expect(implicitIdOf(42)).toBeNull();
  });
});
