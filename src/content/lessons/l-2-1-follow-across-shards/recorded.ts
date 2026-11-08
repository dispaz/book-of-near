/**
 * A real testnet transaction saved on 1 Nov 2026 (fetched through archival-rpc.testnet.fastnear.com), for
 * learners who skipped 0.3 and for demo mode. The shard layout is the one read the same day: ten shards
 * with non-contiguous ids. See docs/lessons/stage-2/2.1.md, section 6.
 */
import type { Hop, Trace } from "./trace";

const SIGNER = "fjord.loca-swarm-mvwu8dfo.testnet";
const MARKET = "market.loca-swarm-mvwu8dfo.testnet";
const USDC = "usdc.loca-swarm-mvwu8dfo.testnet";

const B637 = "4Q2yMdd2PSKAucxpcj3ssv9tYAbYiw52VoqF9jEpHGPs";
const B638 = "9CwhxYtoD72w4q6uSnSC9Vs33oS7RHfPDPVmzM75Lrka";
const B639 = "E6adLxZ13cw2AVBwriSSq7BxgSQUwHZzTAsS4gwYCc37";
const B640 = "FBSRaJ52doNkEsPw4R1BRuAPftdj2oKNyFqmKpQSpBrq";
const B641 = "F2meR2uXS7rgSWGBYgHRgdM5SS4i8T1TJE2HZN2HCnj";

const rows: Omit<Hop, "index">[] = [
  {
    kind: "transaction",
    id: "HhRTH4KQ9n8WtsGv1VZ7S7UytSZHQxEdTCmyTCa38ULp",
    accountId: SIGNER,
    shardId: 9,
    blockHeight: 275719637,
    blockHash: B637,
    chunkHash: "2nq8jS6q1hnzNupWeUUbNmCrg3BXy7msqkd34rHUu7ga",
    sinceMs: 0,
    gasBurnt: 308536337150n,
  },
  {
    kind: "receipt",
    id: "ADt5VuWxR5pimkE4JVg8NuKzjKrBQUbcZJ3LUf3K4BZz",
    accountId: MARKET,
    predecessorId: SIGNER,
    shardId: 4,
    blockHeight: 275719638,
    blockHash: B638,
    chunkHash: "51MoM61tHJ7XyBBV1TQQkXCXEDQ3ncKxqA6BTmCHruzW",
    sinceMs: 585,
    gasBurnt: 2551239835599n,
  },
  {
    kind: "receipt",
    id: "8NT1qzqnGUYUdyj8qxDTCX4rJoTRsVAPJXEW2LU9tDGU",
    accountId: USDC,
    predecessorId: MARKET,
    shardId: 5,
    blockHeight: 275719639,
    blockHash: B639,
    chunkHash: "8ZJFwvUSFit9cgMG6ur47v1N6bsyiVEykSFRpLHgaA2a",
    sinceMs: 1218,
    gasBurnt: 1838850356576n,
  },
  {
    kind: "refund",
    id: "8L78rg8NGv4BMTWwmQWqcDwQgZ9CwVNMwxMrDqZwFq63",
    accountId: SIGNER,
    predecessorId: "system",
    shardId: 9,
    blockHeight: 275719639,
    blockHash: B639,
    chunkHash: "AtEvKLUCt9yaXfvABf57dWHsEFecp153EHCjAwEpMg7u",
    sinceMs: 1218,
    gasBurnt: 223182562500n,
  },
  {
    kind: "callback",
    id: "8UBJdb3WVu38aLLXTNvh1yCMegEztFcVWfm6zCfufz9G",
    accountId: MARKET,
    predecessorId: MARKET,
    shardId: 4,
    blockHeight: 275719640,
    blockHash: B640,
    chunkHash: "AiCdkiwK83BSJZNmzaoeLt5pnEnCSUVQPidFD6pipVbg",
    sinceMs: 1868,
    gasBurnt: 1679021999696n,
  },
  {
    kind: "refund",
    id: "FhbmuT7Gg2z1hTbzKAnqGE1KKu7kDbjETZdCVtRnf25N",
    accountId: SIGNER,
    predecessorId: "system",
    shardId: 9,
    blockHeight: 275719640,
    blockHash: B640,
    chunkHash: "DismbHM9XKcrVSi5upsV1TWq4jdgTHGxgojZBqEK1pHx",
    sinceMs: 1868,
    gasBurnt: 223182562500n,
  },
  {
    kind: "refund",
    id: "4xrPUJdrK4GT52vmArqGM3bTdeZtCLMTyYvWNY4KSBbK",
    accountId: SIGNER,
    predecessorId: "system",
    shardId: 9,
    blockHeight: 275719641,
    blockHash: B641,
    chunkHash: "C7WiNd9uzjkuqf1hujVCAqJr8gSXvxd5mA1wS2ffrr39",
    sinceMs: 2369,
    gasBurnt: 223182562500n,
  },
];

export const RECORDED: Trace = {
  txHash: rows[0]!.id,
  signerId: SIGNER,
  source: "recorded",
  shardIds: [10, 11, 1, 12, 13, 9, 6, 7, 4, 5],
  hops: rows.map((r, index) => ({ ...r, index })),
  firstBlock: 275719637,
  lastBlock: 275719641,
  workMs: 2369,
};
