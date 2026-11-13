import { describe, expect, it } from "vitest";
import {
  describe as describeScene,
  evidenceFor,
  LOCKED,
  multiplier,
  nextPreset,
  PROPOSAL,
  reactionFor,
  tally,
  vePower,
  type Ballot,
  type Gov,
} from "./governance";
import { HALL, INSPECT, LOCK, STAKE, VOTE } from "./steps";

const base: Gov = { step: HALL, months: 1, locked: false, reviewed: false, ballot: null };

describe("the veNEAR model (script step 3)", () => {
  it("scales the multiplier from 1x at 1 month to 4x at 48 months", () => {
    expect(multiplier(1)).toBe(1);
    expect(multiplier(48)).toBe(4);
    expect(multiplier(24.5)).toBeCloseTo(2.5);
  });

  it("only grows with a longer lock, and clamps to 1 to 48 months", () => {
    for (let m = 2; m <= 48; m++) expect(multiplier(m)).toBeGreaterThan(multiplier(m - 1));
    expect(multiplier(0)).toBe(1);
    expect(multiplier(99)).toBe(4);
  });

  it("gives 100 locked NEAR for 48 months 400 veNEAR", () => {
    expect(LOCKED).toBe(100);
    expect(vePower(48)).toBe(400);
    expect(vePower(1)).toBe(100);
  });

  it("steps the gauge through a few lock lengths and wraps around", () => {
    expect(nextPreset(1)).toBe(12);
    expect(nextPreset(12)).toBe(24);
    expect(nextPreset(30)).toBe(36);
    expect(nextPreset(48)).toBe(1);
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
    expect(after.detail).toBe("100 NEAR locked for 48 months: 400 veNEAR (4×).");
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
    expect(describeScene({ ...base, step: LOCK, months: 48 })).toMatch(/4×/);
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
