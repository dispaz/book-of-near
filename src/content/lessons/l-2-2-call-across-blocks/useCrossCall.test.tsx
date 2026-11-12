import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainProvider } from "../../../chain/ChainContext";
import { DemoChain } from "../../../chain/DemoChain";
import { formatTgas } from "../../../chain/units";
import { RECORDED } from "./recorded";
import { ORDER_COPY } from "./steps";
import { GAS, ORDER, ORDER_GAS, useCrossCall } from "./useCrossCall";

afterEach(() => cleanup());

function mount(chain: DemoChain, step: number) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ChainProvider chain={chain}>{children}</ChainProvider>
  );
  const setVars = vi.fn();
  return renderHook(
    ({ s }: { s: number }) => useCrossCall({ step: s, setGate: () => {}, setVars, reducedMotion: false }),
    { wrapper, initialProps: { s: step } },
  );
}

describe("lesson 2.2's shared call state", () => {
  it("plays the hops when the order lands on the order step", async () => {
    const view = mount(new DemoChain({ slowdown: 0.05 }), ORDER);
    act(() => view.result.current.order());
    await waitFor(() => expect(view.result.current.call).not.toBeNull());
    expect(view.result.current.revealed).toBeLessThan(view.result.current.hops.length);
  });

  it("shows the order whole when the page turned while it was still being sent", async () => {
    const view = mount(new DemoChain({ slowdown: 0.05 }), ORDER);
    act(() => view.result.current.order());
    expect(view.result.current.busy).toBe("order");
    view.rerender({ s: GAS });
    await waitFor(() => expect(view.result.current.call).not.toBeNull());
    // No replay of the hops on the gas step: the call is drawn whole at once.
    expect(view.result.current.complete).toBe(true);
    expect(view.result.current.state).toMatch(/hops:3\/3/);
  });

  it("in testnet mode, step 3's words describe the recorded call, not a 30 Tgas order", async () => {
    const chain = new DemoChain({ pace: "instant" });
    Object.defineProperty(chain, "network", { value: "testnet" });
    const setVars = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChainProvider chain={chain}>{children}</ChainProvider>
    );
    const view = renderHook(
      () => useCrossCall({ step: ORDER, setGate: () => {}, setVars, reducedMotion: true }),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(setVars).toHaveBeenCalledWith(ORDER_COPY.testnet));
    expect(ORDER_COPY.testnet.orderIntro).toContain(`${formatTgas(RECORDED.attachedGas, 0)} Tgas`);
    expect(ORDER_COPY.testnet.orderIntro).not.toMatch(/30 Tgas|shop/);
    act(() => view.result.current.order());
    await waitFor(() => expect(view.result.current.call?.source).toBe("recorded"));
  });

  it("in demo mode, step 3's words match the order it sends", () => {
    expect(ORDER_COPY.demo.orderIntro).toContain(`${formatTgas(ORDER_GAS, 0)} Tgas`);
  });
});
