import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHECK, INSPECT, LOCK, VOTE } from "./steps";
import { useGovernance } from "./useGovernance";

afterEach(cleanup);

function mount(step: number) {
  const setGate = vi.fn();
  const reportEvidence = vi.fn();
  const view = renderHook(({ s }: { s: number }) => useGovernance({ step: s, setGate, reportEvidence }), {
    initialProps: { s: step },
  });
  return { view, setGate, reportEvidence };
}

describe("lesson 6.1's shared state", () => {
  it("opens the lock step's gate once the learner sets a lock, by slider or by gauge", () => {
    const { view, setGate } = mount(LOCK);
    expect(setGate).toHaveBeenLastCalledWith(false);
    act(() => view.result.current.pick("gauge"));
    expect(view.result.current.months).toBe(12);
    expect(setGate).toHaveBeenLastCalledWith(true);
    act(() => view.result.current.setMonths(48));
    expect(view.result.current.months).toBe(48);
    act(() => view.result.current.setMonths(99));
    expect(view.result.current.months).toBe(48);
  });

  it("a pick too early notes the hint and does nothing", () => {
    const { view } = mount(LOCK);
    act(() => view.result.current.pick("yes"));
    expect(view.result.current.ballot).toBeNull();
    expect(view.result.current.notYet("yes")).toBe(true);
    expect(view.result.current.picked?.result.hint).toBe("Inspect the proposal first.");
  });

  it("reading the proposal opens step 4's gate", () => {
    const { view, setGate } = mount(INSPECT);
    act(() => view.result.current.pick("scroll"));
    expect(view.result.current.reviewed).toBe(true);
    expect(setGate).toHaveBeenLastCalledWith(true);
  });

  it("a vote counts with the learner's veNEAR, once, and is recorded as a practice vote", () => {
    const { view, setGate, reportEvidence } = mount(LOCK);
    act(() => view.result.current.setMonths(48));
    view.rerender({ s: INSPECT });
    act(() => view.result.current.review());
    view.rerender({ s: VOTE });
    act(() => view.result.current.vote("yes"));
    act(() => view.result.current.vote("no"));
    expect(view.result.current.ballot).toEqual({ choice: "yes", power: 300 });
    expect(setGate).toHaveBeenLastCalledWith(true);
    expect(reportEvidence).toHaveBeenCalledTimes(1);
    expect(reportEvidence).toHaveBeenCalledWith(expect.objectContaining({ kind: "practice", power: "300" }));
  });

  it("opened at a later step, fills in the earlier ones without recording a vote", () => {
    const { view, reportEvidence } = mount(CHECK);
    expect(view.result.current.locked).toBe(true);
    expect(view.result.current.reviewed).toBe(true);
    expect(reportEvidence).not.toHaveBeenCalled();
  });
});
