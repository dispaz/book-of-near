/**
 * Behavioural checks every Chain implementation must pass. DemoChain.test.ts runs them on
 * DemoChain; TestnetChain (#7) runs the same suite against testnet.
 *
 * The kit only talks to the Chain interface and ops.ts helpers.
 */
import { describe, expect, it } from "vitest";
import { isChainError } from "./errors";
import {
  actions,
  callMethod,
  createNamedAccount,
  createSubAccount,
  decodeSuccessValue,
  deleteKey,
  deployContract,
  implicitAccountId,
  phases,
  totalTokensBurnt,
  TX_PHASES,
  transfer,
} from "./ops";
import { shardForAccount } from "./shards";
import type { Chain, PhaseEvent, TxOutcome } from "./types";
import { parseNear, tgas } from "./units";

export interface ContractKitOptions {
  /**
   * Code of the "counter" test contract: increment({by}), get_num() view, fail() panics,
   * call_other({account_id, method_name}) calls another contract and records the result in a callback.
   */
  counterCode: Uint8Array;
  /** Per-test timeout; testnet needs more. */
  timeoutMs?: number;
  /** NEAR given to each helper account the kit creates (default 1 NEAR). */
  accountFunding?: bigint;
}

let funding = parseNear("1");

const BASE58_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

export async function expectChainError(p: Promise<unknown>, kind: string, reason?: string) {
  try {
    await p;
  } catch (e) {
    expect(isChainError(e), `expected ChainError, got ${String(e)}`).toBe(true);
    if (isChainError(e)) {
      expect(e.kind).toBe(kind);
      if (reason) expect(e.reason).toBe(reason);
    }
    return;
  }
  throw new Error(`expected ChainError ${kind}${reason ? `/${reason}` : ""}, but it resolved`);
}

/** A fresh named account owned by the chain's key store, funded from the practice account. */
async function newNamedAccount(chain: Chain, amount = funding) {
  const key = await chain.newKeyPair();
  const accountId = `bon${implicitAccountId(key).slice(0, 12)}.testnet`;
  const outcome = await createNamedAccount(chain, accountId, key, amount, { pace: "instant" });
  expect(outcome.status.type, JSON.stringify(outcome.status)).not.toBe("Failure");
  return { accountId, key };
}

export function runChainContract(makeChain: () => Chain | Promise<Chain>, opts: ContractKitOptions) {
  const t = opts.timeoutMs ?? 5_000;
  funding = opts.accountFunding ?? parseNear("1");
  const instant = { pace: "instant" } as const;

  describe("Chain contract", () => {
    it(
      "has a funded practice account with a full-access key",
      async () => {
        const chain = await makeChain();
        const me = await chain.practiceAccount();
        const view = await chain.viewAccount(me.accountId);
        expect(view.amount).toBeGreaterThan(parseNear("1"));
        const keys = await chain.listKeys(me.accountId);
        expect(keys.find((k) => k.publicKey === me.publicKey)?.permission).toEqual({ type: "FullAccess" });
        expect(await chain.accountExists(me.accountId)).toBe(true);
        expect(await chain.accountExists("no-such-account-zz9.testnet")).toBe(false);
        await expectChainError(chain.viewAccount("no-such-account-zz9.testnet"), "AccountDoesNotExist");
      },
      t,
    );

    it(
      "builds a transaction with a nonce above the key's and a known recent block hash, then signs it",
      async () => {
        const chain = await makeChain();
        const me = await chain.practiceAccount();
        const before = (await chain.listKeys(me.accountId)).find((k) => k.publicKey === me.publicKey)!;
        const unsigned = await chain.buildTransaction({
          receiverId: me.accountId,
          actions: [actions.transfer(1n)],
        });
        expect(unsigned.signerId).toBe(me.accountId);
        expect(unsigned.publicKey).toBe(me.publicKey);
        expect(unsigned.nonce).toBeGreaterThan(before.nonce);
        const block = await chain.block({ hash: unsigned.blockHash });
        expect(block.hash).toBe(unsigned.blockHash);
        const signed = await chain.signTransaction(unsigned);
        expect(signed.hash).toMatch(BASE58_HASH);
        expect(signed.signature).toMatch(/^ed25519:/);
      },
      t,
    );

    it(
      "sends a transfer: balances move, fee is burnt, receipts and phases are reported in order",
      async () => {
        const chain = await makeChain();
        const me = await chain.practiceAccount();
        const to = implicitAccountId(await chain.newKeyPair());
        const start = (await chain.viewAccount(me.accountId)).amount;
        const events: PhaseEvent[] = [];
        const amount = parseNear("0.01");
        const out = await transfer(chain, to, amount, { ...instant, onPhase: (e) => events.push(e) });

        expect(out.status.type).toBe("SuccessValue");
        expect(out.finalExecutionStatus).toBe("FINAL");
        expect(out.transaction.hash).toMatch(BASE58_HASH);
        expect(out.transaction.receiverId).toBe(to);
        expect(events.map((e) => e.phase)).toEqual(TX_PHASES);
        const tm = out.timings;
        expect(tm.built).toBeLessThanOrEqual(tm.signed);
        expect(tm.signed).toBeLessThanOrEqual(tm.broadcast);
        expect(tm.broadcast).toBeLessThan(tm.included);
        expect(tm.included).toBeLessThanOrEqual(tm.executed);
        expect(tm.executed).toBeLessThan(tm.final);

        const main = out.receipts.find((r) => !r.isRefund)!;
        expect(main.receiverId).toBe(to);
        expect(main.predecessorId).toBe(me.accountId);
        expect(main.actions).toEqual([{ type: "Transfer", deposit: amount }]);
        expect(main.id).toMatch(BASE58_HASH);
        expect(main.blockHash).toMatch(BASE58_HASH);
        expect(main.blockHeight).toBeGreaterThanOrEqual(out.transactionOutcome.blockHeight);
        expect(main.gasBurnt).toBeGreaterThan(0n);
        // At least gas × price. On testnet a receipt that creates an implicit account burns more
        // (about 0.0063 NEAR extra, measured 1 Nov 2026; the reason is unverified).
        expect(main.tokensBurnt).toBeGreaterThanOrEqual(main.gasBurnt * out.gasPrice);

        const fee = totalTokensBurnt(out);
        expect(fee).toBeGreaterThan(0n);
        expect(fee).toBeLessThan(parseNear("0.01"));
        expect((await chain.viewAccount(to)).amount).toBe(amount);
        expect((await chain.viewAccount(me.accountId)).amount).toBe(start - amount - fee);

        const again = await chain.getTransaction(out.transaction.hash, me.accountId);
        expect(again.transaction.hash).toBe(out.transaction.hash);
        expect(again.receipts.map((r) => r.id)).toEqual(out.receipts.map((r) => r.id));
      },
      t,
    );

    it(
      "places accounts on shards by the layout and records the tx in its block's chunk",
      async () => {
        const chain = await makeChain();
        const layout = await chain.shardLayout();
        expect(layout.shardIds.length).toBeGreaterThanOrEqual(2);
        expect(layout.boundaryAccounts.length).toBe(layout.shardIds.length - 1);
        const me = await chain.practiceAccount();
        const out = await transfer(chain, me.accountId, 1n, instant);
        const t0 = out.transactionOutcome;
        expect(t0.shardId).toBe(shardForAccount(layout, me.accountId));
        for (const r of out.receipts) expect(r.shardId).toBe(shardForAccount(layout, r.receiverId));
        const block = await chain.block({ height: t0.blockHeight });
        expect(block.hash).toBe(t0.blockHash);
        expect(block.chunks.map((c) => c.shardId)).toEqual(layout.shardIds);
        const chunk = await chain.chunk({ height: t0.blockHeight }, t0.shardId);
        expect(chunk.transactions).toContain(out.transaction.hash);
        const final = await chain.block("final");
        expect(final.height).toBeGreaterThanOrEqual(t0.blockHeight);
      },
      t,
    );

    it(
      "streams phases through the async iterator",
      async () => {
        const chain = await makeChain();
        const me = await chain.practiceAccount();
        const seen: string[] = [];
        const it = phases(chain, { receiverId: me.accountId, actions: [actions.transfer(1n)] }, instant);
        let r = await it.next();
        while (!r.done) {
          seen.push(r.value.phase);
          r = await it.next();
        }
        expect(seen).toEqual(TX_PHASES);
        expect(r.value.status.type).toBe("SuccessValue");
      },
      t,
    );

    it(
      "creates a named account and a sub-account with a key",
      async () => {
        const chain = await makeChain();
        const parent = await newNamedAccount(chain);
        expect(await chain.accountExists(parent.accountId)).toBe(true);
        const kidKey = await chain.newKeyPair();
        const kid = `kid.${parent.accountId}`;
        const out = await createSubAccount(chain, kid, kidKey, parseNear("0.5"), {
          ...instant,
          signerId: parent.accountId,
        });
        expect(out.status.type).toBe("SuccessValue");
        expect((await chain.viewAccount(kid)).amount).toBe(parseNear("0.5"));
        expect((await chain.listKeys(kid)).map((k) => k.publicKey)).toEqual([kidKey]);
      },
      t * 2,
    );

    it(
      "rolls back every action of a batch when one action fails",
      async () => {
        const chain = await makeChain();
        const parent = await newNamedAccount(chain);
        const before = (await chain.viewAccount(parent.accountId)).amount;
        const kid = `batch.${parent.accountId}`;
        const ghostKey = await chain.newKeyPair();
        const out = await chain.sendTransaction(
          {
            signerId: parent.accountId,
            receiverId: kid,
            actions: [
              actions.createAccount(),
              actions.transfer(parseNear("0.5")),
              actions.addFullAccessKey(await chain.newKeyPair()),
              actions.deleteKey(ghostKey), // fails: the key was never added
            ],
          },
          instant,
        );
        expect(out.status.type).toBe("Failure");
        if (out.status.type === "Failure" && out.status.error.type === "ActionError") {
          expect(out.status.error.index).toBe(3);
          expect(out.status.error.kind.type).toBe("DeleteKeyDoesNotExist");
          expect(out.status.error.message).toBeTruthy();
        } else throw new Error("expected an ActionError");
        expect(await chain.accountExists(kid)).toBe(false);
        // Only the fee is gone: the 0.5 NEAR deposit came back.
        expect((await chain.viewAccount(parent.accountId)).amount).toBe(before - totalTokensBurnt(out));
      },
      t * 2,
    );

    it(
      "adds a function-call key that can only call one contract, then deletes it",
      async () => {
        const chain = await makeChain();
        const me = await newNamedAccount(chain);
        const key = await chain.newKeyPair();
        const allowance = parseNear("0.25");
        await chain.sendTransaction(
          {
            signerId: me.accountId,
            receiverId: me.accountId,
            actions: [
              actions.deployContract(opts.counterCode),
              actions.addFunctionCallKey(key, me.accountId, ["increment"], allowance),
            ],
          },
          instant,
        );
        const listed = (await chain.listKeys(me.accountId)).find((k) => k.publicKey === key)!;
        expect(listed.permission).toEqual({
          type: "FunctionCall",
          receiverId: me.accountId,
          methodNames: ["increment"],
          allowance,
        });

        const asAgent = { signerId: me.accountId, publicKey: key, ...instant };
        const ok = await callMethod(chain, me.accountId, "increment", {}, { ...asAgent, gas: tgas(10) });
        expect(ok.status.type).toBe("SuccessValue");

        await expectChainError(
          // A small amount: testnet checks the balance before the key's permission.
          transfer(chain, "other-zz9.testnet", parseNear("0.01"), asAgent),
          "InvalidTransaction",
          "RequiresFullAccess",
        );
        await expectChainError(
          callMethod(chain, "testnet", "create_account", {}, asAgent),
          "InvalidTransaction",
          "ReceiverMismatch",
        );
        await expectChainError(
          callMethod(chain, me.accountId, "fail", {}, asAgent),
          "InvalidTransaction",
          "MethodNameMismatch",
        );
        await expectChainError(
          callMethod(chain, me.accountId, "increment", {}, { ...asAgent, deposit: 1n }),
          "InvalidTransaction",
          "DepositWithFunctionCall",
        );

        const del = await deleteKey(chain, key, { signerId: me.accountId, ...instant });
        expect(del.status.type).toBe("SuccessValue");
        expect((await chain.listKeys(me.accountId)).some((k) => k.publicKey === key)).toBe(false);
        await expectChainError(
          callMethod(chain, me.accountId, "increment", {}, asAgent),
          "InvalidTransaction",
          "AccessKeyNotFound",
        );
      },
      t * 3,
    );

    it(
      "deploys a contract, changes state with a call, reads it with a view, and reports a panic",
      async () => {
        const chain = await makeChain();
        const me = await newNamedAccount(chain);
        const dep = await deployContract(chain, opts.counterCode, { signerId: me.accountId, ...instant });
        expect(dep.status.type).toBe("SuccessValue");
        expect((await chain.viewAccount(me.accountId)).codeHash).not.toBe("11111111111111111111111111111111");

        const call = await callMethod(chain, me.accountId, "increment", { by: 2 }, instant);
        expect(call.status.type).toBe("SuccessValue");
        expect(decodeSuccessValue(call.status)).toBe(2);
        expect(call.receipts.some((r) => r.logs.length > 0)).toBe(true);
        const view = await chain.viewCall<number>(me.accountId, "get_num");
        expect(view.result).toBe(2);

        const bad = await callMethod(chain, me.accountId, "fail", {}, instant);
        expect(bad.status.type).toBe("Failure");
        if (bad.status.type === "Failure" && bad.status.error.type === "ActionError")
          expect(bad.status.error.kind.type).toBe("FunctionCallError");
        await expectChainError(chain.viewCall(me.accountId, "no_such_method"), "ViewFailed");
      },
      t * 2,
    );

    it(
      "runs a cross-contract call whose receipts hop blocks, and the callback sees a failure",
      async () => {
        const chain = await makeChain();
        const a = await newNamedAccount(chain);
        const b = await newNamedAccount(chain);
        await deployContract(chain, opts.counterCode, { signerId: a.accountId, ...instant });
        await deployContract(chain, opts.counterCode, { signerId: b.accountId, ...instant });

        const ok = await callMethod(
          chain,
          a.accountId,
          "call_other",
          { account_id: b.accountId, method_name: "increment" },
          { ...instant, gas: tgas(100) },
        );
        expect(ok.status.type).toBe("SuccessValue");
        const fnReceipts = ok.receipts.filter((r) => !r.isRefund);
        expect(fnReceipts.map((r) => r.receiverId)).toEqual([a.accountId, b.accountId, a.accountId]);
        const heights = fnReceipts.map((r) => r.blockHeight);
        expect(heights).toEqual([...heights].sort((x, y) => x - y));
        expect(new Set(heights).size).toBe(3);
        expect((await chain.viewCall<number>(b.accountId, "get_num")).result).toBe(1);

        const failed = await callMethod(
          chain,
          a.accountId,
          "call_other",
          { account_id: b.accountId, method_name: "fail" },
          { ...instant, gas: tgas(100) },
        );
        const inner = failed.receipts.find((r) => r.receiverId === b.accountId && !r.isRefund)!;
        expect(inner.status.type).toBe("Failure");
        expect((await chain.viewCall<string>(a.accountId, "last_result")).result).toBe("failed");
      },
      t * 3,
    );

    it(
      "refuses invalid transactions before they reach a block",
      async () => {
        const chain = await makeChain();
        const me = await chain.practiceAccount();
        const balance = (await chain.viewAccount(me.accountId)).amount;
        await expectChainError(
          transfer(chain, "Not A Valid Name", 1n, instant),
          "InvalidTransaction",
          "InvalidReceiverId",
        );
        await expectChainError(
          transfer(chain, me.accountId, balance + 1n, instant),
          "InvalidTransaction",
          "NotEnoughBalance",
        );
        // Replaying a signed transaction is refused: its nonce is used up.
        const signed = await chain.signTransaction(
          await chain.buildTransaction({ receiverId: me.accountId, actions: [actions.transfer(1n)] }),
        );
        await chain.sendSignedTransaction(signed, instant);
        await expectChainError(
          chain.sendSignedTransaction(signed, instant),
          "InvalidTransaction",
          "InvalidNonce",
        );
        // Tampering with a signed transaction breaks the signature.
        const signed2 = await chain.signTransaction(
          await chain.buildTransaction({ receiverId: me.accountId, actions: [actions.transfer(1n)] }),
        );
        await expectChainError(
          chain.sendSignedTransaction({ ...signed2, receiverId: "someone-else-zz9.testnet" }, instant),
          "InvalidTransaction",
          "InvalidSignature",
        );
        await expectChainError(chain.getTransaction(signed2.hash, me.accountId), "UnknownTransaction");
      },
      t,
    );
  });
}

/**
 * A fixed script of chain calls whose results are serialised. Two runs on fresh chains with the same
 * seed must produce the same string: that is the determinism check.
 */
export async function recordScenario(chain: Chain, counterCode: Uint8Array): Promise<string> {
  const log: unknown[] = [];
  const me = await chain.practiceAccount();
  log.push(me, await chain.shardLayout(), await chain.block("final"));
  const keep = (o: TxOutcome) => log.push(o);
  const to = implicitAccountId(await chain.newKeyPair());
  keep(await transfer(chain, to, parseNear("0.01"), { pace: "instant" }));
  const { accountId } = await newNamedAccount(chain);
  keep(await deployContract(chain, counterCode, { signerId: accountId, pace: "instant" }));
  keep(await callMethod(chain, accountId, "increment", { by: 3 }, { pace: "instant" }));
  keep(await callMethod(chain, accountId, "fail", {}, { pace: "instant" }));
  log.push(await chain.viewCall(accountId, "get_num"));
  log.push(await chain.viewAccount(me.accountId), await chain.listKeys(accountId));
  log.push(await chain.block("final"));
  return JSON.stringify(log, (_k, v: unknown) =>
    typeof v === "bigint" ? `${v}n` : v instanceof Uint8Array ? Array.from(v) : v,
  );
}
