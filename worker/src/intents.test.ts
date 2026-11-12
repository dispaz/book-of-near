import { describe, expect, it, vi } from "vitest";
import { handle, type Env } from "./index";
import { ONECLICK_QUOTE_URL } from "./intents";

const env: Env = { ALLOWED_ORIGINS: "https://book-of-near.pages.dev" };
const ORIGIN = "https://book-of-near.pages.dev";

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
  recipient: "0x000000000000000000000000000000000000dEaD",
  recipientType: "DESTINATION_CHAIN",
  deadline: "2026-11-12T10:10:00.000Z",
};

const post = (body: unknown) =>
  new Request("https://worker.example/intents/quote", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  });

const QUOTE = { quote: { amountOut: "20270000" }, signature: "ed25519:x" };
const oneClick = () =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(QUOTE), { status: 201 }));

describe("POST /intents/quote", () => {
  it("forwards a dry quote to 1Click and returns its answer with CORS", async () => {
    const f = oneClick();
    const res = await handle(post({ ...DRY, extra: "dropped" }), env, { fetch: f });
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
    await handle(post(DRY), { ...env, ONECLICK_JWT: "secret-jwt" }, { fetch: f });
    expect(new Headers(f.mock.calls[0]![1]?.headers).get("authorization")).toBe("Bearer secret-jwt");
  });

  it("refuses a real (non-dry) quote above the 0.25 NEAR cap without calling 1Click", async () => {
    const f = oneClick();
    const res = await handle(post({ ...DRY, dry: false, amount: "300000000000000000000000" }), env, {
      fetch: f,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Refused: a real swap here is capped at 0.25 NEAR." });
    expect(f).not.toHaveBeenCalled();
    const ok = await handle(post({ ...DRY, dry: false, amount: "100000000000000000000000" }), env, {
      fetch: f,
    });
    expect(ok.status).toBe(201);
  });

  it("only swaps NEAR, with a whole-number amount", async () => {
    const f = oneClick();
    expect(
      (await handle(post({ ...DRY, originAsset: "nep141:usdt.tether-token.near" }), env, { fetch: f }))
        .status,
    ).toBe(400);
    expect((await handle(post({ ...DRY, amount: "1.5" }), env, { fetch: f })).status).toBe(400);
    expect((await handle(post({ ...DRY, dry: "yes" }), env, { fetch: f })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("answers 502 when 1Click cannot be reached", async () => {
    const res = await handle(post(DRY), env, {
      fetch: async () => {
        throw new Error("down");
      },
    });
    expect(res.status).toBe(502);
  });
});
