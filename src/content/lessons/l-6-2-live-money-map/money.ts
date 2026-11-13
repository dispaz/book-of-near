/**
 * Lesson 6.2's model, pure and unit tested: the RECORDED money map (docs/lessons/stage-6/6.2-topic.md,
 * "Recorded data, 13 Nov 2026"), the two pools' recorded quotes, and what each clickable object does when
 * picked (rule 10a, the script's Reactions table), with each object's pick animation (MOTIONS). It imports
 * only three.js's `Object3D` type, so three.js stays out of the 2D bundle. No network.
 *
 * Every figure here was read once on 13 Nov 2026 from DefiLlama's public APIs and NEAR mainnet view calls
 * (no keys) and is shown with RECORDED_NOTE. Nothing is fetched again, and nothing is presented as live.
 */
import type { Object3D } from "three";
import { swell } from "../../../scene-kit/reaction";
import { CHECK, DOLLARS, FLOWS, MAP, ORACLE, SWAP } from "./steps";

export const RECORDED_ON = "13 Nov 2026";
export const RECORDED_NOTE = `Recorded on ${RECORDED_ON}. Not live data.`;

/** DefiLlama, 13 Nov 2026 (`/v2/chains`, `/protocols` chainTvls.Near). The chain figures match lesson 7.2. */
export const TVL = {
  near: "about $162 million",
  ethereum: "about $39.4 billion",
  solana: "about $5.0 billion",
  rheaLend: "about $139 million",
  rheaDex: "about $21 million",
  /** Rhea Lend plus Rhea Dex: 138,950,502 + 21,396,972. */
  rhea: "about $160 million",
  intentsHeld: "about $89 million",
} as const;

/** `ft_total_supply` on NEAR mainnet, block 224,346,125 (6 decimals). `short` is for labels on the map. */
export const SUPPLY = {
  usdc: { name: "USDC", by: "issued by Circle on NEAR", amount: "79.3 million", short: "79.3M" },
  usdce: {
    name: "USDC.e",
    by: "minted by a bridge (factory.bridge.near)",
    amount: "14.6 million",
    short: "14.6M",
  },
} as const;

/** The map's label under the mailbox once the two USDCs are compared (both views). */
export const USDCE_LABEL = `${SUPPLY.usdce.name}: ${SUPPLY.usdce.short} bridged`;

/** `pyth-oracle.near`, NEAR/USD feed, block 224,346,234. DefiLlama coins API for the market price. */
export const ORACLE_READ = {
  contract: "pyth-oracle.near",
  feed: "NEAR/USD",
  stored: "$1.8843",
  confidence: "± $0.0021",
  published: "25 Aug 2026, 23:07 UTC",
  getPrice: "null",
  market: "$3.4956",
} as const;

/** NEAR Intents on DefiLlama (DEX volume), 13 Nov 2026. */
export const INTENTS = { day: "$176 million", month: "$3.77 billion" } as const;

/** Constant product with a fee in basis points (Rhea SDK `swap.ts`): what a simple pool pays out. */
export function constantProduct(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps: number) {
  const withFee = amountIn * BigInt(10_000 - feeBps);
  return (withFee * reserveOut) / (10_000n * reserveIn + withFee);
}

/** The two Rhea pools (`v2.ref-finance.near` `get_pool`, block 224,346,660, 13 Nov 2026 09:48 UTC). */
export const POOLS = {
  stable: {
    id: 6416,
    kind: "DEGEN_SWAP (a stable pool)",
    holds: "308,087.56 USDt and 291,937.71 USDC",
    /** Both sides added up, in dollars. */
    size: "about $600,000",
    fee: "0.01%",
  },
  simple: {
    id: 4512,
    kind: "SIMPLE_POOL (constant product)",
    holds: "945,455.09 USDC and 270,063.99 wNEAR",
    fee: "0.3%",
    feeBps: 30,
    /** USDC, 6 decimals. */
    reserveIn: 945_455_085_380n,
    /** wNEAR, 24 decimals. */
    reserveOut: 270_063_989_011_566_369_742_104_406_203n,
    /** USDC per NEAR before any trade. */
    startPrice: 945_455.08538 / 270_063.989011566,
  },
} as const;

export const SIZES = [100, 10_000, 100_000] as const;
export type Size = (typeof SIZES)[number];

/** `get_return` on both pools, same block. `simpleRaw` is wNEAR in yocto (24 decimals). */
export const QUOTES: Record<
  Size,
  { stableOut: number; simpleOut: number; simpleRaw: string; overStart: string }
> = {
  100: {
    stableOut: 100.085408,
    simpleOut: 28.475748,
    simpleRaw: "28475747910928696592799648",
    overStart: "0.3%",
  },
  10_000: {
    stableOut: 10_007.852679,
    simpleOut: 2_818.157082,
    simpleRaw: "2818157081750074643752683723",
    overStart: "1.4%",
  },
  100_000: {
    stableOut: 100_010.046253,
    simpleOut: 25_762.090317,
    simpleRaw: "25762090316638102318533263814",
    overStart: "10.9%",
  },
};

/** How many times native USDC's supply is bridged USDC.e's, rounded down and in words (79.3 / 14.6 → five). */
const nativeTimes = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][
  Math.floor(parseFloat(SUPPLY.usdc.amount) / parseFloat(SUPPLY.usdce.amount))
];

/** The Honest take (docs/lessons/stage-6/6.2.md, section 4), built from the recorded figures above. */
export const HONEST_TAKE = {
  comparedWith: [
    `Ethereum, with ${TVL.ethereum} in DeFi, the deepest pools (DefiLlama, recorded ${RECORDED_ON})`,
    `Solana, with ${TVL.solana} in DeFi (DefiLlama, recorded ${RECORDED_ON})`,
  ],
  strengths: [
    `Native dollars: Circle and Tether issue USDC and USDt on NEAR itself, with no bridge in between. Native ${SUPPLY.usdc.name} (${SUPPLY.usdc.amount}) is over ${nativeTimes} times bridged ${SUPPLY.usdce.name} (${SUPPLY.usdce.amount}).`,
    `Stable pools work: 100,000 USDC traded only about 0.01% away from 1:1 in a pool of ${POOLS.stable.size}.`,
    `Money moves through: NEAR Intents settled ${INTENTS.day} of trades in one day, more than all of NEAR's DeFi TVL.`,
  ],
  weaknesses: [
    `Shallow pools: NEAR's DeFi TVL is ${TVL.near}; Ethereum's is ${TVL.ethereum}. 100,000 USDC into Rhea's biggest USDC/NEAR pool paid ${QUOTES[100_000].overStart} over the starting price. A router can split a big trade across several pools, so that figure is for one pool only.`,
    `Concentrated: one group, Rhea, runs the main exchange and the main lending market, ${TVL.rhea} of the ${TVL.near.replace("about ", "")}.`,
    "Oracles can go quiet: Pyth no longer supports NEAR, and its stored NEAR price is from August. Protocols must check a price's age and find other feeds.",
    `Two USDCs: bridged ${SUPPLY.usdce.name} still circulates next to native ${SUPPLY.usdc.name}, and they are not the same token.`,
  ],
} as const;

/** USDC paid per NEAR in the simple pool for a trade of `size`. */
export const priceOf = (size: Size) => size / QUOTES[size].simpleOut;

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** The next trade size a pool pick tries: 100, 10,000, 100,000, then back to 100. */
export const nextSize = (s: Size | null): Size =>
  s === null ? SIZES[0] : SIZES[(SIZES.indexOf(s) + 1) % SIZES.length]!;

export const stableLine = (s: Size) => `${fmt(s)} USDC → ${fmt(QUOTES[s].stableOut, 2)} USDt`;
export const simpleLine = (s: Size) =>
  `${fmt(s)} USDC → ${fmt(QUOTES[s].simpleOut, 2)} NEAR at $${priceOf(s).toFixed(4)}`;

/** The shared state both views draw. */
export type MapState = {
  step: number;
  /** The learner compared native USDC with USDC.e (step 2). */
  compared: boolean;
  /** The learner read the oracle (step 3). */
  oracleRead: boolean;
  /** The last trade size tried in the pools (step 4), or none. */
  trade: Size | null;
  /** The intent flows are showing (step 5). */
  flows: boolean;
};

export type Obj = "usdc" | "oracle" | "stable" | "simple" | "lend" | "intents";

export const PICK_LABELS: Record<Obj, string> = {
  usdc: "The USDC mailbox",
  oracle: "The oracle booth",
  stable: "The stable pool",
  simple: "The simple pool",
  lend: "The Rhea Lend ledger",
  intents: "The NEAR Intents area",
};

/** One object's reaction: the step action (`act`), a "not yet" hint, or a detail. Always one of them. */
export type Reaction = { act?: "compare" | "read" | "trade" | "flows"; hint?: string; detail?: string };

const supplies = () =>
  `Native ${SUPPLY.usdc.name} ${SUPPLY.usdc.amount}, bridged ${SUPPLY.usdce.name} ${SUPPLY.usdce.amount}. ${RECORDED_NOTE}`;

export function reactionFor(what: Obj, s: MapState): Reaction {
  switch (what) {
    case "usdc":
      if (s.step === DOLLARS && !s.compared) return { act: "compare" };
      if (s.step < DOLLARS)
        return {
          detail: "Stablecoins: tokens meant to stay worth one dollar. Circle issues USDC on NEAR itself.",
        };
      return { detail: supplies() };
    case "oracle":
      if (s.step < ORACLE) return { hint: "Not yet: you read the oracle on step 3." };
      if (s.step === ORACLE && !s.oracleRead) return { act: "read" };
      return {
        detail: `Stored ${ORACLE_READ.feed} ${ORACLE_READ.stored}, published ${ORACLE_READ.published}. get_price says ${ORACLE_READ.getPrice}: too old.`,
      };
    case "stable":
    case "simple":
      if (s.step < SWAP)
        return { hint: s.oracleRead ? "Not yet: you trade on step 4." : "Read the oracle first." };
      if (s.step === SWAP) return { act: "trade" };
      return {
        detail:
          what === "stable"
            ? `Stable pool #${POOLS.stable.id}: ${stableLine(s.trade ?? 100_000)}.`
            : `Simple pool #${POOLS.simple.id}: ${simpleLine(s.trade ?? 100_000)}.`,
      };
    case "lend":
      return {
        detail: `Rhea Lend (was Burrow): supply tokens to earn interest, or borrow against them. ${TVL.rheaLend} locked.`,
      };
    case "intents":
      if (s.trade === null) return { hint: "Trade in the pools first." };
      if (s.step < FLOWS) return { hint: "Not yet: you follow the flows on step 5." };
      if (s.step === FLOWS && !s.flows) return { act: "flows" };
      return {
        detail: `NEAR Intents: ${INTENTS.day} of trades in one day, settled on NEAR. ${RECORDED_NOTE}`,
      };
  }
}

/** What the scene shows, in one sentence per step, for screen readers (both views). */
export function describe(s: MapState): string {
  switch (s.step) {
    case MAP:
      return `The money map on the page: a USDC mailbox (stablecoins), an oracle booth, two Rhea pools (the exchange), the Rhea Lend ledger (lending) and the NEAR Intents area. NEAR DeFi held ${TVL.near}.`;
    case DOLLARS:
      return s.compared
        ? `The USDC mailbox is open: ${supplies()}`
        : "The USDC mailbox, closed. Compare native USDC with the bridged USDC.e.";
    case ORACLE:
      return s.oracleRead
        ? `The oracle booth shows the stored ${ORACLE_READ.feed} price, ${ORACLE_READ.stored}, from ${ORACLE_READ.published}. get_price refuses it as too old.`
        : "The oracle booth, dark. Read the oracle to see its stored price and its age.";
    case SWAP:
      return s.trade
        ? `Two pools after a trade: stable ${stableLine(s.trade)}; simple ${simpleLine(s.trade)}.`
        : "Two pools, stable and simple, waiting for a trade.";
    case FLOWS:
      return s.flows
        ? `Arrows run from the NEAR Intents area onto the page: ${INTENTS.day} of trades in one day.`
        : "The NEAR Intents area at the back of the page. Show the flows.";
    default:
      return s.step >= CHECK ? "The whole money map." : "";
  }
}

/** The completion record: the 100,000 USDC comparison, worked out from recorded quotes. Nothing was sent. */
export function evidenceFor(): Record<string, string> {
  return {
    pair: "USDC/USDt",
    amountIn: "100000",
    stableOut: QUOTES[100_000].stableOut.toFixed(6),
    simpleOutNear: QUOTES[100_000].simpleOut.toFixed(6),
    recordedOn: "2026-11-13",
    kind: "recorded",
  };
}

// ---------- each object's own pick animation (Pickable's `pickMotion`) ----------

/**
 * The objects' pick animations, on the group Pickable hands over (already posed for hover and press:
 * they add to that pose). Each returns true while it plays and leaves no offset once it settles.
 */
export const MOTIONS: Record<Obj, (o: Object3D, t: number) => boolean> = {
  /** The mailbox lifts once, like a lid opening. */
  usdc(o, t) {
    const T = 0.6;
    if (t >= T) return false;
    o.position.y += 0.3 * swell(t, T);
    return true;
  },
  /** The booth bobs twice, like a ticker. */
  oracle(o, t) {
    const T = 0.8;
    if (t >= T) return false;
    o.position.y += 0.15 * Math.abs(Math.sin((t / T) * Math.PI * 2));
    return true;
  },
  /** The pool's water sways side to side. */
  stable: sway(0.12),
  simple: sway(0.2),
  /** The ledger's pages riffle up. */
  lend(o, t) {
    const T = 0.6;
    if (t >= T) return false;
    o.scale.y *= 1 + 0.3 * swell(t, T);
    return true;
  },
  /** The area pulses up. */
  intents(o, t) {
    const T = 0.6;
    if (t >= T) return false;
    o.position.y += 0.12 * swell(t, T);
    return true;
  },
};

function sway(amount: number) {
  return (o: Object3D, t: number) => {
    const T = 0.8;
    if (t >= T) return false;
    o.rotation.z += amount * Math.sin((t / T) * Math.PI * 2) * (1 - t / T);
    return true;
  };
}
