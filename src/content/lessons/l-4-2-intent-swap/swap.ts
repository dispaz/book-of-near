/**
 * Lesson 4.2's pure logic, shared by both views: the solver's fill (a timed sequence), what each scene
 * object does when picked at a step (act, "not yet" hint or a detail), where the parcel stands and the
 * one-sentence description for screen readers. No React, no three.js.
 */
import type { IntentQuote } from "../../../chain/intents";
import { DECLARE, FILL, FINISH, HOOK, INSPECT } from "./steps";

/**
 * The solver's fill, in order: your NEAR is locked in the verifier, the solver sends USDC on Arbitrum,
 * the verifier checks the proof and releases your NEAR to the solver.
 */
export type FillPhase = "idle" | "lock" | "deliver" | "settle" | "done";
export const FILL_ORDER: FillPhase[] = ["idle", "lock", "deliver", "settle", "done"];
/** When each phase starts, in ms after "Simulate". */
export const FILL_AT: Record<Exclude<FillPhase, "idle">, number> = {
  lock: 0,
  deliver: 1300,
  settle: 2700,
  done: 3900,
};

export const fillReached = (now: FillPhase, phase: FillPhase) =>
  FILL_ORDER.indexOf(now) >= FILL_ORDER.indexOf(phase);
/** The USDC has arrived on Arbitrum. */
export const delivered = (f: FillPhase) => fillReached(f, "settle");

/** Scene objects the learner can pick. */
export type Obj = "origin" | "parcel" | "solver" | "destination" | "verifier" | "arbitrum";

export const PICK_LABELS: Record<Obj, string> = {
  origin: "Your NEAR account",
  parcel: "Your intent",
  solver: "The winning solver",
  destination: "Your Arbitrum address",
  verifier: "The verifier contract, intents.near",
  arbitrum: "Arbitrum",
};

export interface PickState {
  step: number;
  quote: IntentQuote | null;
  inspected: boolean;
  fill: FillPhase;
}

export interface PickResult {
  /** The step's action this pick does, if any. */
  act?: "quote" | "inspect" | "fill";
  /** What to show: a detail, what the pick did, or a "not yet" hint. */
  note: string;
  /** True for a "not yet" hint (the object shakes in 3D). */
  notYet?: boolean;
}

const usdc = (q: IntentQuote | null) => (q ? `${q.minAmountOutFormatted} USDC` : "a minimum of USDC");

/** What picking `what` does at this point (docs/lessons/stage-4/4.2.md, "Reactions"). */
export function pickResult(what: Obj, s: PickState): PickResult {
  const { step, quote, fill } = s;
  switch (what) {
    case "origin":
      if (step === DECLARE && !quote) return { act: "quote", note: "Your intent is on its way to 1Click." };
      return quote
        ? {
            note: `Your NEAR account. Origin deposit: ${quote.amountInFormatted} NEAR committed to the intent.`,
          }
        : { note: "Your NEAR account. It holds the NEAR you will trade." };
    case "parcel":
      if (step === DECLARE && !quote) return { act: "quote", note: "Your intent is on its way to 1Click." };
      if (!quote) return { notYet: true, note: "Declare your intent first." };
      if (step === INSPECT && !s.inspected)
        return { act: "inspect", note: "The parcel opens: the quote slip is inside." };
      return {
        note: `1Click's winning quote: at least ${usdc(quote)} guaranteed, about ${quote.timeEstimate} s to deliver${quote.appFee !== null ? `, app fee field ${quote.appFee}` : ""}.`,
      };
    case "solver":
      if (!quote) return { notYet: true, note: "Fetch an intent quote first." };
      if (step === FILL && fill === "idle") return { act: "fill", note: "The solver gets to work." };
      return {
        note: "The winning solver. It fronts native USDC on Arbitrum from its own funds, then claims your NEAR.",
      };
    case "verifier":
      if (step === FILL && quote && fill === "idle") return { act: "fill", note: "The solver gets to work." };
      if (!delivered(fill)) return { notYet: true, note: "Simulate the solver first." };
      return {
        note:
          fill === "done"
            ? "The verifier contract, intents.near. It checked the proof of delivery and released your NEAR to the solver."
            : "The verifier contract, intents.near. It is checking the proof of delivery.",
      };
    case "destination":
      if (!delivered(fill)) return { notYet: true, note: "Simulate the solver first." };
      return {
        note: `Your Arbitrum address: ${quote?.amountOutFormatted ?? "the"} USDC arrived. You paid no Arbitrum gas.`,
      };
    case "arbitrum":
      return {
        note: "Arbitrum, another chain with its own coins and its own gas. You never touch it yourself here.",
      };
  }
}

/**
 * Where the parcel (your intent, carrying your NEAR) stands: by your account, at the winning solver
 * (quote), locked in the verifier while the solver delivers, and with the solver once it is released.
 */
export type ParcelSpot = "home" | "solver" | "verifier";
export function parcelSpot(step: number, fill: FillPhase): ParcelSpot {
  if (step >= FILL && fillReached(fill, "lock") && fill !== "done") return "verifier";
  if (step >= INSPECT) return "solver";
  return "home";
}

/** What the figure shows, in one sentence (the 2D group's label and the 3D description). */
export function describe(s: PickState): string {
  const { step, quote, fill } = s;
  if (step === HOOK)
    return "Two chains on one page: NEAR on the left with your mailbox and the verifier contract, Arbitrum on the right with an empty mailbox. Three solvers stand between them.";
  if (step === DECLARE)
    return quote
      ? `Your intent, a parcel, stands by your NEAR mailbox: ${quote.amountInFormatted} NEAR for USDC on Arbitrum. The quote is back.`
      : "A dashed parcel by your NEAR mailbox: the intent, not sent yet.";
  if (step === INSPECT)
    return s.inspected && quote
      ? `The parcel is open at the winning solver. Its slip says at least ${quote.minAmountOutFormatted} USDC, in about ${quote.timeEstimate} seconds.`
      : "The parcel stands at the winning solver's desk, closed. One solver is lit: the winner.";
  if (step === FILL)
    switch (fill) {
      case "idle":
        return "The solver waits at its desk. Your intent is ready to be filled.";
      case "lock":
        return "Your NEAR goes into the verifier contract, intents.near, and is locked there.";
      case "deliver":
        return "The solver sends USDC coins from its own funds to your Arbitrum mailbox.";
      case "settle":
        return "USDC has arrived on Arbitrum: the flag is up. The verifier checks the proof.";
      default:
        return "Done: USDC in your Arbitrum mailbox, and the verifier released your NEAR to the solver.";
    }
  if (step === FINISH)
    return "The swap is filled: USDC in your Arbitrum mailbox, your NEAR with the solver. Choose how to finish.";
  return "The book is open at the intents page.";
}
