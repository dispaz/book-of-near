import { describe, expect, it, vi } from "vitest";
import {
  FundingError,
  fundPracticeAccount,
  helperFunder,
  localPracticeStore,
  newPracticeRecord,
  PRACTICE_STORAGE_KEY,
  workerFunder,
} from "./practice";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("practice account funding", () => {
  it("uses the Worker faucet first and sends only the public key", async () => {
    const fetch = vi.fn(async () => json(200, { accountId: "abc123" }));
    const out = await fundPracticeAccount("ed25519:PUB", [
      workerFunder("https://w.example/", fetch),
      helperFunder(fetch),
    ]);
    expect(out).toEqual({ accountId: "abc123", fundedBy: "worker" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://w.example/faucet");
    expect(JSON.parse(String(init.body))).toEqual({ publicKey: "ed25519:PUB" });
  });

  it("falls back to the public helper when the Worker is down", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("w.example")) throw new TypeError("Failed to fetch");
      return json(200, { status: { SuccessValue: "" } });
    });
    const helper = helperFunder(fetch as unknown as typeof globalThis.fetch, () => "bon-test.testnet");
    const out = await fundPracticeAccount("ed25519:PUB", [
      workerFunder("https://w.example", fetch as never),
      helper,
    ]);
    expect(out).toEqual({ accountId: "bon-test.testnet", fundedBy: "helper" });
    const body = JSON.parse(String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(body).toEqual({ newAccountId: "bon-test.testnet", newAccountPublicKey: "ed25519:PUB" });
  });

  it("explains why when every faucet fails", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("w.example")
        ? json(429, { error: "Daily limit reached for this address" })
        : json(429, {}),
    );
    const p = fundPracticeAccount("ed25519:PUB", [
      workerFunder("https://w.example", fetch as never),
      helperFunder(fetch as never),
    ]);
    await expect(p).rejects.toBeInstanceOf(FundingError);
    await expect(p).rejects.toThrow(/Daily limit reached.*public testnet faucet answered 429/);
  });
});

describe("practice account storage", () => {
  it("keeps a clearly labelled throwaway testnet key in localStorage", () => {
    const store = localPracticeStore();
    store.save(newPracticeRecord("abc", "ed25519:PUB", "ed25519:SECRET", "helper"));
    const raw = localStorage.getItem(PRACTICE_STORAGE_KEY)!;
    expect(raw).toContain("TESTNET only");
    expect(store.load()?.accountId).toBe("abc");
    store.clear();
    expect(store.load()).toBeNull();
  });

  it("survives blocked storage", () => {
    const store = localPracticeStore(() => {
      throw new Error("blocked");
    });
    expect(store.load()).toBeNull();
    expect(() => store.save(newPracticeRecord("a", "b", "c", "d"))).not.toThrow();
  });
});
