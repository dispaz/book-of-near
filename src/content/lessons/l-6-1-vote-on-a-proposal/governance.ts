/**
 * Lesson 6.1's model, pure and unit tested: the House of Stake lock as it works on mainnet (topic 6.1),
 * the example proposal and its tally, and what each clickable object does when picked (rule 10a, the
 * script's Reactions table). No three.js, no network.
 *
 * veNEAR: locking X NEAR gives X veNEAR at once. While it stays locked, extra veNEAR grows linearly at a
 * fixed yearly rate (mainnet `venear.dao`: 50% of the locked NEAR a year), and the House of Stake docs
 * say growth stops at the equivalent of 4 years. There is no lock length to choose. Unlocking any amount
 * forfeits all the extra and starts a 45-day wait (mainnet `unlock_duration_ns`).
 *
 * The proposal is an EXAMPLE written for this lesson (docs/lessons/stage-6/6.1.md, step 4), not a real or
 * live one, and the vote is a practice vote: it changes this page's tally only and sends nothing.
 */
import type { Object3D } from "three";
import { swell } from "../../../scene-kit/reaction";
import { COLORS } from "../../../scene-kit/theme";
import { CHECK, HALL, INSPECT, LOCK, STAKE, VOTE } from "./steps";

export const fmt = (n: number) => n.toLocaleString("en-US");

/** How much NEAR the learner locks in the calculator. */
export const LOCKED = 100;
/** Extra veNEAR per locked NEAR per year on mainnet (`annual_growth_rate_ns` 15,850,000,000,000 / 10^30). */
export const GROWTH_PER_YEAR = 0.5;
/** Days between starting an unlock and taking the NEAR out, on mainnet (`unlock_duration_ns`). */
export const UNLOCK_DAYS = 45;
/** The "time locked" slider, in months: 0 (just locked) to the docs' 4-year cap. */
export const MIN_MONTHS = 0;
export const MAX_MONTHS = 48;
/** The time locked the gauge steps through when it is picked: whole years. */
const PRESETS = [0, 12, 24, 36, 48];

const clampMonths = (m: number) => Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, m));

/** Extra veNEAR after `months` locked: grows linearly, stops at the 4-year cap. */
export const extraVe = (months: number) => Math.round(LOCKED * GROWTH_PER_YEAR * (clampMonths(months) / 12));

/** All the veNEAR for the locked NEAR: 1:1 for the NEAR, plus the extra. */
export const vePower = (months: number) => LOCKED + extraVe(months);

/** The most veNEAR the locked NEAR can reach (at the cap): the gauge's full scale. */
export const MAX_VE = vePower(MAX_MONTHS);

/** Time locked as the learner reads it: "just locked", "1 month", "2 years 6 months". */
export function timeLocked(months: number): string {
  const m = clampMonths(Math.round(months));
  if (m === 0) return "just locked";
  const part = (n: number, w: string) => (n ? `${n} ${w}${n === 1 ? "" : "s"}` : "");
  return [part(Math.floor(m / 12), "year"), part(m % 12, "month")].filter(Boolean).join(" ");
}

/** "just locked" or "locked for 2 years". */
const lockedFor = (months: number) =>
  clampMonths(months) === 0 ? "just locked" : `locked for ${timeLocked(months)}`;

/** "100 veNEAR + 50 extra = 150 veNEAR", or "100 veNEAR" with no extra yet. */
export function breakdown(months: number): string {
  const extra = extraVe(months);
  return extra > 0
    ? `${LOCKED} veNEAR + ${fmt(extra)} extra = ${fmt(vePower(months))} veNEAR`
    : `${LOCKED} veNEAR`;
}

/** What starting an unlock now would cost. */
export function unlockCost(months: number): string {
  const extra = extraVe(months);
  const lose = extra > 0 ? `the ${fmt(extra)} extra veNEAR is gone, ` : "";
  return `Unlock now: ${lose}your ${LOCKED} NEAR stops counting and waits ${UNLOCK_DAYS} days before you can take it out.`;
}

/** The next time locked when the gauge is picked: the next whole year, back to 0 after 4 years. */
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
    /** The quorum bar's yes and no lengths, as fractions of the quorum (the bar's full length). */
    yesBar: yes / PROPOSAL.quorum,
    noBar: no / PROPOSAL.quorum,
  };
}

/** The shared state both views draw. */
export type GovState = {
  step: number;
  /** How long the learner's 100 NEAR has been locked, in months (the step 3 slider). */
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

export function reactionFor(what: Obj, s: GovState): Reaction {
  const t = tally(s.ballot);
  switch (what) {
    case "pool":
      return {
        detail:
          "Example: 50 NEAR delegated to a validator's pool. Unstaking takes 4 epochs, a little over a day.",
      };
    case "gauge":
      if (s.step < LOCK) return { hint: "Not yet: you set a lock on step 3." };
      if (s.step === LOCK) return { act: "lock" };
      return {
        detail: `${LOCKED} NEAR ${lockedFor(s.months)}: ${breakdown(s.months)}. Unlocking loses the extra.`,
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
export function describe(s: GovState): string {
  const t = tally(s.ballot);
  switch (s.step) {
    case HALL:
      return "A town hall on the page: a staking pool's mailbox, a veNEAR gauge, a proposal scroll and two ballot stamps, YES and NO.";
    case STAKE:
      return "The staking pool's mailbox: delegated NEAR sits in the pool's contract, and unstaking takes 4 epochs, a little over a day.";
    case LOCK:
      return `The veNEAR gauge: ${LOCKED} NEAR ${lockedFor(s.months)} gives ${breakdown(s.months)}. ${unlockCost(s.months)}`;
    case INSPECT:
      return s.reviewed
        ? `Proposal #${PROPOSAL.id}, an example, is unrolled: it asks for ${PROPOSAL.ask}. ${t.yesPct}% yes, ${t.noPct}% no.`
        : `Proposal #${PROPOSAL.id}, an example, is rolled up on the page. Read it to unroll it.`;
    case VOTE:
      return s.ballot
        ? `Your practice vote is stamped ${s.ballot.choice.toUpperCase()}: ${t.yesPct}% yes, ${t.noPct}% no, ${t.quorumPct}% of quorum.`
        : `Two ballot stamps, YES and NO, wait by the proposal. ${t.quorumPct}% of quorum so far.`;
    default:
      return s.step >= CHECK ? "The whole town hall, with your practice vote on the proposal." : "";
  }
}

/** A ballot stamp's colours (both views): full ink once it is your vote, a tint before. */
export const stampColors = (c: Choice) =>
  c === "yes" ? { ink: COLORS.green, tint: COLORS.greenTint } : { ink: COLORS.red, tint: COLORS.redTint };

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
