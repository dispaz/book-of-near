import { describe, expect, it, vi } from "vitest";
import { handle, type Env, type Overrides } from "./index";
import { MAX_QUOTE_BODY_BYTES, ONECLICK_QUOTE_URL } from "./intents";
import { memoryCounters } from "./limits";

const env: Env = { ALLOWED_ORIGINS: "https://book-of-near.pages.dev" };
const ORIGIN = "https://book-of-near.pages.dev";
const NOW = new Date("2026-11-12T10:00:00.000Z");

const DRY = {
  dry: true,
  swapType: "EXACT_INPUT",
  slippageTolerance: 100,
  originAsset: "nep141:wrap.near",
  depositType: "ORIGIN_CHAIN",
  destinationAsset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
  amount: "5000000000000000000000000",
  refundTo: "intents.near",
  refundType: "ORIGIN_CHAIN",
  recipient: "0x1111111111111111111111111111111111111111",
  recipientType: "DESTINATION_CHAIN",
  deadline: "2026-11-12T10:10:00.000Z",
};
const REAL = {
  ...DRY,
  dry: false,
  amount: "100000000000000000000000",
  refundTo: "learner.near",
  recipient: "learner.near",
  recipientType: "INTENTS",
};

const raw = (body: string, ip = "1.2.3.4") =>
  new Request("https://worker.example/intents/quote", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "cf-connecting-ip": ip },
    body,
  });
const post = (body: unknown, ip?: string) => raw(JSON.stringify(body), ip);

const QUOTE = { quote: { amountOut: "20270000" }, signature: "ed25519:x" };
const oneClick = () =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(QUOTE), { status: 201 }));
const opts = (f = oneClick(), extra: Overrides = {}): Overrides => ({
  fetch: f,
  now: () => NOW,
  counters: memoryCounters(),
  ...extra,
});

async function refused(body: unknown) {
  const f = oneClick();
  const res = await handle(post(body), env, opts(f));
  expect(f).not.toHaveBeenCalled();
  expect(res.status).toBe(400);
  return ((await res.json()) as { error: string }).error;
}

describe("POST /intents/quote", () => {
  it("forwards a dry quote to 1Click and returns its answer with CORS", async () => {
    const f = oneClick();
    const res = await handle(post({ ...DRY, extra: "dropped" }), env, opts(f));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(QUOTE);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(ONECLICK_QUOTE_URL);
    expect(JSON.parse(String(init?.body))).toEqual(DRY);
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it("adds the API key from the secret, never from the request", async () => {
    const f = oneClick();
    await handle(post(DRY), { ...env, ONECLICK_JWT: "secret-jwt" }, opts(f));
    expect(new Headers(f.mock.calls[0]![1]?.headers).get("authorization")).toBe("Bearer secret-jwt");
  });

  it("refuses a real (non-dry) quote above the 0.25 NEAR cap without calling 1Click", async () => {
    expect(await refused({ ...REAL, amount: "300000000000000000000000" })).toBe(
      "Refused: a real swap here is capped at 0.25 NEAR.",
    );
    expect((await handle(post(REAL), env, opts())).status).toBe(201);
  });

  it("only swaps NEAR, with a whole-number amount", async () => {
    await refused({ ...DRY, originAsset: "nep141:usdt.tether-token.near" });
    await refused({ ...DRY, amount: "1.5" });
    await refused({ ...DRY, dry: "yes" });
  });

  it("refuses any swap type but EXACT_INPUT, so the cap is always on the NEAR going in", async () => {
    expect(await refused({ ...REAL, swapType: "EXACT_OUTPUT" })).toMatch(/exact input/i);
    await refused({ ...DRY, swapType: "FLEX_INPUT" });
    const noType: Record<string, unknown> = { ...DRY };
    delete noType.swapType;
    await refused(noType);
  });

  it("only gives USDC on Arbitrum", async () => {
    expect(await refused({ ...DRY, destinationAsset: "nep141:usdt.tether-token.near" })).toMatch(
      /USDC on Arbitrum/,
    );
    await refused({ ...DRY, destinationAsset: 42 });
  });

  it("bounds the slippage tolerance to 0..300 basis points", async () => {
    await refused({ ...DRY, slippageTolerance: 301 });
    await refused({ ...DRY, slippageTolerance: -1 });
    await refused({ ...DRY, slippageTolerance: 1.5 });
    await refused({ ...DRY, slippageTolerance: "100" });
    expect((await handle(post({ ...DRY, slippageTolerance: 0 }), env, opts())).status).toBe(201);
    expect((await handle(post({ ...DRY, slippageTolerance: 300 }), env, opts())).status).toBe(201);
  });

  it("bounds the deadline to the next 30 minutes", async () => {
    await refused({ ...DRY, deadline: "2026-11-12T09:59:59.000Z" });
    await refused({ ...DRY, deadline: "2026-11-12T10:30:01.000Z" });
    await refused({ ...DRY, deadline: "soon" });
    expect((await handle(post({ ...DRY, deadline: "2026-11-12T10:30:00.000Z" }), env, opts())).status).toBe(
      201,
    );
  });

  it("checks the remaining fields", async () => {
    await refused({ ...DRY, depositType: "INTENTS" });
    await refused({ ...DRY, refundType: "INTENTS" });
    await refused({ ...DRY, recipientType: "ANYWHERE" });
    await refused({ ...DRY, recipient: "" });
    await refused({ ...DRY, recipient: "x".repeat(129) });
    await refused({ ...DRY, refundTo: 7 });
  });

  it("refuses a body over the size cap before parsing it", async () => {
    const f = oneClick();
    const big = JSON.stringify({ ...DRY, pad: "x".repeat(MAX_QUOTE_BODY_BYTES) });
    const res = await handle(raw(big), env, opts(f));
    expect(res.status).toBe(413);
    expect(f).not.toHaveBeenCalled();
    expect((await handle(raw("{not json"), env, opts(f))).status).toBe(400);
  });

  it("rate-limits quotes per IP address, apart from the faucet's counters", async () => {
    const counters = memoryCounters();
    const limited: Env = { ...env, QUOTE_PER_IP_DAILY: "2", QUOTE_GLOBAL_DAILY: "3" };
    const f = oneClick();
    const o = opts(f, { counters });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await handle(post(DRY), limited, o)).status);
    expect(statuses).toEqual([201, 201, 429]);
    expect(f).toHaveBeenCalledTimes(2);
    // Another address still gets one, then the global cap stops everyone.
    expect((await handle(post(DRY, "9.9.9.9"), limited, o)).status).toBe(201);
    expect((await handle(post(DRY, "8.8.8.8"), limited, o)).status).toBe(429);
    expect(await counters.get("ip:2026-11-12:1.2.3.4")).toBe(0);
  });

  it("refuses without persistent counters or a client address outside local dev", async () => {
    expect((await handle(post(DRY), env, opts(oneClick(), { counters: undefined }))).status).toBe(503);
    const noIp = new Request("https://worker.example/intents/quote", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify(DRY),
    });
    expect((await handle(noIp, env, opts())).status).toBe(400);
  });

  it("answers 502 when 1Click cannot be reached", async () => {
    const res = await handle(
      post(DRY),
      env,
      opts(
        vi.fn(async () => {
          throw new Error("down");
        }),
      ),
    );
    expect(res.status).toBe(502);
  });
});
