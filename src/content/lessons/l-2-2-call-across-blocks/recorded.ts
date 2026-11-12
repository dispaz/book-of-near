/**
 * A real testnet cross-contract call (spike 4, docs/spikes-seed.md), tx
 * HhRTH4KQ9n8WtsGv1VZ7S7UytSZHQxEdTCmyTCa38ULp. fjord calls market.withdraw; market calls usdc.ft_transfer
 * on another shard and waits for the answer in its callback on_withdraw. The values below were copied from
 * EXPERIMENTAL_tx_status (archival-rpc.testnet.fastnear.com) on 12 Nov 2026 and match the chain; the app
 * does not re-read them at run time. Shards come from the testnet layout read on 1 Nov 2026 (the
 * transaction status has none).
 *
 * Why testnet mode shows this recorded call instead of sending one: a deliberate choice to keep the lesson
 * free and fast. Helper contracts could be named onto chosen shards (spike 4 shows how), but sending a
 * fresh call would cost the learner gas and a few seconds of waiting, and would need helpers deployed and
 * kept alive on testnet.
 */
import { finish, type Hop } from "./call";

const SIGNER = "fjord.loca-swarm-mvwu8dfo.testnet";
const MARKET = "market.loca-swarm-mvwu8dfo.testnet";
const USDC = "usdc.loca-swarm-mvwu8dfo.testnet";

const rows: Omit<Hop, "index">[] = [
  {
    kind: "transaction",
    id: "HhRTH4KQ9n8WtsGv1VZ7S7UytSZHQxEdTCmyTCa38ULp",
    from: SIGNER,
    to: MARKET,
    method: "withdraw",
    shardId: 9,
    blockHeight: 275719637,
    gasBurnt: 308536337150n,
    ok: true,
    note: "Signed and checked on the signer's shard; turned into a receipt for the contract.",
  },
  {
    kind: "call",
    id: "ADt5VuWxR5pimkE4JVg8NuKzjKrBQUbcZJ3LUf3K4BZz",
    from: SIGNER,
    to: MARKET,
    method: "withdraw",
    shardId: 4,
    blockHeight: 275719638,
    gasBurnt: 2551239835599n,
    ok: true,
    note: "Calls ft_transfer on usdc, with on_withdraw as the callback.",
  },
  {
    kind: "call",
    id: "8NT1qzqnGUYUdyj8qxDTCX4rJoTRsVAPJXEW2LU9tDGU",
    from: MARKET,
    to: USDC,
    method: "ft_transfer",
    shardId: 5,
    blockHeight: 275719639,
    gasBurnt: 1838850356576n,
    ok: true,
    note: "Moves 269 test USDC from market to fjord, then sends the result back as a data receipt.",
  },
  {
    kind: "refund",
    id: "8L78rg8NGv4BMTWwmQWqcDwQgZ9CwVNMwxMrDqZwFq63",
    from: "system",
    to: SIGNER,
    method: null,
    shardId: 9,
    blockHeight: 275719639,
    gasBurnt: 223182562500n,
    ok: true,
    note: "Unused gas back to the signer.",
  },
  {
    kind: "callback",
    id: "8UBJdb3WVu38aLLXTNvh1yCMegEztFcVWfm6zCfufz9G",
    from: MARKET,
    to: MARKET,
    method: "on_withdraw",
    shardId: 4,
    blockHeight: 275719640,
    gasBurnt: 1679021999696n,
    ok: true,
    note: "Gets usdc's answer and records the withdrawal.",
  },
  {
    kind: "refund",
    id: "FhbmuT7Gg2z1hTbzKAnqGE1KKu7kDbjETZdCVtRnf25N",
    from: "system",
    to: SIGNER,
    method: null,
    shardId: 9,
    blockHeight: 275719640,
    gasBurnt: 223182562500n,
    ok: true,
    note: "Unused gas back to the signer.",
  },
  {
    kind: "refund",
    id: "4xrPUJdrK4GT52vmArqGM3bTdeZtCLMTyYvWNY4KSBbK",
    from: "system",
    to: SIGNER,
    method: null,
    shardId: 9,
    blockHeight: 275719641,
    gasBurnt: 223182562500n,
    ok: true,
    note: "Unused gas back to the signer.",
  },
];

export const RECORDED = finish({
  txHash: rows[0]!.id,
  source: "recorded",
  signerId: SIGNER,
  caller: MARKET,
  attachedGas: 150_000_000_000_000n,
  hops: rows.map((r, index) => ({ ...r, index })),
});
