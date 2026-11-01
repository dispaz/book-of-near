// @vitest-environment node
import { describe, expect, it } from "vitest";
import { base58 } from "@scure/base";
import { generateKey, parsePublicKey } from "near-kit";
import { serializeSignedTransaction, serializeTransaction, transactionHash } from "./borsh";
import { actions } from "../ops";
import type { Action, UnsignedTransaction } from "../types";
import { parseNear, tgas } from "../units";

// near-kit does not export its Borsh schema, so load the file directly to compare against it.
type Schema = { serialize(v: unknown): Uint8Array };
const kit = (await import(
  /* @vite-ignore */ new URL("../../../node_modules/near-kit/dist/core/schema.js", import.meta.url).href
)) as { TransactionSchema: Schema; SignedTransactionSchema: Schema };

const pk = (s: string) => ({ ed25519Key: { data: Array.from(parsePublicKey(s).data) } });

function kitAction(a: Action): unknown {
  switch (a.type) {
    case "CreateAccount":
      return { createAccount: {} };
    case "DeployContract":
      return { deployContract: { code: a.code } };
    case "FunctionCall":
      return {
        functionCall: {
          methodName: a.methodName,
          args: new TextEncoder().encode(JSON.stringify(a.args)),
          gas: a.gas,
          deposit: a.deposit,
        },
      };
    case "Transfer":
      return { transfer: { deposit: a.deposit } };
    case "AddKey":
      return {
        addKey: {
          publicKey: pk(a.publicKey),
          accessKey: {
            nonce: 0n,
            permission:
              a.permission.type === "FullAccess"
                ? { fullAccess: {} }
                : {
                    functionCall: {
                      allowance: a.permission.allowance ?? null,
                      receiverId: a.permission.receiverId,
                      methodNames: a.permission.methodNames,
                    },
                  },
          },
        },
      };
    case "DeleteKey":
      return { deleteKey: { publicKey: pk(a.publicKey) } };
    case "DeleteAccount":
      return { deleteAccount: { beneficiaryId: a.beneficiaryId } };
  }
}

function kitTx(tx: UnsignedTransaction) {
  return {
    signerId: tx.signerId,
    publicKey: pk(tx.publicKey),
    nonce: tx.nonce,
    receiverId: tx.receiverId,
    blockHash: Array.from(base58.decode(tx.blockHash)),
    actions: tx.actions.map(kitAction),
  };
}

describe("Borsh transaction encoding", () => {
  const key = generateKey().publicKey.toString();
  const other = generateKey().publicKey.toString();
  const tx: UnsignedTransaction = {
    signerId: "alice.testnet",
    publicKey: key,
    nonce: 123456789012345n,
    receiverId: "bob.testnet",
    blockHash: base58.encode(new Uint8Array(32).fill(7)),
    actions: [
      actions.createAccount(),
      actions.deployContract(new Uint8Array([0, 97, 115, 109])),
      actions.functionCall("increment", { by: 2 }, tgas(30), 1n),
      actions.transfer(parseNear("1.5")),
      actions.addFullAccessKey(other),
      actions.addFunctionCallKey(other, "counter.testnet", ["increment", "get_num"], parseNear("0.25")),
      actions.addFunctionCallKey(other, "counter.testnet"),
      actions.deleteKey(other),
      actions.deleteAccount("carol.testnet"),
    ],
  };

  it("matches near-kit's schema byte for byte", () => {
    expect(serializeTransaction(tx)).toEqual(kit.TransactionSchema.serialize(kitTx(tx)));
  });

  it("appends an ed25519 signature like near-kit", () => {
    const sig = new Uint8Array(64).fill(9);
    const ours = serializeSignedTransaction(tx, `ed25519:${base58.encode(sig)}`);
    const theirs = kit.SignedTransactionSchema.serialize({
      transaction: kitTx(tx),
      signature: { ed25519Signature: { data: Array.from(sig) } },
    });
    expect(ours).toEqual(theirs);
  });

  it("hashes to a 32-byte base58 id that changes with any field", () => {
    const h = transactionHash(tx);
    expect(base58.decode(h)).toHaveLength(32);
    expect(transactionHash({ ...tx, nonce: tx.nonce + 1n })).not.toBe(h);
  });
});
