/**
 * Lesson 4.3's pure logic, shared by both views: the two timelines (the old lock-and-mint bridge and the
 * NEAR intent), where every figure says where it comes from (an estimate, the recorded quote or a live
 * quote); the side-by-side playback; the simulated vault exploit; what each scene object does when picked
 * and the one-sentence description for screen readers. No React, no three.js.
 * Facts: docs/lessons/stage-4/4.3-topic.md. Numbers: 4.3.md section 5 and the 1Click quote (spike 6).
 */
import type { IntentQuote } from "../../../chain/intents";
import { BACKING, COMPARE, CONFIDENTIAL, EXPLOIT, HOOK } from "./steps";

/** Where a figure comes from. Anything not read from a quote is an estimate and says so. */
export type Source = "estimate" | "recorded" | "live";
export interface Figure {
  text: string;
  source: Source;
}
export interface TimelineStep {
  label: string;
  time: Figure;
  fee: Figure;
}

const est = (text: string): Figure => ({ text, source: "estimate" });

/** The label printed next to a figure. */
export function sourceTag(s: Source): string {
  return s === "estimate" ? "est." : s === "recorded" ? "recorded quote" : "live quote";
}

/**
 * The old way, in the order the learner meets it (4.3.md step 2). Times are rough estimates that add up to
 * the topic's "about 20 minutes, often 15 to 30"; fees depend on gas prices and the bridge, so they are
 * named, not priced.
 */
export const BRIDGE_STEPS: TimelineStep[] = [
  { label: "Approve the bridge to move your USDC", time: est("under 1 min"), fee: est("Ethereum gas") },
  { label: "Lock your USDC in the bridge vault", time: est("about 1 min"), fee: est("Ethereum gas") },
  { label: "Wait for the bridge's signers to attest", time: est("about 15 min"), fee: est("none here") },
  {
    label: "Mint wUSDC, a wrapped IOU, on the other chain",
    time: est("about 1 min"),
    fee: est("gas + bridge fee"),
  },
  { label: "Swap wUSDC for the coin you want", time: est("about 1 min"), fee: est("swap fee + gas") },
  {
    label: "Later: burn wUSDC to unlock the USDC",
    time: est("another wait"),
    fee: est("gas on both chains"),
  },
];

export function bridgeTotal(): { time: Figure; fee: Figure } {
  return {
    time: est("about 20 min (often 15 to 30)"),
    fee: est("gas on two chains, a bridge fee and a swap fee"),
  };
}

const quoteSource = (q: IntentQuote): Source => (q.source === "recorded" ? "recorded" : "live");

/** What the solver keeps: the USD value in minus the USD value out, or null when the quote has no prices. */
export function spreadUsd(q: IntentQuote): number | null {
  if (q.amountInUsd === null || q.amountOutUsd === null) return null;
  return Math.max(0, q.amountInUsd - q.amountOutUsd);
}

function deliveryTime(q: IntentQuote): Figure {
  return { text: `about ${q.timeEstimate} s`, source: quoteSource(q) };
}
function spreadFee(q: IntentQuote): Figure {
  const s = spreadUsd(q);
  return s === null
    ? est("a small spread + fees, in the price")
    : { text: `about $${s.toFixed(2)} spread + fees`, source: quoteSource(q) };
}

/** The NEAR way: two steps. The delivery time and the solver's spread come from the quote. */
export function intentSteps(q: IntentQuote): TimelineStep[] {
  return [
    {
      label: "Sign your intent: what you give, what you want",
      time: est("a few seconds"),
      fee: est("tiny NEAR gas"),
    },
    { label: "A solver delivers native USDC from its own funds", time: deliveryTime(q), fee: spreadFee(q) },
  ];
}

export function intentTotal(q: IntentQuote): { time: Figure; fee: Figure } {
  return { time: deliveryTime(q), fee: spreadFee(q) };
}

// ---------- the side-by-side playback (step 2) ----------

/** One tick per bridge step; the intent's two steps light on the first two ticks. */
export const PLAY_TICKS = BRIDGE_STEPS.length;
export const PLAY_TICK_MS = 550;
export function litSteps(tick: number): { bridge: number; intent: number } {
  const t = Math.max(0, Math.min(PLAY_TICKS, tick));
  return { bridge: t, intent: Math.min(2, t) };
}

// ---------- the simulated exploit (step 4) ----------

/** The demo's vault size (4.3.md section 5). A simulation, not a real hack. */
export const VAULT_USD = "$100M";
export type ExploitPhase = "idle" | "crack" | "drain" | "done";
export const EXPLOIT_AT: Record<Exclude<ExploitPhase, "idle">, number> = { crack: 0, drain: 900, done: 1900 };
export const exploitDone = (p: ExploitPhase) => p === "done";

// ---------- picks ----------

export type Obj = "vault" | "slip" | "coin" | "mailbox" | "shield";

export const PICK_LABELS: Record<Obj, string> = {
  vault: "The bridge vault",
  slip: "The wrapped token, wUSDC",
  coin: "The native USDC coin",
  mailbox: "Your account on the other chain",
  shield: "The confidential shield",
};

export interface PickState {
  step: number;
  /** Ticks of the step 2 playback (0 to PLAY_TICKS). */
  played: number;
  inspected: boolean;
  exploit: ExploitPhase;
  shielded: boolean;
}

export interface PickResult {
  act?: "compare" | "inspect" | "exploit" | "shield";
  note: string;
  /** A "not yet" hint (the object shakes). */
  notYet?: boolean;
}

const exploitNow = (s: PickState) => s.step === EXPLOIT && s.exploit === "idle";

/** What picking `what` does at this point (docs/lessons/stage-4/4.3.md, "Reactions"). */
export function pickResult(what: Obj, s: PickState): PickResult {
  const drained = exploitDone(s.exploit);
  switch (what) {
    case "vault":
      if (exploitNow(s)) return { act: "exploit", note: "The simulated attacker breaks into the vault." };
      if (s.step === COMPARE && s.played === 0) return { act: "compare", note: "Both paths start to play." };
      return drained
        ? { note: "Vault status: drained by the simulated exploit. $0 of collateral left." }
        : {
            note: `The bridge vault: ${VAULT_USD} of locked USDC (simulated). Every wUSDC is a claim on it.`,
          };
    case "slip":
      if (exploitNow(s)) return { act: "exploit", note: "The simulated attacker breaks into the vault." };
      if (s.step === BACKING && !s.inspected)
        return { act: "inspect", note: "The slip turns over: it is an IOU." };
      if (!s.inspected && s.step < BACKING) return { notYet: true, note: "Inspect asset backing first." };
      return drained
        ? { note: "wUSDC status: no backing left, so it is worth $0.00 (simulated)." }
        : { note: "wUSDC: an IOU, a claim ticket on the bridge vault, not the coin itself." };
    case "coin":
      if (s.step === BACKING && !s.inspected)
        return { act: "inspect", note: "The coin turns: it is the real thing." };
      return {
        note: "Native USDC: issued on its own chain, worth $1.00. No bridge vault stands behind it, so a bridge hack cannot touch it.",
      };
    case "mailbox":
      if (s.step === BACKING && !s.inspected)
        return { act: "inspect", note: "The flag goes up: native USDC arrived." };
      if (!s.inspected) return { notYet: true, note: "Inspect asset backing first." };
      return {
        note: "Your account on the other chain: it holds native USDC directly, with no bridge IOU in between.",
      };
    case "shield":
      if (!drained) return { notYet: true, note: "Trigger the simulated vault exploit first." };
      if (s.step === CONFIDENTIAL && !s.shielded)
        return { act: "shield", note: "The shield closes around your intent's numbers." };
      return {
        note: s.shielded
          ? "Privacy: your intent's amounts stay encrypted until a solver is matched."
          : "A confidential intent hides its amounts from bots until a solver is matched.",
      };
  }
}

/** What the figure shows, in one sentence (the 2D group's label and the 3D description). */
export function describe(s: PickState): string {
  if (s.step === HOOK)
    return "Two tracks on one page. Behind: the old bridge, a vault and a wrapped IOU slip. In front: the NEAR way, your intent, a native coin and your mailbox.";
  if (s.step === COMPARE)
    return s.played >= PLAY_TICKS
      ? "Both paths have played: six steps for the old bridge, two for the intent."
      : s.played > 0
        ? "The two paths are playing side by side."
        : "Both paths wait at their start.";
  if (s.step === BACKING)
    return s.inspected
      ? "The wUSDC slip is an IOU tied to the vault. The native coin sits in your mailbox, flag up."
      : "A paper slip tied to the vault, and a coin by your mailbox. Which one is the real thing?";
  if (s.step === EXPLOIT)
    switch (s.exploit) {
      case "idle":
        return "The vault is full and closed. The slip and the coin are both worth $1.";
      case "crack":
        return "The vault cracks open in red ink.";
      case "drain":
        return "The collateral drains out of the vault.";
      default:
        return "The vault is drained: the wUSDC slip is crossed out at $0.00. The native coin is untouched at $1.00.";
    }
  if (s.step === CONFIDENTIAL)
    return s.shielded
      ? "An ink shield wraps your intent: its amounts are hidden until a solver is matched."
      : "Your intent stands open, its amounts in plain view.";
  return "The book is open at the bridges page.";
}
