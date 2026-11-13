import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHECK, DOLLARS, FLOWS, ORACLE, SWAP } from "./steps";
import { useMoneyMap } from "./useMoneyMap";

afterEach(cleanup);

function mount(step: number) {
  const setGate = vi.fn();
  const reportEvidence = vi.fn();
  const view = renderHook(({ s }: { s: number }) => useMoneyMap({ step: s, setGate, reportEvidence }), {
    initialProps: { s: step },
  });
  return { view, setGate, reportEvidence };
}

describe("lesson 6.2's shared state", () => {
  it("opens step 2's gate once the two USDCs are compared, by button or by mailbox", () => {
    const { view, setGate } = mount(DOLLARS);
    expect(setGate).toHaveBeenLastCalledWith(false);
    act(() => view.result.current.pick("usdc"));
    expect(view.result.current.compared).toBe(true);
    expect(setGate).toHaveBeenLastCalledWith(true);
  });

  it("a pool picked before the oracle is read says so and trades nothing", () => {
    const { view } = mount(ORACLE);
    act(() => view.result.current.pick("stable"));
    expect(view.result.current.trade).toBeNull();
    expect(view.result.current.notYet("stable")).toBe(true);
    expect(view.result.current.picked?.result.hint).toBe("Read the oracle first.");
    act(() => view.result.current.pick("oracle"));
    expect(view.result.current.oracleRead).toBe(true);
  });

  it("each pool pick tries the next size; the gate opens and the record is written at 100,000, once", () => {
    const { view, setGate, reportEvidence } = mount(SWAP);
    act(() => view.result.current.pick("simple"));
    expect(view.result.current.trade).toBe(100);
    expect(setGate).toHaveBeenLastCalledWith(false);
    act(() => view.result.current.pick("stable"));
    act(() => view.result.current.pick("simple"));
    expect(view.result.current.trade).toBe(100_000);
    expect(setGate).toHaveBeenLastCalledWith(true);
    act(() => view.result.current.tradeSize(100));
    act(() => view.result.current.tradeSize(100_000));
    expect(reportEvidence).toHaveBeenCalledTimes(1);
    expect(reportEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ pair: "USDC/USDt", kind: "recorded" }),
    );
    expect(setGate).toHaveBeenLastCalledWith(true);
  });

  it("the intents area shows the flows on step 5", () => {
    const { view } = mount(FLOWS);
    act(() => view.result.current.pick("intents"));
    expect(view.result.current.flows).toBe(true);
  });

  it("opened at a later step, fills in the earlier ones without writing a record", () => {
    const { view, reportEvidence } = mount(CHECK);
    expect(view.result.current.compared).toBe(true);
    expect(view.result.current.oracleRead).toBe(true);
    expect(view.result.current.trade).toBe(100_000);
    expect(view.result.current.flows).toBe(true);
    expect(reportEvidence).not.toHaveBeenCalled();
  });
});
