/**
 * The honest scoreboard: four chains, four dimensions, and what a pick does. Pure, unit tested, no
 * three.js. Every note comes from docs/lessons/stage-7/7.2-topic.md, with its source tag. Numbers are
 * recorded data (RECORDED_ON), never live; anything we could not re-check is marked `unverified`.
 * No scores out of ten: a verdict per cell (leads, trade-off, trails) and a note that says why.
 */
import { ACCOUNTS, EXECUTION, LIQUIDITY, MYTH, SCALING } from "./steps";

export * from "./steps";

export type ChainId = "near" | "ethereum" | "solana" | "cosmos";
export type DimId = "accounts" | "scaling" | "execution" | "liquidity";
export type Verdict = "leads" | "trade-off" | "trails" | "not compared";

/** The day the numbers on the board were read from their sources (DefiLlama, the docs). */
export const RECORDED_ON = "13 Nov 2026";

/** DeFi TVL read from DefiLlama on RECORDED_ON (topic: "Recorded TVL"). Cosmos is not compared. */
export const TVL = {
  ethereum: "about $39.4 billion",
  solana: "about $5.0 billion",
  near: "about $162 million",
} as const;

export interface Chain {
  id: ChainId;
  name: string;
  /** The core idea of its design, in one line. */
  thesis: string;
  /** The trade-off that design accepts. */
  tradeoff: string;
  unverified?: boolean;
}

export const CHAINS: Chain[] = [
  {
    id: "near",
    name: "NEAR",
    thesis: "built-in sharding, and one account that reaches other chains (chain abstraction).",
    tradeoff: "calls between contracts are receipts in later blocks, and they do not roll back together.",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    thesis: "a very secure base chain that scales through rollups (separate L2 chains).",
    tradeoff: "high fees on the base chain, and money split across rollups with bridges between them.",
  },
  {
    id: "solana",
    name: "Solana",
    thesis: "one fast chain with one shared state (a monolithic chain).",
    tradeoff: "validators need heavy hardware, and the network has halted in the past.",
  },
  {
    id: "cosmos",
    name: "Cosmos",
    thesis: "many sovereign app chains that talk to each other over IBC.",
    tradeoff: "each chain runs its own validators, so security is split between chains.",
    unverified: true,
  },
];

export interface Dim {
  id: DimId;
  /** The card's title. */
  title: string;
  /** Lower case, inside a sentence. */
  short: string;
  step: number;
}

export const DIMS: Dim[] = [
  { id: "accounts", title: "Accounts", short: "accounts", step: ACCOUNTS },
  { id: "scaling", title: "Scalability", short: "scalability", step: SCALING },
  { id: "execution", title: "Speed", short: "speed and atomicity", step: EXECUTION },
  { id: "liquidity", title: "Liquidity", short: "liquidity", step: LIQUIDITY },
];

export interface Cell {
  verdict: Verdict;
  note: string;
  /** Source tags in the topic file (SOURCES). */
  sources?: string[];
  /** We could not re-check it against its source on RECORDED_ON. */
  unverified?: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const NOT_COMPARED = (why: string): Cell => ({ verdict: "not compared", note: `Not compared here: ${why}` });

export const CELLS: Record<DimId, Record<ChainId, Cell>> = {
  accounts: {
    near: {
      verdict: "leads",
      note: "Readable names are built in. One account holds many keys, and a function-call key may call only one contract, with a gas allowance.",
      sources: ["near-keys"],
    },
    ethereum: {
      verdict: "trade-off",
      note: "Accounts are 0x hex addresses. Smart-account features (ERC-4337, EIP-7702) need contract wallets and bundlers.",
      sources: ["eth-accounts"],
    },
    solana: {
      verdict: "trade-off",
      note: "Accounts are Base58 public keys. Each token sits in its own associated token account, an extra step.",
      sources: ["solana-docs"],
    },
    cosmos: NOT_COMPARED("our sources say nothing about Cosmos accounts."),
  },
  scaling: {
    near: {
      verdict: "leads",
      note: "Sharded: state and work are split across shards (testnet had 10 when we checked on 1 Nov 2026), and validators check chunks without storing every shard.",
      sources: ["near-sharding"],
    },
    ethereum: {
      verdict: "trade-off",
      note: "Scales with rollups. Its danksharding plan adds cheap data space (blobs) for rollups, not shards that run code.",
      sources: ["eth-danksharding"],
    },
    solana: {
      verdict: "trade-off",
      note: "One global state, run in parallel. Fast, but Anza's validator guide asks for 12 CPU cores (24 threads) or more.",
      sources: ["anza-hardware"],
    },
    cosmos: {
      verdict: "trade-off",
      note: "Scales by adding chains: over 200 run on its stack, linked by IBC. Each chain has its own validators, so security is split between chains.",
      sources: ["cosmos-docs"],
      unverified: true,
    },
  },
  execution: {
    solana: {
      verdict: "leads",
      note: "A call across many accounts runs in one atomic transaction. Solana's docs give about 400 ms per block.",
      sources: ["solana-docs"],
      unverified: true,
    },
    near: {
      verdict: "trade-off",
      note: "A block every 0.6 to 1 s, final after about 1.2 s. Each hop between contracts is a receipt in a later block, and the hops do not roll back together. Other calls can run before the callback, so a contract updates its state before it calls out.",
      sources: ["near-finality", "near-cross-contract", "near-reentrancy"],
    },
    ethereum: {
      verdict: "trade-off",
      note: "12-second slots. Calls between contracts run inside one atomic transaction, which is also where reentrancy bugs come from.",
      sources: ["eth-pos"],
    },
    cosmos: NOT_COMPARED("every Cosmos chain sets its own block time."),
  },
  liquidity: {
    ethereum: {
      verdict: "leads",
      note: `${cap(TVL.ethereum)} locked in DeFi: the most capital, custody and developer attention by far.`,
      sources: ["defillama", "eth-defi"],
    },
    solana: {
      verdict: "trade-off",
      note: `${cap(TVL.solana)} locked in DeFi, with heavy retail trading on its exchanges.`,
      sources: ["defillama"],
    },
    near: {
      verdict: "trails",
      note: `${cap(TVL.near)} locked in DeFi. NEAR leans on NEAR Intents and Chain Signatures to reach other chains' liquidity instead.`,
      sources: ["defillama", "near-intents"],
    },
    cosmos: NOT_COMPARED("Cosmos is many chains, and one hub's figure would mislead."),
  },
};

export const verdictOf = (dim: DimId, chain: ChainId) => CELLS[dim][chain].verdict;
export const chainOf = (id: ChainId) => CHAINS.find((c) => c.id === id)!;
export const dimOf = (id: DimId) => DIMS.find((d) => d.id === id)!;

/** The dimension a step compares, or null (the first page, the check, the honest take). */
export const dimForStep = (step: number): DimId | null => DIMS.find((d) => d.step === step)?.id ?? null;

/** The dimensions a learner has seen by the time they are at `step` (all of those before it). */
export const exploredBy = (step: number): Set<DimId> =>
  new Set(DIMS.filter((d) => d.step < step).map((d) => d.id));

const HEIGHT: Record<Verdict, number> = { leads: 1.9, "trade-off": 1.25, trails: 0.75, "not compared": 0.4 };
/** The height a chain's pillar stands at: level (no perfect blockchain) until a dimension is open. */
export const pillarHeight = (chain: ChainId, dim: DimId | null) =>
  dim ? HEIGHT[verdictOf(dim, chain)] : HEIGHT["trade-off"];

export const VERDICT_TEXT: Record<Verdict, string> = {
  leads: "leads",
  "trade-off": "trade-off",
  trails: "trails",
  "not compared": "not compared",
};

export type Obj = { kind: "card"; dim: DimId } | { kind: "pillar"; chain: ChainId };

export interface BoardState {
  step: number;
  explored: ReadonlySet<DimId>;
  /** The card open on the board: the pillars stand at its verdicts, and a pillar's note is its row. */
  active: DimId | null;
}

export interface Reaction {
  /** Open this dimension. */
  act?: DimId;
  /** "Not yet": why the object can't be used at this step. */
  hint?: string;
  /** A detail once the step is done. */
  detail?: string;
}

const leaderOf = (dim: DimId) => CHAINS.find((c) => verdictOf(dim, c.id) === "leads")!;
export const pillarSummary = (c: Chain) =>
  `${c.name}: ${c.thesis.charAt(0).toUpperCase()}${c.thesis.slice(1)} Trade-off: ${c.tradeoff}`;

/** What picking an object does at this step (both views, rule 10a). */
export function reaction(obj: Obj, s: BoardState): Reaction {
  const stepDim = dimForStep(s.step);
  if (obj.kind === "card") {
    const d = dimOf(obj.dim);
    if (s.explored.has(obj.dim))
      return { act: obj.dim, detail: `${d.title}: ${leaderOf(obj.dim).name} leads.` };
    if (obj.dim === stepDim) return { act: obj.dim };
    return { hint: `Not yet: this card opens at step ${d.step + 1}.` };
  }
  const chain = chainOf(obj.chain);
  if (stepDim && !s.explored.has(stepDim)) return { hint: `Open the ${dimOf(stepDim).title} card first.` };
  // The note describes the same card as the pillar's height; with no card open, the chain's design.
  if (s.step === MYTH || !s.active) return { detail: pillarSummary(chain) };
  return { detail: `${chain.name}, ${dimOf(s.active).short}: ${CELLS[s.active][obj.chain].note}` };
}

/** The scene's state in one string, for tests (`data-scene-state`). */
export const stateOf = ({
  active,
  explored,
}: {
  step: number;
  active: DimId | null;
  explored: ReadonlySet<DimId>;
}) =>
  `dim:${active ?? "none"};explored:${DIMS.filter((d) => explored.has(d.id))
    .map((d) => d.id)
    .join(",")}`;

/** One sentence for screen readers: what the board shows. */
export function describeBoard(active: DimId | null): string {
  if (!active)
    return "Four pillars of the same height: NEAR, Ethereum, Solana and Cosmos. No chain wins at everything. Four cards lie in front of them: accounts, scalability, speed and liquidity.";
  const parts = CHAINS.map((c) => `${c.name} ${VERDICT_TEXT[verdictOf(active, c.id)]}`);
  return `The ${dimOf(active).short} card is open. The pillars rise or sink: ${parts.join(", ")}.`;
}

/** The topic file's sources, by tag (docs/lessons/stage-7/7.2-topic.md). */
export const SOURCES: Record<string, { name: string; url: string }> = {
  "near-keys": { name: "NEAR docs, Access keys", url: "https://docs.near.org/protocol/access-keys" },
  "eth-accounts": {
    name: "ethereum.org, Accounts",
    url: "https://ethereum.org/en/developers/docs/accounts/",
  },
  "solana-docs": { name: "Solana docs", url: "https://solana.com/docs" },
  "near-sharding": { name: "NEAR docs, Sharding", url: "https://docs.near.org/protocol/sharding" },
  "eth-danksharding": {
    name: "ethereum.org, Danksharding",
    url: "https://ethereum.org/en/roadmap/danksharding/",
  },
  "anza-hardware": {
    name: "Anza docs, Validator requirements",
    url: "https://docs.anza.xyz/operations/requirements",
  },
  "cosmos-docs": { name: "Cosmos docs", url: "https://docs.cosmos.network/" },
  "near-finality": {
    name: "NEAR docs, Blocks and finality",
    url: "https://docs.near.org/integrations/blocks-and-finality",
  },
  "eth-pos": {
    name: "ethereum.org, Proof-of-stake",
    url: "https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/",
  },
  "near-cross-contract": {
    name: "NEAR docs, Cross-contract calls",
    url: "https://docs.near.org/build/smart-contracts/anatomy/cross-contract",
  },
  "near-reentrancy": {
    name: "NEAR docs, Security: reentrancy",
    url: "https://docs.near.org/smart-contracts/security/reentrancy",
  },
  "near-intents": {
    name: "NEAR docs, NEAR Intents",
    url: "https://docs.near.org/build/chain-abstraction/intents",
  },
  "eth-defi": { name: "ethereum.org, DeFi", url: "https://ethereum.org/en/defi/" },
  defillama: { name: "DefiLlama, chain TVL", url: "https://defillama.com/chains" },
};
