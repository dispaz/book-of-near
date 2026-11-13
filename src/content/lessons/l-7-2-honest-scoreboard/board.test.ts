import { describe, expect, it } from "vitest";
import {
  CELLS,
  CHAINS,
  DIMS,
  dimForStep,
  exploredBy,
  pillarHeight,
  reaction,
  RECORDED_ON,
  SOURCES,
  stateOf,
  verdictOf,
} from "./board";
import { ACCOUNTS, CHECK, EXECUTION, HONEST, LIQUIDITY, MYTH, SCALING } from "./steps";

const none = new Set<never>();

describe("the scoreboard data", () => {
  it("compares four chains on four dimensions, one dimension per step", () => {
    expect(CHAINS.map((c) => c.id)).toEqual(["near", "ethereum", "solana", "cosmos"]);
    expect(DIMS.map((d) => [d.id, d.step])).toEqual([
      ["accounts", ACCOUNTS],
      ["scaling", SCALING],
      ["execution", EXECUTION],
      ["liquidity", LIQUIDITY],
    ]);
    expect(RECORDED_ON).toBe("13 Nov 2026");
  });

  it("gives every cell a note and a source tag, and never a made-up score", () => {
    for (const d of DIMS)
      for (const c of CHAINS) {
        const cell = CELLS[d.id][c.id];
        expect(cell.note.length).toBeGreaterThan(10);
        expect(cell.note).not.toMatch(/\/10\b/);
        if (cell.verdict !== "not compared") expect(SOURCES[cell.source!]?.url).toMatch(/^https:\/\//);
      }
  });

  it("is honest about who leads: NEAR on accounts, Solana on raw speed, Ethereum on liquidity", () => {
    expect(verdictOf("accounts", "near")).toBe("leads");
    expect(verdictOf("execution", "solana")).toBe("leads");
    expect(verdictOf("execution", "near")).toBe("trade-off");
    expect(verdictOf("liquidity", "ethereum")).toBe("leads");
    expect(verdictOf("liquidity", "near")).toBe("trails");
    // Exactly one leader per dimension.
    for (const d of DIMS) expect(CHAINS.filter((c) => verdictOf(d.id, c.id) === "leads")).toHaveLength(1);
  });

  it("does not teach the 30% gas rebate (removed in protocol version 87)", () => {
    const all = JSON.stringify(CELLS) + JSON.stringify(CHAINS);
    expect(all).not.toMatch(/30%|rebate/);
  });
});

describe("dimForStep and exploredBy", () => {
  it("maps each comparison step to its dimension and the others to none", () => {
    expect(dimForStep(MYTH)).toBeNull();
    expect(dimForStep(SCALING)).toBe("scaling");
    expect(dimForStep(CHECK)).toBeNull();
  });

  it("counts every dimension before the step as explored (a page opened at a later step)", () => {
    expect([...exploredBy(MYTH)]).toEqual([]);
    expect([...exploredBy(EXECUTION)]).toEqual(["accounts", "scaling"]);
    expect([...exploredBy(HONEST)]).toEqual(["accounts", "scaling", "execution", "liquidity"]);
  });
});

describe("pillarHeight", () => {
  it("is level for every chain until a dimension is open: no perfect blockchain", () => {
    const h = CHAINS.map((c) => pillarHeight(c.id, null));
    expect(new Set(h).size).toBe(1);
  });

  it("is tallest for the leader and lowest for a chain that trails", () => {
    expect(pillarHeight("ethereum", "liquidity")).toBeGreaterThan(pillarHeight("solana", "liquidity"));
    expect(pillarHeight("solana", "liquidity")).toBeGreaterThan(pillarHeight("near", "liquidity"));
  });
});

describe("reaction: what a pick does (rule 10a)", () => {
  it("the step's own card opens its dimension", () => {
    expect(reaction({ kind: "card", dim: "accounts" }, { step: ACCOUNTS, explored: none })).toEqual({
      act: "accounts",
    });
  });

  it("a card for a later step says not yet", () => {
    const r = reaction({ kind: "card", dim: "liquidity" }, { step: ACCOUNTS, explored: none });
    expect(r.act).toBeUndefined();
    expect(r.hint).toBe("Not yet: this card opens at step 5.");
  });

  it("an explored card opens again and shows its detail", () => {
    const r = reaction({ kind: "card", dim: "accounts" }, { step: SCALING, explored: new Set(["accounts"]) });
    expect(r.act).toBe("accounts");
    expect(r.detail).toMatch(/NEAR leads/);
  });

  it("a pillar says not yet while the step's card is closed, and gives its note after", () => {
    const pillar = { kind: "pillar", chain: "near" } as const;
    expect(reaction(pillar, { step: SCALING, explored: new Set(["accounts"]) }).hint).toBe(
      "Open the Scalability card first.",
    );
    const r = reaction(pillar, { step: SCALING, explored: new Set(["accounts", "scaling"]) });
    expect(r.detail).toBe(`NEAR, scalability: ${CELLS.scaling.near.note}`);
  });

  it("a pillar shows the chain's core idea and trade-off on the first page and after the board", () => {
    const pillar = { kind: "pillar", chain: "solana" } as const;
    expect(reaction(pillar, { step: MYTH, explored: none }).detail).toMatch(/^Solana: .*Trade-off: /);
    expect(reaction(pillar, { step: CHECK, explored: exploredBy(CHECK) }).detail).toMatch(/^Solana: /);
  });
});

describe("stateOf", () => {
  it("names the open dimension and what is explored, for tests and screen readers", () => {
    expect(stateOf({ step: SCALING, active: "scaling", explored: new Set(["accounts", "scaling"]) })).toBe(
      "dim:scaling;explored:accounts,scaling",
    );
    expect(stateOf({ step: MYTH, active: null, explored: none })).toBe("dim:none;explored:");
  });
});
