import { describe, expect, it } from "vitest";
import { DemoChain } from "../../../chain/DemoChain";
import { actions } from "../../../chain/ops";
import { parseNear } from "../../../chain/units";
import { replayShort, replayWhy, sendAgain } from "./replay";

describe("replayWhy: the words under a copy the chain would not run", () => {
  it("says the nonce is used only when the chain says InvalidNonce", () => {
    const text = replayWhy({ reason: "InvalidNonce", message: "Nonce 7 is already used.", keyNonce: 9n });
    expect(text).toContain("its nonce is used");
    expect(text).toContain("The key's nonce is now 9.");
    expect(text).toContain("nothing was charged");
  });

  it("explains an expired copy by its deadline, not its nonce", () => {
    const text = replayWhy({
      reason: "Expired",
      message: "The transaction's block hash is unknown or too old.",
      keyNonce: 9n,
    });
    expect(text).not.toContain("nonce");
    expect(text).toMatch(/too old|expired/i);
    expect(text).toContain("nothing was charged");
  });

  it("gives the chain's own message for any other reason", () => {
    const text = replayWhy({
      reason: "AccessKeyNotFound",
      message: "tx-abc.testnet has no key ed25519:xyz.",
      keyNonce: null,
    });
    expect(text).not.toContain("nonce is used");
    expect(text).toContain("tx-abc.testnet has no key ed25519:xyz.");
  });

  it("gives the chain's message when it names no reason", () => {
    const text = replayWhy({ reason: null, message: "Refused by the node.", keyNonce: null });
    expect(text).not.toContain("nonce is used");
    expect(text).toContain("Refused by the node.");
  });

  it("has a short form for the 3D label that follows the same reason", () => {
    expect(replayShort("InvalidNonce")).toBe("its nonce is used");
    expect(replayShort("Expired")).toBe("it is too old");
    expect(replayShort("AccessKeyNotFound")).toBe("the chain refused it");
    expect(replayShort(null)).toBe("the chain refused it");
  });
});

describe("sendAgain: a signed transaction sent a second time", () => {
  it("is not run again, and the chain's reason is InvalidNonce", async () => {
    const chain = new DemoChain({ pace: "instant" });
    const me = await chain.practiceAccount();
    const signed = await chain.signTransaction(
      await chain.buildTransaction({
        signerId: me.accountId,
        receiverId: me.accountId,
        actions: [actions.transfer(parseNear("0.01"))],
      }),
    );
    await chain.sendSignedTransaction(signed);
    const balance = (await chain.viewAccount(me.accountId)).amount;

    const r = await sendAgain(chain, signed, { n: 1, which: "worked" });

    expect(r.notRun).toBe(true);
    expect(r.reason).toBe("InvalidNonce");
    expect(r.txNonce).toBe(signed.nonce);
    expect(r.keyNonce).toBe(signed.nonce);
    expect((await chain.viewAccount(me.accountId)).amount).toBe(balance);
  });
});
