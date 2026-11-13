import { describe, expect, it } from "vitest";
import {
  breakdown,
  describe as describeScene,
  evidenceFor,
  extraVe,
  GROWTH_PER_YEAR,
  LOCKED,
  MAX_VE,
  nextPreset,
  PROPOSAL,
  reactionFor,
  stampColors,
  tally,
  timeLocked,
  UNLOCK_DAYS,
  unlockCost,
  vePower,
  type Ballot,
  type GovState,
} from "./governance";
import { HALL, INSPECT, LOCK, STAKE, VOTE } from "./steps";

const base: GovState = { step: HALL, months: 0, locked: false, reviewed: false, ballot: null };

describe("the House of Stake veNEAR model (topic 6.1, mainnet settings)", () => {
  it("uses mainnet's settings: 50% a year extra growth and a 45-day unlock wait", () => {
    expect(GROWTH_PER_YEAR).toBe(0.5);
    expect(UNLOCK_DAYS).toBe(45);
  });

  it("gives locked NEAR 1:1 veNEAR at once, with no extra yet", () => {
    expect(LOCKED).toBe(100);
    expect(extraVe(0)).toBe(0);
    expect(vePower(0)).toBe(100);
  });

  it("grows the extra linearly with time locked: +50 a year on 100 NEAR", () => {
    expect(extraVe(6)).toBe(25);
    expect(vePower(12)).toBe(150);
    expect(vePower(24)).toBe(200);
    for (let m = 1; m <= 48; m++) expect(vePower(m)).toBeGreaterThan(vePower(m - 1));
  });

  it("stops growing at the docs' 4-year cap: 300 veNEAR at most", () => {
    expect(vePower(48)).toBe(300);
    expect(vePower(99)).toBe(300);
    expect(MAX_VE).toBe(300);
    expect(vePower(-3)).toBe(100);
  });

  it("says what unlocking costs: the extra is forfeited and the NEAR waits 45 days", () => {
    expect(unlockCost(24)).toBe(
      "Unlock now: the 100 extra veNEAR is gone, your 100 NEAR stops counting and waits 45 days before you can take it out.",
    );
    expect(unlockCost(0)).toBe(
      "Unlock now: your 100 NEAR stops counting and waits 45 days before you can take it out.",
    );
  });

  it("reads time locked and the veNEAR sum in plain words", () => {
    expect(timeLocked(0)).toBe("just locked");
    expect(timeLocked(1)).toBe("1 month");
    expect(timeLocked(30)).toBe("2 years 6 months");
    expect(timeLocked(48)).toBe("4 years");
    expect(breakdown(0)).toBe("100 veNEAR");
    expect(breakdown(12)).toBe("100 veNEAR + 50 extra = 150 veNEAR");
  });

  it("steps the gauge a year at a time and wraps back to just locked", () => {
    expect(nextPreset(0)).toBe(12);
    expect(nextPreset(12)).toBe(24);
    expect(nextPreset(30)).toBe(36);
    expect(nextPreset(48)).toBe(0);
  });
});

describe("the ballot stamps' colours", () => {
  it("gives YES and NO their own ink and tint, shared by both views", () => {
    expect(stampColors("yes").ink).not.toBe(stampColors("no").ink);
    expect(stampColors("yes").tint).not.toBe(stampColors("yes").ink);
  });
});

describe("the example proposal's tally", () => {
  it("starts at 62% yes, 38% no, short of a 500,000 veNEAR quorum", () => {
    const t = tally(null);
    expect(PROPOSAL.id).toBe(42);
    expect(t.yesPct).toBe(62);
    expect(t.noPct).toBe(38);
    expect(t.total).toBe(300_000);
    expect(t.quorum).toBe(500_000);
    expect(t.quorumPct).toBe(60);
    expect(t.reached).toBe(false);
    expect(t.yesBar).toBeCloseTo(0.372);
    expect(t.noBar).toBeCloseTo(0.228);
  });

  it("adds your weighted vote to the side you picked", () => {
    const yes = tally({ choice: "yes", power: 400 });
    expect(yes.yes).toBe(186_400);
    expect(yes.no).toBe(114_000);
    expect(yes.total).toBe(300_400);
    const no = tally({ choice: "no", power: 100 });
    expect(no.no).toBe(114_100);
    expect(no.quorumPct).toBeCloseTo(60.02, 2);
  });
});

describe("reactions (rule 10a, the script's Reactions table)", () => {
  it("the staking mailbox always shows its detail", () => {
    for (const step of [HALL, STAKE, VOTE])
      expect(reactionFor("pool", { ...base, step }).detail).toMatch(/4 epochs/);
  });

  it("the gauge says not yet before step 3, sets a lock on step 3, then shows its detail", () => {
    expect(reactionFor("gauge", base).hint).toMatch(/^Not yet/);
    expect(reactionFor("gauge", { ...base, step: LOCK }).act).toBe("lock");
    const after = reactionFor("gauge", { ...base, step: INSPECT, months: 48, locked: true });
    expect(after.detail).toBe(
      "100 NEAR locked for 4 years: 100 veNEAR + 200 extra = 300 veNEAR. Unlocking loses the extra.",
    );
  });

  it("the proposal scroll is read on step 4, then shows the tally", () => {
    expect(reactionFor("scroll", { ...base, step: LOCK }).hint).toMatch(/^Not yet/);
    expect(reactionFor("scroll", { ...base, step: INSPECT }).act).toBe("review");
    expect(reactionFor("scroll", { ...base, step: INSPECT, reviewed: true }).detail).toMatch(
      /62% yes, 38% no/,
    );
  });

  it("the ballot stamps ask for the proposal first, vote on step 5, then show the vote", () => {
    expect(reactionFor("yes", { ...base, step: INSPECT }).hint).toBe("Inspect the proposal first.");
    expect(reactionFor("no", { ...base, step: INSPECT, reviewed: true }).hint).toMatch(/^Not yet/);
    expect(reactionFor("yes", { ...base, step: VOTE, reviewed: true }).act).toBe("vote");
    const ballot: Ballot = { choice: "yes", power: 400 };
    const voted = { ...base, step: VOTE, reviewed: true, ballot };
    expect(reactionFor("yes", voted).detail).toMatch(/\+400 veNEAR YES/);
    expect(reactionFor("yes", voted).detail).toMatch(/practice vote/i);
    expect(reactionFor("no", voted).detail).toMatch(/You voted YES/);
  });
});

describe("what the scene says and records", () => {
  it("describes the scene for screen readers at each step", () => {
    expect(describeScene({ ...base, step: VOTE, reviewed: true })).toMatch(/stamp/i);
    expect(describeScene({ ...base, step: LOCK, months: 48 })).toMatch(/300 veNEAR.*45 days/);
    expect(describeScene({ ...base, step: VOTE, reviewed: true })).toMatch(/60% of quorum/);
    expect(describeScene({ ...base, step: VOTE })).not.toMatch(/reached/);
  });

  it("records a practice vote as evidence, never as an on-chain one", () => {
    expect(evidenceFor({ choice: "no", power: 250 })).toEqual({
      proposalId: "42",
      voteCast: "true",
      choice: "no",
      power: "250",
      kind: "practice",
    });
  });
});
