import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainProvider } from "../../../chain/ChainContext";
import { DemoChain } from "../../../chain/DemoChain";
import type { RpcEndpointId } from "../../../chain/rpcEndpoints";
import type { BlockRef, ProbeOptions, RpcProbe } from "../../../chain/types";
import { FAILOVER, RACE, useRace } from "./useRace";

afterEach(() => cleanup());

/** A chain whose RPC probes all fail until `heal()` is called (testnet with no network). */
function flakyChain() {
  const chain = new DemoChain({ pace: "instant" });
  const real = chain.probeRpc.bind(chain);
  let healed = false;
  const calls: (ProbeOptions | undefined)[] = [];
  chain.probeRpc = (id: RpcEndpointId, ref?: BlockRef, options?: ProbeOptions): Promise<RpcProbe> => {
    calls.push(options);
    if (healed) return real(id, ref, { ...options, pace: "instant" });
    return Promise.resolve({
      ok: false,
      endpointId: id,
      latencyMs: 8000,
      error: "Unavailable",
      message: "No answer: the node could not be reached or took too long.",
    });
  };
  return { chain, heal: () => (healed = true), calls };
}

function mount(chain: DemoChain, step: number) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ChainProvider chain={chain}>{children}</ChainProvider>
  );
  const setGate = vi.fn();
  const view = renderHook(
    ({ s }: { s: number }) => useRace({ step: s, setGate, setVars: () => {}, reducedMotion: true }),
    { wrapper, initialProps: { s: step } },
  );
  return { view, setGate };
}

describe("lesson 3.3's shared race state", () => {
  it("lets the learner retry a race where every node failed, with a plain message", async () => {
    const { chain, heal } = flakyChain();
    const { view, setGate } = mount(chain, RACE);
    act(() => view.result.current.race());
    await waitFor(() => expect(view.result.current.raced).not.toBeNull());
    expect(view.result.current.raced?.winner).toBeNull();
    expect(view.result.current.canRetry).toBe(true);
    expect(view.result.current.error).toMatch(/No provider answered/);
    expect(setGate).toHaveBeenLastCalledWith(false);

    heal();
    act(() => view.result.current.race());
    await waitFor(() => expect(view.result.current.raced?.winner).toBeTruthy());
    expect(view.result.current.canRetry).toBe(false);
    expect(view.result.current.error).toBeNull();
    expect(setGate).toHaveBeenLastCalledWith(true);
  });

  it("lets the learner retry a failover where every provider failed, and opens the gate once one answers", async () => {
    const { chain, heal } = flakyChain();
    const { view, setGate } = mount(chain, FAILOVER);
    // Arriving at the failover step runs the race and switches FastNEAR off.
    await waitFor(() => expect(view.result.current.blocked).toBe(true));
    act(() => view.result.current.failover());
    await waitFor(() => expect(view.result.current.fo).not.toBeNull());
    expect(view.result.current.fo?.answeredBy).toBeNull();
    expect(view.result.current.canRetry).toBe(true);
    expect(view.result.current.error).toMatch(/No provider answered/);
    expect(setGate).toHaveBeenLastCalledWith(false);

    heal();
    act(() => view.result.current.failover());
    await waitFor(() => expect(view.result.current.fo?.answeredBy).toBe("near-org"));
    expect(view.result.current.canRetry).toBe(false);
    expect(setGate).toHaveBeenLastCalledWith(true);
  });

  it("aborts in-flight probes when the lesson unmounts", async () => {
    const { chain, calls } = flakyChain();
    const { view } = mount(chain, RACE);
    act(() => view.result.current.race());
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const signal = calls[0]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
