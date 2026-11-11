// @vitest-environment node
/**
 * Live check of lessons 3.1 (deploy a contract) and 4.1 (chain signatures) on the REAL NEAR testnet.
 * Opt-in, because it needs the network and spends free testnet NEAR:
 *
 *   npm run test:testnet:lessons        (sets TESTNET=1)
 *
 * It makes the same calls as the lessons' state hooks (useDeploy.ts, useChainSig.ts), through the Chain
 * interface (TestnetChain) and the same helpers, and prints the evidence (tx hashes, numbers, answer
 * shape) as JSON. Nothing is sent to Sepolia. The throwaway practice key is kept OUTSIDE the repo in
 * $TESTNET_STORE (default: the OS temp dir), like `npm run test:testnet`.
 */
import { appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { base64 } from "@scure/base";
import { describe, expect, it } from "vitest";
import {
  deriveEvmAccount,
  finalizeEvmTransaction,
  prepareEvmTransfer,
  recoverEvmSigner,
  requestSignature,
  rootPublicKey,
  SIGNER_CONTRACT,
} from "../src/chain/chainSignatures";
import { COUNTER_WASM_BASE64, COUNTER_WASM_SHA256 } from "../src/chain/counterWasm";
import { actions, callMethod, createNamedAccount, decodeSuccessValue, explorerTxUrl } from "../src/chain/ops";
import { formatTgas } from "../src/chain/units";
import { testnetFileStore } from "../src/chain/testnet/fileStore.test-kit";
import { helperFunder } from "../src/chain/testnet/practice";
import { TestnetChain } from "../src/chain/testnet/TestnetChain";
import {
  CALL_GAS,
  CALLBACK_GAS,
  CONTRACT_FUNDING,
  contractIdFor,
  nearText,
  newParentName,
  PARENT_FUNDING,
  storageLock,
} from "../src/content/lessons/l-3-1-deploy-a-contract/contract";

const log = (label: string, v: unknown) =>
  appendFileSync(
    process.env.VERIFY_OUT ?? join(tmpdir(), "bon-verify-lessons.log"),
    `[verify] ${label} ${JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 1)}\n`,
  );

if (process.env.TESTNET) {
  const store = testnetFileStore();
  const chain = new TestnetChain({ store, funders: [helperFunder()] });

  describe("lesson 3.1 on testnet", () => {
    it("makes a parent, deploys the counter, calls it, fails with a callback and resets", async () => {
      const me = await chain.practiceAccount();
      log("practice", me.accountId);
      // The hex-account path of the lesson: a fresh short parent name first (createNamedAccount).
      const parent = newParentName();
      const made = await createNamedAccount(chain, parent, await chain.newKeyPair(), PARENT_FUNDING);
      expect(made.status.type).toBe("SuccessValue");
      log("parent", { parent, tx: made.transaction.hash, url: explorerTxUrl(made.transaction.hash) });

      const contractId = contractIdFor(parent)!;
      const code = base64.decode(COUNTER_WASM_BASE64);
      const deploy = await chain.sendTransaction({
        signerId: parent,
        receiverId: contractId,
        actions: [
          actions.createAccount(),
          actions.transfer(CONTRACT_FUNDING),
          actions.addFullAccessKey(await chain.newKeyPair()),
          actions.deployContract(code),
        ],
      });
      expect(deploy.status.type).toBe("SuccessValue");
      const atDeploy = await chain.viewAccount(contractId);
      expect(atDeploy.codeHash).toBe(COUNTER_WASM_SHA256);
      log("deploy", {
        contractId,
        tx: deploy.transaction.hash,
        codeBytes: code.length,
        storageUsage: atDeploy.storageUsage,
        storageDeposit: nearText(storageLock(atDeploy.storageUsage)),
        amount: atDeploy.amount,
        locked: atDeploy.locked,
      });

      const inc = await callMethod(chain, contractId, "increment", {}, { gas: CALL_GAS });
      expect(inc.status.type).toBe("SuccessValue");
      const incValue = decodeSuccessValue<number>(inc.status);
      const read = await chain.viewCall<number>(contractId, "get_num");
      const afterInc = await chain.viewAccount(contractId);
      log("increment", {
        tx: inc.transaction.hash,
        returned: incValue,
        get_num: read.result,
        storageUsage: afterInc.storageUsage,
        gas: inc.receipts.map((r) => formatTgas(r.gasBurnt)),
      });
      expect(Number(read.result)).toBe(1);

      const fail = await callMethod(
        chain,
        contractId,
        "call_other",
        { account_id: contractId, method_name: "fail" },
        { gas: CALLBACK_GAS },
      );
      const lines = fail.receipts
        .filter((r) => !r.isRefund)
        .map((r) => {
          const a = r.actions[0];
          return {
            method: a?.type === "FunctionCall" ? a.methodName : a?.type,
            ok: r.status.type !== "Failure",
            note: r.status.type === "Failure" ? r.status.error.message : r.logs.join(" "),
            gas: formatTgas(r.gasBurnt),
            block: r.blockHeight,
          };
        });
      const last = await chain.viewCall<string | null>(contractId, "last_result");
      const num = await chain.viewCall<number>(contractId, "get_num");
      log("fail+callback", {
        tx: fail.transaction.hash,
        status: fail.status.type,
        receipts: lines,
        refunds: fail.receipts.filter((r) => r.isRefund).length,
        last_result: last.result,
        get_num: num.result,
      });
      expect(lines.map((l) => [l.method, l.ok])).toEqual([
        ["call_other", true],
        ["fail", false],
        ["on_other_done", true],
      ]);
      expect(last.result).toBe("failed");

      const before = (await chain.viewAccount(contractId)).storageUsage;
      const reset = await callMethod(chain, contractId, "reset", {}, { gas: CALL_GAS });
      expect(reset.status.type).toBe("SuccessValue");
      const after = (await chain.viewAccount(contractId)).storageUsage;
      const zero = await chain.viewCall<number>(contractId, "get_num");
      log("reset", {
        tx: reset.transaction.hash,
        before,
        after,
        refund: nearText(storageLock(before - after)),
        get_num: zero.result,
      });
      expect(after).toBeLessThan(before);
    }, 300_000);
  });

  describe("lesson 4.1 on testnet", () => {
    it("derives the address, signs with the real MPC network and recovers the signer", async () => {
      const me = (await chain.practiceAccount()).accountId;
      const path = "ethereum-1";
      const root = await rootPublicKey(chain);
      const account = deriveEvmAccount(root, me, path);
      const withDomain = await chain.viewCall<string>(SIGNER_CONTRACT, "derived_public_key", {
        path,
        predecessor: me,
        domain_id: 0,
      });
      log("derive", { me, root, account, contract: withDomain.result });
      expect(withDomain.result).toBe(account.publicKey);

      const prepared = prepareEvmTransfer({ from: account.address });
      const t0 = performance.now();
      const phases: Record<string, number> = {};
      const out = await requestSignature(chain, prepared.payload, path, {
        onPhase: (e) => void (phases[e.phase] = Math.round(e.atMs)),
      });
      const wall = Math.round(performance.now() - t0);
      const raw = await chain.getTransaction(out.txHash, me);
      const signed = finalizeEvmTransaction(prepared, out.signature);
      const recovered = await recoverEvmSigner(signed);
      log("sign", {
        tx: out.txHash,
        url: explorerTxUrl(out.txHash),
        rawAnswer: decodeSuccessValue(raw.status),
        signature: out.signature,
        waitBlocks: out.waitBlocks,
        finalMs: out.ms,
        phases,
        wallMs: wall,
        tokensBurnt: nearText(out.tokensBurnt),
        gas: [raw.transactionOutcome, ...raw.receipts].map((r) => formatTgas(r.gasBurnt)),
        recovered,
      });
      expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
    }, 180_000);
  });
} else {
  describe("lessons 3.1 and 4.1 on testnet", () => {
    it.skip("runs only with TESTNET=1 (npm run test:testnet:lessons)", () => {});
  });
}
