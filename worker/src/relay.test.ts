import { describe, expect, it, vi } from "vitest";
import { encodeSignedDelegateAction, type SignedDelegateAction } from "near-kit";
import { handle, type Env } from "./index";
import { memoryCounters } from "./limits";
import type { RelaySender } from "./relay";

const env: Env = { ALLOWED_ORIGINS: "https://book-of-near.pages.dev", ALLOW_LOCALHOST: "1" };
const TGAS = 10n ** 12n;

function payload(
  senderId = "learner.testnet",
  action: Record<string, unknown> = {
    functionCall: {
      methodName: "ft_transfer",
      args: new TextEncoder().encode(JSON.stringify({ receiver_id: "friend.testnet", amount: "50" })),
      gas: 10n * TGAS,
      deposit: 1n,
    },
  },
): string {
  return encodeSignedDelegateAction({
    signedDelegate: {
      delegateAction: {
        senderId,
        receiverId: "token.learner.testnet",
        actions: [action],
        nonce: 7n,
        maxBlockHeight: 1000n,
        publicKey: { ed25519Key: { data: new Array(32).fill(1) } },
      },
      signature: { ed25519Signature: { data: new Array(64).fill(2) } },
    },
  } as unknown as SignedDelegateAction);
}

function fakeRelayer(): RelaySender & { relay: ReturnType<typeof vi.fn> } {
  return { relayerId: "relayer.bon.testnet", relay: vi.fn(async () => "RELAYTX") };
}

const post = (body: unknown, ip = "1.2.3.4") =>
  new Request("https://worker.example/relay", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://book-of-near.pages.dev", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });

describe("POST /relay", () => {
  it("relays a signed token transfer and says how many relays are left", async () => {
    const relayer = fakeRelayer();
    const res = await handle(post({ signedDelegate: payload() }), env, { relayer, counters: memoryCounters() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ txHash: "RELAYTX", relayerId: "relayer.bon.testnet", remaining: 2, cap: 3 });
    const sent = relayer.relay.mock.calls[0]![0] as SignedDelegateAction;
    expect(sent.signedDelegate.delegateAction.senderId).toBe("learner.testnet");
  });

  it("refuses after the per-learner cap", async () => {
    const relayer = fakeRelayer();
    const counters = memoryCounters();
    for (let i = 0; i < 3; i++)
      expect((await handle(post({ signedDelegate: payload() }), env, { relayer, counters })).status).toBe(200);
    const res = await handle(post({ signedDelegate: payload() }), env, { relayer, counters });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toContain("cap");
    expect(relayer.relay).toHaveBeenCalledTimes(3);
    // Another learner still gets relayed.
    const other = await handle(post({ signedDelegate: payload("other.testnet") }), env, { relayer, counters });
    expect(other.status).toBe(200);
  });

  it("will not pay for transfers, big deposits or too much gas", async () => {
    const relayer = fakeRelayer();
    const counters = memoryCounters();
    const bad = [
      { transfer: { deposit: 10n ** 24n } },
      { functionCall: { methodName: "x", args: new Uint8Array(), gas: TGAS, deposit: 2n } },
      { functionCall: { methodName: "x", args: new Uint8Array(), gas: 300n * TGAS, deposit: 0n } },
    ];
    for (const a of bad) {
      const res = await handle(post({ signedDelegate: payload("learner.testnet", a) }), env, { relayer, counters });
      expect(res.status).toBe(400);
    }
    expect((await handle(post({ signedDelegate: "not base64!" }), env, { relayer, counters })).status).toBe(400);
    expect(relayer.relay).not.toHaveBeenCalled();
  });

  it("answers 503 when no relayer key is configured", async () => {
    const res = await handle(post({ signedDelegate: payload() }), env, { relayer: null, counters: memoryCounters() });
    expect(res.status).toBe(503);
  });
});
