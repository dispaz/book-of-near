import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCOUNTS, CHECK, LIQUIDITY, MYTH, SCALING } from "./steps";
import { useScoreboard } from "./useScoreboard";

afterEach(cleanup);

function mount(step: number) {
  const setGate = vi.fn();
  const reportEvidence = vi.fn();
  const view = renderHook(({ s }: { s: number }) => useScoreboard({ step: s, setGate, reportEvidence }), {
    initialProps: { s: step },
  });
  return { view, setGate, reportEvidence };
}

describe("lesson 7.2's shared state", () => {
  it("starts level, with no card open", () => {
    const { view } = mount(MYTH);
    expect(view.result.current.state).toBe("dim:none;explored:");
  });

  it("keeps the step's gate shut until its card is opened", () => {
    const { view, setGate } = mount(ACCOUNTS);
    expect(setGate).toHaveBeenLastCalledWith(false);
    act(() => view.result.current.open("accounts"));
    expect(setGate).toHaveBeenLastCalledWith(true);
    expect(view.result.current.state).toBe("dim:accounts;explored:accounts");
  });

  it("a pick of the step's card opens it; a later card says not yet and opens nothing", () => {
    const { view } = mount(SCALING);
    act(() => view.result.current.pick({ kind: "card", dim: "liquidity" }));
    expect(view.result.current.picked?.reaction.hint).toMatch(/Not yet/);
    expect(view.result.current.state).toBe("dim:none;explored:accounts");
    act(() => view.result.current.pick({ kind: "card", dim: "scaling" }));
    expect(view.result.current.state).toBe("dim:scaling;explored:accounts,scaling");
  });

  it("opened at a later step, fills in the earlier cards but reports nothing", () => {
    const { view, reportEvidence } = mount(CHECK);
    expect(view.result.current.state).toBe("dim:liquidity;explored:accounts,scaling,execution,liquidity");
    expect(reportEvidence).not.toHaveBeenCalled();
  });

  it("reports the completion evidence once the learner opens the last card", () => {
    const { view, reportEvidence } = mount(LIQUIDITY);
    act(() => view.result.current.open("liquidity"));
    expect(reportEvidence).toHaveBeenCalledWith({ scoreboardReviewed: "true", recordedOn: "13 Nov 2026" });
  });
});
