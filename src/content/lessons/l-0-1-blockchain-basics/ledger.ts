/**
 * The toy ledger of lesson 0.1 (docs/lessons/stage-0/0.1.md, section 6). Pure and synchronous.
 * Hash rule: sha256(height + "|" + prevHashHex + "|" + txText), lowercase hex.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const PEOPLE = ["Ana", "Ben", "Cora"] as const;
export type Person = (typeof PEOPLE)[number];
export type Balances = Record<Person, number>;

export const START: Balances = { Ana: 10, Ben: 5, Cora: 0 };
export const ZERO_HASH = "0".repeat(64);
export const GENESIS_TEXT = "genesis: Ana=10, Ben=5, Cora=0";

export interface Tx {
  from: Person;
  to: Person;
  amount: number;
}

/** The script's default transactions for blocks #1, #2 and #3. */
export const DEFAULT_TXS: readonly Tx[] = [
  { from: "Ana", to: "Ben", amount: 3 },
  { from: "Ben", to: "Cora", amount: 2 },
  { from: "Cora", to: "Ana", amount: 1 },
];

/** One block. `prev` is the previous block's hash as written into this block when it was made. */
export interface Block {
  height: number;
  tx: Tx | null;
  text: string;
  prev: string;
}
export type Chain = readonly Block[];

export const txText = (tx: Tx) => `${tx.from}->${tx.to} ${tx.amount}`;

export function blockHash(height: number, prev: string, text: string): string {
  return bytesToHex(sha256(utf8ToBytes(`${height}|${prev}|${text}`)));
}

export const shortHash = (h: string) => h.slice(0, 8);

export function genesisChain(): Chain {
  return [{ height: 0, tx: null, text: GENESIS_TEXT, prev: ZERO_HASH }];
}

export interface Verification {
  /** Each block's hash, recomputed from genesis. */
  computed: string[];
  /** links[i]: block i stores the hash its previous block really has now (links[0] is always true). */
  links: boolean[];
  /** True when every link after block `height` is broken. */
  allLaterBroken: (height: number) => boolean;
}

/** Recompute every hash from genesis, the way anyone checking a copy would. */
export function verify(chain: Chain): Verification {
  const computed: string[] = [];
  const links: boolean[] = [];
  chain.forEach((b, i) => {
    const prev = i === 0 ? ZERO_HASH : computed[i - 1]!;
    links.push(b.prev === prev);
    computed.push(blockHash(b.height, prev, b.text));
  });
  const allLaterBroken = (h: number) => links.length > h + 1 && links.slice(h + 1).every((ok) => !ok);
  return { computed, links, allLaterBroken };
}

export function balances(chain: Chain): Balances {
  const b = { ...START };
  for (const { tx } of chain) {
    if (!tx) continue;
    b[tx.from] -= tx.amount;
    b[tx.to] += tx.amount;
  }
  return b;
}

export type SendResult = { ok: true; chain: Chain } | { ok: false; reason: string };

/** Check a transaction and, if it is valid, add it to the end of the chain in a new block. */
export function send(chain: Chain, tx: Tx): SendResult {
  if (!Number.isInteger(tx.amount) || tx.amount <= 0) {
    return { ok: false, reason: "Rejected: type a whole number of coins, 1 or more" };
  }
  if (tx.from === tx.to) return { ok: false, reason: `Rejected: ${tx.from} cannot pay themselves` };
  const have = balances(chain)[tx.from];
  if (tx.amount > have) return { ok: false, reason: `Rejected: ${tx.from} only has ${have}` };
  const { computed } = verify(chain);
  const block: Block = { height: chain.length, tx, text: txText(tx), prev: computed[computed.length - 1]! };
  return { ok: true, chain: [...chain, block] };
}

/** Add blocks until the chain has `length` blocks: the default transaction, or 1 coin when it is rejected. */
export function fillTo(chain: Chain, length: number): Chain {
  let c = chain;
  while (c.length < length) {
    const want = DEFAULT_TXS[c.length - 1];
    let r: SendResult | null = want ? send(c, want) : null;
    if (!r?.ok) {
      const b = balances(c);
      const from = [...PEOPLE].sort((x, y) => b[y] - b[x])[0]!;
      const to = PEOPLE.find((p) => p !== from)!;
      r = send(c, { from, to, amount: 1 });
    }
    if (!r.ok) break;
    c = r.chain;
  }
  return c;
}

/** The hash block `height` would have with `text` instead of its real transaction. */
export function hashOfText(chain: Chain, height: number, text: string): string {
  const { computed } = verify(chain);
  const prev = height === 0 ? ZERO_HASH : computed[height - 1]!;
  return blockHash(height, prev, text);
}

/** Rewrite the amount in block `height`. The block keeps everything else, so later links break. */
export function tamperAmount(chain: Chain, height: number, amount: number): Chain {
  return chain.map((b) => {
    if (b.height !== height || !b.tx) return b;
    const tx = { ...b.tx, amount };
    return { ...b, tx, text: txText(tx) };
  });
}

/** Redo the first broken block: write the new hash of the block before it into it. */
export function repairNext(chain: Chain): Chain {
  const { computed, links } = verify(chain);
  const i = links.findIndex((ok) => !ok);
  if (i < 0) return chain;
  return chain.map((b, k) => (k === i ? { ...b, prev: computed[i - 1]! } : b));
}

/** Redo every later block, so the edited copy is consistent with itself again. */
export function restampAll(chain: Chain): Chain {
  let c = chain;
  for (let n = 0; n < chain.length; n++) c = repairNext(c);
  return c;
}

/** Two copies match when the newest block's hash is the same. */
export function compareCopies(a: Chain, b: Chain): boolean {
  const ha = verify(a).computed;
  const hb = verify(b).computed;
  return ha.length === hb.length && ha[ha.length - 1] === hb[hb.length - 1];
}
