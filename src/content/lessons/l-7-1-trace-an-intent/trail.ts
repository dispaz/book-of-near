/**
 * Lesson 7.1's pure logic, shared by both views: which intent is replayed (the learner's own swap from
 * lesson 4.2, else a recorded one), the trail of layers it passes through (each tied to the lesson that
 * taught it, filled with the learner's own evidence where they have it), the settlement sequence, what
 * each scene object does when picked, and the evidence for the completion record. No React, no three.js.
 */
import { RECORDED_QUOTE, VERIFIER_CONTRACT } from "../../../chain/intents";
import type { ProgressState } from "../../../progress/types";
import { RECORDED as RECORDED_TRACE } from "../l-2-1-follow-across-shards/recorded";
import { touchedShards } from "../l-2-1-follow-across-shards/trace";
import { AUTHORIZE, CHECK, CONTRACT, MAP, SETTLE, SHARDS } from "./steps";

export const LESSONS = {
  transaction: "l-0-3-send-a-transaction",
  account: "l-1-1-claim-your-name",
  key: "l-1-2-function-call-key",
  shards: "l-2-1-follow-across-shards",
  contract: "l-3-1-deploy-a-contract",
  signature: "l-4-1-one-account-every-chain",
  solver: "l-4-2-intent-swap",
} as const;

export type Layer = keyof typeof LESSONS;

/** Evidence by lesson id: what each earlier lesson left behind (finished record over early reports). */
export type EvidenceBook = Record<string, Record<string, string> | undefined>;

export function evidenceBook(snap: Pick<ProgressState, "evidence" | "completions">): EvidenceBook {
  const book: EvidenceBook = {};
  for (const [id, ev] of Object.entries(snap.evidence)) book[id] = { ...ev };
  for (const c of snap.completions) if (c.evidence) book[c.lessonId] = { ...book[c.lessonId], ...c.evidence };
  return book;
}

/** The name used when the learner has not claimed one in lesson 1.1. */
export const DEFAULT_NAME = "learner.testnet";
/** The recorded intent's id: lesson 4.2's recorded quote, replayed. No trade happened. */
export const RECORDED_INTENT_ID = "recorded-demo-intent";

export type IntentSource = "yours" | "demo-wallet" | "recorded";

export interface Intent {
  source: IntentSource;
  /** The swap's transaction hash, or RECORDED_INTENT_ID. */
  txHash: string;
  amountIn: string;
  amountOut: string;
  /** Where the USDC ended up, in plain words. */
  where: string;
}

/** The intent to replay: the learner's own 4.2 swap when there is one, else the recorded one. */
export function intentFrom(ev: Record<string, string> | undefined): Intent {
  const tx = ev?.realSwapTxHash;
  if (tx) {
    const real = ev.realSwapExecuted === "true" && !ev.simulatedSwap;
    return {
      source: real ? "yours" : "demo-wallet",
      txHash: tx,
      amountIn: "0.1",
      amountOut: ev.amountOut && real ? ev.amountOut : "about 0.4",
      where: real
        ? "kept in your NEAR Intents account (intents.near), not on Arbitrum. You withdraw it separately."
        : "kept in your NEAR Intents account in the simulation. No real money moved.",
    };
  }
  return {
    source: "recorded",
    txHash: RECORDED_INTENT_ID,
    amountIn: RECORDED_QUOTE.amountInFormatted,
    amountOut: RECORDED_QUOTE.amountOutFormatted,
    where: "native USDC on Arbitrum, the recorded quote's destination. This is a replay: no trade happened.",
  };
}

export interface Stop {
  layer: Layer;
  stage: number;
  lessonId: string;
  /** "Lesson 1.1: Claim your name". */
  lesson: string;
  /** The concept, in a few words. */
  concept: string;
  /** True when the value comes from the learner's own work. */
  mine: boolean;
  /** What the replay shows for this layer. */
  value: string;
}

const short = (s: string, head = 8, tail = 6) =>
  s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;

const RECORDED_SHARDS = touchedShards(RECORDED_TRACE).join(" → ");

export interface Trail {
  name: string;
  intent: Intent;
  stops: Stop[];
}

/** Every layer of the book the intent passes through, in order, with the learner's own values. */
export function buildTrail(book: EvidenceBook): Trail {
  const ev = (l: Layer) => book[LESSONS[l]];
  const acct = ev("account")?.accountId;
  const name = acct ?? DEFAULT_NAME;
  const intent = intentFrom(ev("solver"));
  const tx = ev("transaction")?.txHash;
  const key = ev("key")?.txHash;
  const shards = ev("shards")?.shards;
  const contract = ev("contract")?.contractId;
  const sig = ev("signature");
  const stops: Stop[] = [
    {
      layer: "transaction",
      stage: 0,
      lessonId: LESSONS.transaction,
      lesson: "Lesson 0.3: Send a transaction and watch it",
      concept: "a signed transaction",
      mine: !!tx,
      value: tx ? `your transaction ${short(tx)}` : "a transaction, signed with a key",
    },
    {
      layer: "account",
      stage: 1,
      lessonId: LESSONS.account,
      lesson: "Lesson 1.1: Claim your name",
      concept: "a named account",
      mine: !!acct,
      value: acct ? `your account ${name}` : `an example account, ${DEFAULT_NAME}`,
    },
    {
      layer: "key",
      stage: 1,
      lessonId: LESSONS.key,
      lesson: "Lesson 1.2: A key that can do only one thing",
      concept: "a function-call key",
      mine: !!key,
      value: key
        ? `your function-call key, used in ${short(key)}`
        : "a function-call key that may call one contract only",
    },
    {
      layer: "shards",
      stage: 2,
      lessonId: LESSONS.shards,
      lesson: "Lesson 2.1: Follow your transaction across shards",
      concept: "shards and receipts",
      mine: !!shards && ev("shards")?.source === "yours",
      value:
        shards && ev("shards")?.source === "yours"
          ? `your transaction touched shards ${shards.replace(/,/g, " → ")}`
          : `a recorded testnet transaction touched shards ${RECORDED_SHARDS}`,
    },
    {
      layer: "contract",
      stage: 3,
      lessonId: LESSONS.contract,
      lesson: "Lesson 3.1: Deploy a contract in one click",
      concept: "a Wasm contract and gas",
      mine: !!contract,
      value: contract
        ? `you deployed ${contract}; here the contract is ${VERIFIER_CONTRACT}`
        : `the verifier contract, ${VERIFIER_CONTRACT}`,
    },
    {
      layer: "solver",
      stage: 4,
      lessonId: LESSONS.solver,
      lesson: "Lesson 4.2: Swap across chains with an intent",
      concept: "an intent and a solver",
      mine: intent.source !== "recorded",
      value:
        intent.source === "yours"
          ? `your swap ${short(intent.txHash)}: ${intent.amountIn} NEAR for USDC`
          : intent.source === "demo-wallet"
            ? `your demo-wallet swap (simulated): ${intent.amountIn} NEAR for USDC`
            : `the recorded quote: ${intent.amountIn} NEAR for ${intent.amountOut} USDC`,
    },
    {
      layer: "signature",
      stage: 4,
      lessonId: LESSONS.signature,
      lesson: "Lesson 4.1: One account, every chain",
      concept: "Chain Signatures",
      mine: sig?.signatureReturned === "true",
      value:
        sig?.signatureReturned === "true"
          ? `your chain signature, requested in ${short(sig.mpcTxHash ?? sig.txHash ?? "")}`
          : "a chain signature from the signer contract (v1.signer), as in lesson 4.1",
    },
  ];
  return { name, intent, stops };
}

/** The layers each step stops at (the step's links back). The map shows them all. */
export const STEP_LAYERS: Record<number, Layer[]> = {
  [MAP]: ["transaction", "account", "key", "shards", "contract", "solver", "signature"],
  [AUTHORIZE]: ["account", "key", "transaction"],
  [SHARDS]: ["shards"],
  [CONTRACT]: ["contract"],
  [SETTLE]: ["solver", "signature"],
};

export const stopsFor = (trail: Trail, step: number): Stop[] =>
  (STEP_LAYERS[step] ?? []).map((l) => trail.stops.find((s) => s.layer === l)!);

// ---------- step 5: the settlement ----------

/**
 * The settlement, in order: the solver pays out, done. No chain signature: a 1Click swap settles inside
 * NEAR (intents.near). The signing nodes are a side note: they sign only when a payout must leave NEAR.
 */
export type SettlePhase = "idle" | "solver" | "done";
export const SETTLE_ORDER: SettlePhase[] = ["idle", "solver", "done"];
/** When each phase starts, in ms after "Verify foreign settlement". */
export const SETTLE_AT: Record<Exclude<SettlePhase, "idle">, number> = { solver: 0, done: 1500 };
/** The side note on the signing nodes, shown at step 5 and when they are picked. */
export const SIGNERS_NOTE =
  "Side note: the signing nodes (Chain Signatures, lesson 4.1) sign only when a payout must leave NEAR. This replay does not use them: the solver pays out from its own funds.";
export const settleReached = (now: SettlePhase, p: SettlePhase) =>
  SETTLE_ORDER.indexOf(now) >= SETTLE_ORDER.indexOf(p);

// ---------- picks ----------

export type Obj = "account" | "key" | "shards" | "verifier" | "signers" | "destination";

export const PICK_LABELS: Record<Obj, string> = {
  account: "Your account",
  key: "The function-call key",
  shards: "The shards",
  verifier: "The verifier contract",
  signers: "The signing nodes",
  destination: "Where the USDC lands",
};

export interface PickState {
  step: number;
  authorized: boolean;
  settle: SettlePhase;
  name: string;
  intent: Intent;
}

export interface PickResult {
  act?: "authorize" | "hop" | "run" | "settle";
  note: string;
  notYet?: boolean;
}

/** What picking `what` does now (docs/lessons/stage-7/7.1.md, "Reactions"). */
export function pickResult(what: Obj, s: PickState): PickResult {
  const { step, authorized, settle } = s;
  switch (what) {
    case "account":
      if (step === AUTHORIZE && !authorized)
        return { act: "authorize", note: "Your account signs the intent with its function-call key." };
      return {
        note: `${s.name}: a named account. It signs with a function-call key, so the full-access key stays safe.`,
      };
    case "key":
      if (step === AUTHORIZE && !authorized)
        return { act: "authorize", note: "The key signs: the stamped parcel leaves your mailbox." };
      return {
        note: `A function-call key. It may call only ${VERIFIER_CONTRACT}, and its gas allowance is capped.`,
      };
    case "shards":
      if (!authorized) return { notYet: true, note: "Authorize the intent first." };
      return {
        act: step === SHARDS ? "hop" : undefined,
        note: "The receipt hops from your shard to the verifier's shard. Other shards carry on; nothing is locked.",
      };
    case "verifier":
      if (!authorized) return { notYet: true, note: "Authorize the intent first." };
      return {
        act: step === CONTRACT ? "run" : undefined,
        note: `${VERIFIER_CONTRACT} runs as Wasm and checks the intent. The NEAR paid for its gas is destroyed; none goes to the contract.`,
      };
    case "signers":
      return {
        note: "The signing nodes each hold a share of one key and sign together, only when a payout must leave NEAR. This replay does not need them.",
      };
    case "destination":
      if (step < SETTLE) return { notYet: true, note: "Let the contract check the intent first." };
      if (step === SETTLE && settle === "idle")
        return { act: "settle", note: "The solver pays out from its own funds, and the trade settles." };
      if (!settleReached(settle, "done")) return { note: "The solver is paying out." };
      return { note: `${s.intent.amountOut} USDC, ${s.intent.where}` };
  }
}

/** Where the moving piece (the parcel, then the receipt) stands. */
export type Spot = "home" | "shardA" | "shardB" | "verifier" | "landed";
export function spotOf(step: number, authorized: boolean, settle: SettlePhase): Spot {
  if (step >= SETTLE) return settleReached(settle, "done") ? "landed" : "verifier";
  if (step === CONTRACT) return "verifier";
  if (step === SHARDS) return "shardB";
  return authorized ? "shardA" : "home";
}

/** What the figure shows, in one sentence (the 2D group's label and the 3D description). */
export function describe(s: PickState): string {
  const { step, authorized, settle } = s;
  if (step === MAP)
    return "One page holds the whole trail: your mailbox and key, two shard ribbons, the verifier scroll, the signing nodes and where the USDC lands.";
  if (step === AUTHORIZE)
    return authorized
      ? "The parcel is stamped and has left your mailbox for your shard."
      : "A parcel waits by your mailbox, with the function-call key beside it. Not signed yet.";
  if (step === SHARDS) return "The receipt has hopped from your shard to the verifier's shard.";
  if (step === CONTRACT)
    return "The receipt reached the verifier scroll. Its gear turns: the Wasm code checks the intent.";
  if (step === SETTLE)
    return settle === "idle"
      ? "The receipt waits at the verifier. The settlement is not verified yet. The signing nodes stand aside."
      : settle === "done"
        ? "Settled: the solver paid out, and the USDC has landed. The signing nodes were not needed."
        : "The solver pays out from its own funds.";
  return step >= CHECK ? "The book is open at the capstone page." : "";
}

// ---------- the completion record ----------

export function evidenceFor(trail: Trail, mode: string): Record<string, string> {
  const own = trail.stops.filter((s) => s.mine).map((s) => s.layer);
  const sig = trail.stops.find((s) => s.layer === "signature")!;
  return {
    capstoneComplete: "true",
    mode,
    txHash: trail.intent.txHash,
    intentSource: trail.intent.source,
    mpcVerified: String(sig.mine),
    stagesTraced: [...new Set(trail.stops.map((s) => s.stage))].join(","),
    ownLayers: own.join(",") || "none",
  };
}
