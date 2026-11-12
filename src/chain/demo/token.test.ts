import { describe, expect, it } from "vitest";
import { DEMO_RELAYER, DemoChain, demoContractCode } from "../DemoChain";
import { isChainError } from "../errors";
import { actions, callMethod, createNamedAccount } from "../ops";
import { parseNear, tgas } from "../units";
import { FT_STORAGE_DEPOSIT } from "./token";

const OWNER = "bon-token.testnet";
const TOKEN = `token.${OWNER}`;
const FRIEND = "friend.testnet";
const send = { pace: "instant" } as const;

async function setup(relayCap?: number) {
  const chain = new DemoChain({ pace: "instant", relayCap });
  await createNamedAccount(chain, OWNER, await chain.newKeyPair(), parseNear("1"), send);
  const out = await chain.sendTransaction(
    {
      signerId: OWNER,
      receiverId: TOKEN,
      actions: [
        actions.createAccount(),
        actions.transfer(parseNear("0.1")),
        actions.addFullAccessKey(await chain.newKeyPair()),
        actions.deployContract(demoContractCode("ft")),
        actions.functionCall(
          "new",
          { owner_id: OWNER, total_supply: "1000", metadata: { symbol: "BOOK", name: "BOOK", decimals: 0 } },
          tgas(30),
          0n,
        ),
      ],
    },
    send,
  );
  expect(out.status.type).toBe("SuccessValue");
  return chain;
}

const bal = async (chain: DemoChain, id: string) =>
  (await chain.viewCall<string>(TOKEN, "ft_balance_of", { account_id: id })).result;

const ftTransfer = (amount = "50") =>
  actions.functionCall("ft_transfer", { receiver_id: FRIEND, amount }, tgas(10), 1n);

describe("demo fungible token (NEP-141 + NEP-145)", () => {
  it("mints the whole supply to the owner", async () => {
    const chain = await setup();
    expect(await bal(chain, OWNER)).toBe("1000");
    expect((await chain.viewCall(TOKEN, "ft_metadata")).result).toMatchObject({ symbol: "BOOK" });
  });

  it("refuses a transfer to an unregistered account, then allows it after storage_deposit", async () => {
    const chain = await setup();
    const refused = await callMethod(
      chain,
      TOKEN,
      "ft_transfer",
      { receiver_id: FRIEND, amount: "50" },
      {
        ...send,
        signerId: OWNER,
        gas: tgas(10),
        deposit: 1n,
      },
    );
    expect(refused.status.type).toBe("Failure");
    expect(JSON.stringify(refused.status)).toContain(`The account ${FRIEND} is not registered`);

    const before = (await chain.viewAccount(TOKEN)).storageUsage;
    const reg = await callMethod(
      chain,
      TOKEN,
      "storage_deposit",
      { account_id: FRIEND },
      {
        ...send,
        signerId: OWNER,
        gas: tgas(10),
        deposit: FT_STORAGE_DEPOSIT,
      },
    );
    expect(reg.status.type).toBe("SuccessValue");
    expect((await chain.viewAccount(TOKEN)).storageUsage).toBeGreaterThan(before);
    expect((await chain.viewCall(TOKEN, "storage_balance_of", { account_id: FRIEND })).result).not.toBeNull();
  });
});

describe("demo relayer (NEP-366 meta-transactions)", () => {
  async function registered(relayCap?: number) {
    const chain = await setup(relayCap);
    await callMethod(
      chain,
      TOKEN,
      "storage_deposit",
      { account_id: FRIEND },
      {
        ...send,
        signerId: OWNER,
        gas: tgas(10),
        deposit: FT_STORAGE_DEPOSIT,
      },
    );
    return chain;
  }

  it("runs a signed transfer as the sender while the relayer pays all the NEAR", async () => {
    const chain = await registered();
    const ownerBefore = (await chain.viewAccount(OWNER)).amount;
    const relayerBefore = (await chain.viewAccount(DEMO_RELAYER)).amount;
    const signed = await chain.signDelegate({ senderId: OWNER, receiverId: TOKEN, actions: [ftTransfer()] });
    const r = await chain.relayDelegate(signed, send);
    expect(r.outcome.status.type).toBe("SuccessValue");
    expect(r.outcome.transaction.signerId).toBe(DEMO_RELAYER);
    expect(r.remaining).toBe(2);
    expect(await bal(chain, FRIEND)).toBe("50");
    expect(await bal(chain, OWNER)).toBe("950");
    expect((await chain.viewAccount(OWNER)).amount).toBe(ownerBefore);
    expect((await chain.viewAccount(DEMO_RELAYER)).amount).toBeLessThan(relayerBefore);
    // The inner call ran with the owner as predecessor.
    expect(r.outcome.receipts.some((x) => x.predecessorId === OWNER && x.receiverId === TOKEN)).toBe(true);
  });

  it("refuses after the per-learner cap", async () => {
    const chain = await registered(2);
    for (let i = 0; i < 2; i++) {
      const s = await chain.signDelegate({ senderId: OWNER, receiverId: TOKEN, actions: [ftTransfer("10")] });
      await chain.relayDelegate(s, send);
    }
    const s = await chain.signDelegate({ senderId: OWNER, receiverId: TOKEN, actions: [ftTransfer("10")] });
    const e = await chain.relayDelegate(s, send).catch((x: unknown) => x);
    expect(isChainError(e) && e.kind).toBe("RelayRefused");
    expect(await bal(chain, FRIEND)).toBe("20");
  });

  it("rejects a tampered or replayed delegate action", async () => {
    const chain = await registered();
    const s = await chain.signDelegate({ senderId: OWNER, receiverId: TOKEN, actions: [ftTransfer()] });
    const tampered = await chain.relayDelegate({ ...s, actions: [ftTransfer("900")] }, send);
    expect(tampered.outcome.status.type).toBe("Failure");
    expect(await chain.relayDelegate(s, send).then((r) => r.outcome.status.type)).toBe("SuccessValue");
    const replay = await chain.relayDelegate(s, send);
    expect(replay.outcome.status.type).toBe("Failure");
    expect(await bal(chain, FRIEND)).toBe("50");
  });
});
