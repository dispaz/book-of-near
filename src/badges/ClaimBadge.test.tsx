import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chain } from "../chain/types";
import { ClaimBadge } from "./ClaimBadge";

// A testnet chain whose badge reads are counted per stage.
const held = new Set<number>();
const reads: Record<number, number> = {};
let lagging = false;
const chain = {
  network: "testnet",
  practiceAccount: async () => ({ accountId: "learner.testnet" }),
  hasBadge: vi.fn(async (_id: string, stage: number) => {
    reads[stage] = (reads[stage] ?? 0) + 1;
    return !lagging && held.has(stage);
  }),
  badgeContractId: async () => "badges.testnet",
} as unknown as Chain;

// The chain the app hands out now: ChainProvider can swap it (demo first, then testnet).
let current: Chain = chain;
vi.mock("../chain/ChainContext", () => ({ useChain: () => current }));
vi.mock("../progress", () => {
  const state = { completions: [] }; // one array, as the real store keeps between renders
  return { useProgress: () => state };
});
vi.mock("./BadgeShelf", () => ({ BadgeArt: () => null }));
vi.mock("./rules", () => ({
  ruleFor: () => ({}),
  claimReadiness: () => ({ ready: true, missing: [] }),
}));
vi.mock("./claimFlow", () => ({
  claimStageBadge: vi.fn(async (_c: Chain, stage: number) => {
    held.add(stage);
    return { ok: true, tokenId: `tok-${stage}`, txHash: "tx" };
  }),
}));

/** Badge reads made for a card's own stage (each check reads its own stage first). */
const checksOf = (stage: number) => reads[stage] ?? 0;

function renderCards(stages: number[]) {
  render(
    <MemoryRouter>
      {stages.map((s) => (
        <ClaimBadge key={s} stage={s} />
      ))}
    </MemoryRouter>,
  );
}

const card = (stage: number) => screen.getByRole("region", { name: `Stage ${stage} badge` });

beforeEach(() => {
  held.clear();
  held.add(0);
  for (const k of Object.keys(reads)) delete reads[Number(k)];
  lagging = false;
  current = chain;
});
afterEach(cleanup);

describe("ClaimBadge after a claim", () => {
  it("only the next stage's card checks again, and the claiming card does not re-check itself", async () => {
    renderCards([1, 2, 3]);
    await waitFor(() => expect(card(1)).toHaveAttribute("data-claim-state", "ready"));
    await waitFor(() => expect(card(2)).toHaveAttribute("data-claim-state", "not-yet"));
    await waitFor(() => expect(card(3)).toHaveAttribute("data-claim-state", "not-yet"));
    // A card's check reads its own stage and, if not held, the stage before. So stage 0 is read only by
    // card 1's check, stage 2 only by card 2's, stage 3 only by card 3's.
    const before = { card1: checksOf(0), card2: checksOf(2), card3: checksOf(3) };

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Claim the stage 1 badge" }));
    });
    await waitFor(() => expect(card(2)).toHaveAttribute("data-claim-state", "ready"));

    expect(card(1)).toHaveAttribute("data-claim-state", "claimed");
    expect(checksOf(2)).toBe(before.card2 + 1);
    expect(checksOf(0)).toBe(before.card1);
    expect(checksOf(3)).toBe(before.card3);
    expect(card(3)).toHaveAttribute("data-claim-state", "not-yet");
  });

  it("a claimed card stays claimed, with its explorer link, when a later check says no badge", async () => {
    renderCards([1]);
    await waitFor(() => expect(card(1)).toHaveAttribute("data-claim-state", "ready"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Claim the stage 1 badge" }));
    });
    const link = await screen.findByRole("link", { name: "See it on the testnet explorer" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/badges.testnet/tok-1"));

    // A lagging RPC node: the badge is not there yet. A check that runs now (the stage 0 badge was
    // claimed elsewhere, say) must not undo the claim.
    lagging = true;
    const n = checksOf(0);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("bon:badge-claimed", { detail: { stage: 0 } }));
    });
    await waitFor(() => expect(checksOf(0)).toBeGreaterThan(n));
    await act(async () => {});
    expect(card(1)).toHaveAttribute("data-claim-state", "claimed");
    expect(screen.getByRole("link", { name: "See it on the testnet explorer" })).toHaveAttribute(
      "href",
      expect.stringContaining("/tok-1"),
    );

    // And a check that finds the badge keeps the tokenId too.
    lagging = false;
    const m = checksOf(1);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("bon:badge-claimed", { detail: { stage: 0 } }));
    });
    await waitFor(() => expect(checksOf(1)).toBeGreaterThan(m));
    await act(async () => {});
    expect(card(1)).toHaveAttribute("data-claim-state", "claimed");
    expect(screen.getByRole("link", { name: "See it on the testnet explorer" })).toHaveAttribute(
      "href",
      expect.stringContaining("/tok-1"),
    );
  });

  it("a claimed card checks again when the chain swaps to one without the badge", async () => {
    // A testnet load with demo badges in this browser: the demo chain comes first and holds stage 1.
    held.add(1);
    const testnetNoBadge = {
      ...chain,
      hasBadge: async (_id: string, s: number) => s === 0,
    } as unknown as Chain;
    const { rerender } = render(
      <MemoryRouter>
        <ClaimBadge stage={1} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(card(1)).toHaveAttribute("data-claim-state", "claimed"));

    current = testnetNoBadge;
    rerender(
      <MemoryRouter>
        <ClaimBadge stage={1} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(card(1)).toHaveAttribute("data-claim-state", "ready"));
  });
});
