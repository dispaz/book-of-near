/**
 * Lesson 6.1's model, pure and unit tested: the veNEAR lock (a multiplier from 1× at 1 month to 4× at
 * 48 months, as the topic and script say), the example proposal and its tally, and what each clickable
 * object does when picked (rule 10a, the script's Reactions table). No three.js, no network.
 *
 * The proposal is an EXAMPLE written for this lesson (docs/lessons/stage-6/6.1.md, step 4), not a real or
 * live one, and the vote is a practice vote: it changes this page's tally only and sends nothing.
 */
import type { Object3D } from "three";
import { swell } from "../../../scene-kit/reaction";
import { CHECK, HALL, INSPECT, LOCK, STAKE, VOTE } from "./steps";

/** How much NEAR the learner locks in the calculator. */
export const LOCKED = 100;
export const MIN_MONTHS = 1;
export const MAX_MONTHS = 48;
/** The lengths the gauge steps through when it is picked. */
const PRESETS = [1, 12, 24, 36, 48];

const clampMonths = (m: number) => Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, m));

/** Voting power per locked NEAR: 1× at 1 month, rising evenly to 4× at 48 months. */
export function multiplier(months: number): number {
  const m = clampMonths(months);
  return 1 + (3 * (m - MIN_MONTHS)) / (MAX_MONTHS - MIN_MONTHS);
}

/** veNEAR for the locked NEAR, rounded to a whole number. */
export const vePower = (months: number) => Math.round(LOCKED * multiplier(months));

/** The multiplier as the learner reads it: "2.5×", "4×". */
export const times = (months: number) => `${Number(multiplier(months).toFixed(1))}×`;

/** The next lock length when the gauge is picked: the next preset up, wrapping to 1 month after 48. */
export function nextPreset(months: number): number {
  return PRESETS.find((p) => p > months) ?? PRESETS[0]!;
}

/** The example proposal (the script's Proposal #42). Made up for this lesson: not a real proposal. */
export const PROPOSAL = {
  id: 42,
  title: "Allocate 50,000 NEAR for Open Source Tooling Grants",
  summary: "Fund open source developer tools for NEAR builders, paid out from the DAO's treasury.",
  ask: "50,000 NEAR",
  to: "tooling-grants.example",
  yes: 186_000,
  no: 114_000,
  quorum: 500_000,
} as const;

export type Choice = "yes" | "no";
export type Ballot = { choice: Choice; power: number };

/** The tally with the learner's ballot added (if any). Percentages of the votes cast and of the quorum. */
export function tally(ballot: Ballot | null) {
  const yes = PROPOSAL.yes + (ballot?.choice === "yes" ? ballot.power : 0);
  const no = PROPOSAL.no + (ballot?.choice === "no" ? ballot.power : 0);
  const total = yes + no;
  const pct = (n: number, of: number) => Math.round((n / of) * 10_000) / 100;
  return {
    yes,
    no,
    total,
    quorum: PROPOSAL.quorum,
    yesPct: Math.round((yes / total) * 100),
    noPct: 100 - Math.round((yes / total) * 100),
    quorumPct: pct(total, PROPOSAL.quorum),
    reached: total >= PROPOSAL.quorum,
  };
}

export const fmt = (n: number) => n.toLocaleString("en-US");

/** The shared state both views draw. */
export type Gov = {
  step: number;
  months: number;
  /** The learner set a lock on step 3 (the slider or the gauge). */
  locked: boolean;
  /** The learner read the proposal on step 4. */
  reviewed: boolean;
  ballot: Ballot | null;
};

export type Obj = "pool" | "gauge" | "scroll" | "yes" | "no";

export const PICK_LABELS: Record<Obj, string> = {
  pool: "The staking pool",
  gauge: "The veNEAR gauge",
  scroll: "Proposal #42",
  yes: "The YES stamp",
  no: "The NO stamp",
};

/** One object's reaction: the step action (`act`), a "not yet" hint, or a detail. Always one of them. */
export type Reaction = { act?: "lock" | "review" | "vote"; hint?: string; detail?: string };

export function reactionFor(what: Obj, s: Gov): Reaction {
  const t = tally(s.ballot);
  switch (what) {
    case "pool":
      return {
        detail: "Example: 50 NEAR delegated to a validator's pool. Unstaking takes 4 epochs, about 48 hours.",
      };
    case "gauge":
      if (s.step < LOCK) return { hint: "Not yet: you set a lock on step 3." };
      if (s.step === LOCK) return { act: "lock" };
      return {
        detail: `${LOCKED} NEAR locked for ${s.months} month${s.months === 1 ? "" : "s"}: ${fmt(vePower(s.months))} veNEAR (${times(s.months)}).`,
      };
    case "scroll":
      if (s.step < INSPECT) return { hint: "Not yet: you read the proposal on step 4." };
      if (!s.reviewed) return { act: "review" };
      return {
        detail: `Proposal #${PROPOSAL.id} (example): ${t.yesPct}% yes, ${t.noPct}% no; quorum needs ${fmt(PROPOSAL.quorum)} veNEAR.`,
      };
    case "yes":
    case "no": {
      if (s.ballot) {
        const side = s.ballot.choice.toUpperCase();
        return what === s.ballot.choice
          ? { detail: `Practice vote: +${fmt(s.ballot.power)} veNEAR ${side}. Nothing was sent to a chain.` }
          : { detail: `You voted ${side}. One vote per voter.` };
      }
      if (!s.reviewed) return { hint: "Inspect the proposal first." };
      if (s.step < VOTE) return { hint: "Not yet: you vote on step 5." };
      if (s.step === VOTE) return { act: "vote" };
      return { hint: "Vote first (step 5)." };
    }
  }
}

/** What the scene shows, in one sentence per step, for screen readers (both views). */
export function describe(s: Gov): string {
  const t = tally(s.ballot);
  switch (s.step) {
    case HALL:
      return "A town hall on the page: a staking pool's mailbox, a veNEAR gauge, a proposal scroll and two ballot stamps, YES and NO.";
    case STAKE:
      return "The staking pool's mailbox: delegated NEAR sits in the pool's contract, and unstaking takes 4 epochs, about 48 hours.";
    case LOCK:
      return `The veNEAR gauge: ${LOCKED} NEAR locked for ${s.months} month${s.months === 1 ? "" : "s"} gives ${fmt(vePower(s.months))} veNEAR, ${times(s.months)} the voting power.`;
    case INSPECT:
      return s.reviewed
        ? `Proposal #${PROPOSAL.id}, an example, is unrolled: it asks for ${PROPOSAL.ask}. ${t.yesPct}% yes, ${t.noPct}% no.`
        : `Proposal #${PROPOSAL.id}, an example, is rolled up on the page. Read it to unroll it.`;
    case VOTE:
      return s.ballot
        ? `Your practice vote is stamped ${s.ballot.choice.toUpperCase()}: ${t.yesPct}% yes, ${t.noPct}% no, quorum ${t.quorumPct}% reached.`
        : `Two ballot stamps, YES and NO, wait by the proposal. Quorum ${t.quorumPct}% reached.`;
    default:
      return s.step >= CHECK ? "The whole town hall, with your practice vote on the proposal." : "";
  }
}

/** The completion record: a practice vote, never presented as an on-chain one. */
export function evidenceFor(b: Ballot): Record<string, string> {
  return {
    proposalId: String(PROPOSAL.id),
    voteCast: "true",
    choice: b.choice,
    power: String(b.power),
    kind: "practice",
  };
}

// ---------- each object's own pick animation (Pickable's `pickMotion`) ----------

/**
 * The objects' pick animations, on the group Pickable hands over (already posed for hover and press:
 * they add to that pose). Each returns true while it plays and leaves no offset once it settles.
 */
export const MOTIONS: Record<Obj, (o: Object3D, t: number) => boolean> = {
  /** The mailbox lifts once, like a lid opening on what it holds. */
  pool(o, t) {
    const T = 0.6;
    if (t >= T) return false;
    o.position.y += 0.3 * swell(t, T);
    return true;
  },
  /** The gauge stretches up and settles, like a column filling. */
  gauge(o, t) {
    const T = 0.7;
    if (t >= T) return false;
    o.scale.y *= 1 + 0.35 * swell(t, T);
    return true;
  },
  /** The scroll sways open, like a sheet unrolling. */
  scroll(o, t) {
    const T = 0.8;
    if (t >= T) return false;
    o.rotation.x -= 0.35 * swell(t, T);
    o.scale.y *= 1 + 0.15 * swell(t, T);
    return true;
  },
  /** The stamp lifts, then presses down hard. */
  yes: press,
  no: press,
};

function press(o: Object3D, t: number) {
  const T = 0.6;
  if (t >= T) return false;
  const u = t / T;
  o.position.y += u < 0.5 ? 0.5 * swell(u, 0.5) : -0.25 * swell(u - 0.5, 0.5);
  if (u >= 0.5) o.scale.y *= 1 - 0.25 * swell(u - 0.5, 0.5);
  return true;
}
