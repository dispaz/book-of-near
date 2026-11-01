import { describe, expect, it } from "vitest";
import transferFinal from "./fixtures/transfer-final.json";
import {
  findInvalidTxReason,
  invalidTransactionError,
  mapAccessKeyList,
  mapShardLayout,
  mapTxOutcome,
} from "./map";
import { RpcError } from "./rpc";
import { parseNear } from "../units";

const layout = {
  shardIds: [10, 11, 1, 12, 13, 9, 6, 7, 4, 5],
  boundaryAccounts: ["625", "a", "b", "e", "fj", "g", "o", "p", "t"],
};

describe("RPC → Chain shapes", () => {
  it("maps a recorded testnet transfer (EXPERIMENTAL_tx_status FINAL)", () => {
    const tx = transferFinal as {
      transaction_outcome: { block_hash: string };
      receipts_outcome: { block_hash: string }[];
    };
    const blocks = new Map([
      [tx.transaction_outcome.block_hash, { height: 100, timestampMs: 1000 }],
      [tx.receipts_outcome[0]!.block_hash, { height: 101, timestampMs: 1600 }],
      [tx.receipts_outcome[1]!.block_hash, { height: 102, timestampMs: 2200 }],
    ]);
    const out = mapTxOutcome(transferFinal, { blocks, layout });
    expect(out.status).toEqual({ type: "SuccessValue", value: "" });
    expect(out.finalExecutionStatus).toBe("FINAL");
    expect(out.transaction.hash).toBe("7P1PvFi77NS93f7a7w62kHKqZ67vHzUYDcBzrur4oYCQ");
    expect(out.transaction.blockHash).toBe(""); // RPC does not return it
    expect(out.gasPrice).toBe(100_000_000n);
    const [main, refund] = out.receipts;
    expect(main!.isRefund).toBe(false);
    expect(main!.actions).toEqual([{ type: "Transfer", deposit: parseNear("0.01") }]);
    expect(main!.blockHeight).toBe(101);
    expect(main!.predecessorId).toBe(out.transaction.signerId);
    expect(refund!.isRefund).toBe(true);
    expect(refund!.predecessorId).toBe("system");
    expect(out.transactionOutcome.shardId).toBe(12); // "bon-…" sorts between boundaries "b" and "e"
    expect(out.timings).toEqual({
      built: 0,
      signed: 0,
      broadcast: 0,
      included: 0,
      executed: 600,
      final: 1200,
    });
  });

  it("rebuilds the first receipt when `receipts` leaves it out", () => {
    const trimmed = {
      ...transferFinal,
      receipts: transferFinal.receipts.filter((r) => r.predecessor_id === "system"),
    };
    const out = mapTxOutcome(trimmed, { blocks: new Map(), layout });
    expect(out.receipts.filter((r) => !r.isRefund)).toHaveLength(1);
  });

  it("reads keys and the shard layout", () => {
    const keys = mapAccessKeyList({
      keys: [
        { public_key: "ed25519:a", access_key: { nonce: 5, permission: "FullAccess" } },
        {
          public_key: "ed25519:b",
          access_key: {
            nonce: 0,
            permission: {
              FunctionCall: {
                allowance: "250000000000000000000000",
                receiver_id: "c.testnet",
                method_names: ["x"],
              },
            },
          },
        },
      ],
    });
    expect(keys[0]).toEqual({ publicKey: "ed25519:a", nonce: 5n, permission: { type: "FullAccess" } });
    expect(keys[1]!.permission).toEqual({
      type: "FunctionCall",
      receiverId: "c.testnet",
      methodNames: ["x"],
      allowance: parseNear("0.25"),
    });
    expect(mapShardLayout({ shard_layout: { V3: { boundary_accounts: ["m"], shard_ids: [3, 7] } } })).toEqual(
      {
        shardIds: [3, 7],
        boundaryAccounts: ["m"],
      },
    );
  });

  it("turns refused transactions into ChainError reasons", () => {
    const raw = {
      name: "HANDLER_ERROR",
      cause: { name: "INVALID_TRANSACTION", info: {} },
      data: { TxExecutionError: { InvalidTxError: { NotEnoughBalance: { balance: "1", cost: "2" } } } },
    };
    expect(invalidTransactionError(new RpcError("INVALID_TRANSACTION", "x", raw))?.reason).toBe(
      "NotEnoughBalance",
    );
    expect(findInvalidTxReason({ InvalidTxError: { InvalidAccessKeyError: "RequiresFullAccess" } })).toBe(
      "RequiresFullAccess",
    );
    const parse = new RpcError("PARSE_ERROR", "the Account ID contains an invalid character", {});
    expect(invalidTransactionError(parse)?.reason).toBe("InvalidReceiverId");
    expect(invalidTransactionError(new RpcError("UNKNOWN_BLOCK", "x", {}))).toBeNull();
  });
});
