import { beforeEach, describe, expect, it } from "vitest";
import { DemoChain } from "../../../chain/DemoChain";
import { demoContractCode } from "../../../chain/demo/contracts";
import { actions } from "../../../chain/ops";
import { parseNear, tgas } from "../../../chain/units";
import type { PublicKey } from "../../../chain/types";
import { findResumableKey, rememberKey } from "./resume";

let chain: DemoChain;
let account: string;

/** What the lesson's "Give the app a key" does: deploy the counter and add a function-call key. */
async function giveKey(allowance: string): Promise<{ key: PublicKey; hash: string }> {
  const key = await chain.newKeyPair();
  const out = await chain.sendTransaction({
    signerId: account,
    receiverId: account,
    actions: [
      actions.deployContract(demoContractCode("counter")),
      actions.addFunctionCallKey(key, account, [], parseNear(allowance)),
    ],
  });
  return { key, hash: out.transaction.hash };
}

async function count(key: PublicKey) {
  await chain.sendTransaction({
    signerId: account,
    publicKey: key,
    receiverId: account,
    actions: [actions.functionCall("increment", {}, tgas(5))],
  });
}

beforeEach(async () => {
  localStorage.clear();
  chain = new DemoChain({ pace: "instant" });
  account = (await chain.practiceAccount()).accountId;
});

describe("picking up the app's key after a reload", () => {
  it("finds nothing when the account has only its full-access key", async () => {
    expect(await findResumableKey(chain, account)).toBeNull();
  });

  it("finds the key, its counter and the original allowance and add hash remembered when it was added", async () => {
    const { key, hash } = await giveKey("0.2");
    rememberKey(account, key, { allowance: parseNear("0.2"), addKeyTxHash: hash });
    await count(key);

    const r = await findResumableKey(chain, account);
    expect(r).not.toBeNull();
    expect(r!.key).toBe(key);
    expect(r!.counter).toBe(1);
    expect(r!.initial).toBe(parseNear("0.2"));
    expect(r!.addKeyTxHash).toBe(hash);
    // The allowance left is below the original after a count, so the two are not the same number.
    const left = r!.info.permission.type === "FunctionCall" ? r!.info.permission.allowance : null;
    expect(left).not.toBeNull();
    expect(left!).toBeLessThan(parseNear("0.2"));
  });

  it("says the original allowance and the add hash are unknown when nothing was remembered", async () => {
    const { key } = await giveKey("0.2");
    await count(key);
    const r = await findResumableKey(chain, account);
    expect(r!.key).toBe(key);
    expect(r!.initial).toBeNull();
    expect(r!.addKeyTxHash).toBeNull();
  });

  it("does not mix up what was remembered for another key", async () => {
    const { key } = await giveKey("0.2");
    rememberKey(account, "ed25519:other" as PublicKey, { allowance: parseNear("0.3"), addKeyTxHash: "x" });
    const r = await findResumableKey(chain, account);
    expect(r!.key).toBe(key);
    expect(r!.initial).toBeNull();
  });

  it("still finds the key when storage is blocked", async () => {
    const { key } = await giveKey("0.1");
    const blocked = () => {
      throw new Error("blocked");
    };
    expect(() => rememberKey(account, key, { allowance: parseNear("0.1") }, blocked)).not.toThrow();
    const r = await findResumableKey(chain, account, blocked);
    expect(r!.key).toBe(key);
    expect(r!.initial).toBeNull();
  });
});
