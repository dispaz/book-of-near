import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainProvider } from "../../../chain/ChainContext";
import { DemoChain } from "../../../chain/DemoChain";
import { CHECK, CONTRACT, SETTLE } from "./steps";
import { useCapstone } from "./useCapstone";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(step: number, reducedMotion = false) {
  const chain = new DemoChain({ pace: "instant" });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ChainProvider chain={chain}>{children}</ChainProvider>
  );
  const reportEvidence = vi.fn();
  const view = renderHook(
    ({ s }: { s: number }) =>
      useCapstone({ step: s, setGate: () => {}, setVars: () => {}, reportEvidence, reducedMotion }),
    { wrapper, initialProps: { s: step } },
  );
  return { view, reportEvidence };
}

describe("lesson 7.1's shared state", () => {
  it("opened past the settlement, fills the view but reports no completion evidence", () => {
    const { view, reportEvidence } = mount(CHECK);
    expect(view.result.current.settle).toBe("done");
    expect(reportEvidence).not.toHaveBeenCalled();
  });

  it("reports the completion evidence once the learner verifies the settlement", () => {
    const { view, reportEvidence } = mount(SETTLE, true);
    expect(reportEvidence).not.toHaveBeenCalled();
    act(() => view.result.current.verify());
    expect(view.result.current.settle).toBe("done");
    expect(reportEvidence).toHaveBeenCalledTimes(1);
    expect(reportEvidence.mock.calls[0]![0]).toMatchObject({ capstoneComplete: "true" });
  });

  it("plays the settlement as solver then done, with no signing phase", () => {
    vi.useFakeTimers();
    const { view } = mount(SETTLE);
    const seen: string[] = [];
    act(() => view.result.current.verify());
    for (let t = 0; t < 40; t++) {
      act(() => void vi.advanceTimersByTime(100));
      const s = view.result.current.settle;
      if (seen.at(-1) !== s) seen.push(s);
    }
    expect(seen).toEqual(["solver", "done"]);
  });

  it("a repeat verifier pick does not cut the gear's turn short", () => {
    vi.useFakeTimers();
    const { view } = mount(CONTRACT);
    expect(view.result.current.running).toBe(true);
    act(() => void vi.advanceTimersByTime(2000));
    act(() => view.result.current.pick("verifier"));
    act(() => void vi.advanceTimersByTime(1000));
    expect(view.result.current.running).toBe(true);
    act(() => void vi.advanceTimersByTime(2000));
    expect(view.result.current.running).toBe(false);
  });
});
