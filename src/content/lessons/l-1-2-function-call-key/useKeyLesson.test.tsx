import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChainProvider } from "../../../chain/ChainContext";
import { DemoChain } from "../../../chain/DemoChain";
import { ADD, CALL, REVOKE, useKeyLesson } from "./useKeyLesson";

let chain: DemoChain;
const wrapper = ({ children }: { children: ReactNode }) => (
  <ChainProvider chain={chain}>{children}</ChainProvider>
);

function mount(step: number) {
  const setVars = vi.fn();
  const reportEvidence = vi.fn();
  const view = renderHook(
    ({ s }: { s: number }) =>
      useKeyLesson({ step: s, setGate: () => {}, setVars, reducedMotion: true, reportEvidence }),
    { wrapper, initialProps: { s: step } },
  );
  return { ...view, setVars, reportEvidence };
}

const lastVars = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)?.[0] as Record<string, string>;
const lastEvidence = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)?.[0] as Record<string, string>;

/** First visit: add the key with a 0.2 NEAR allowance and count once. Then the page "reloads". */
async function firstVisit() {
  const first = mount(ADD);
  await waitFor(() => expect(first.result.current.me).not.toBeNull());
  act(() => first.result.current.setAllowanceText("0.2"));
  await act(() => first.result.current.addKey());
  expect(first.result.current.keyState).toBe("active");
  first.rerender({ s: CALL });
  await act(() => first.result.current.tryIt("count"));
  const addHash = lastEvidence(first.reportEvidence).addKeyTxHash;
  first.unmount();
  return addHash;
}

beforeEach(() => {
  localStorage.clear();
  chain = new DemoChain({ pace: "instant" });
});
afterEach(() => cleanup());

describe("lesson 1.2 after a reload", () => {
  it("keeps the starting allowance, so the delete step does not repeat one number", async () => {
    await firstVisit();
    const again = mount(REVOKE);
    await waitFor(() => expect(again.result.current.keyState).toBe("active"));
    await waitFor(() => expect(lastVars(again.setVars).keyLeft).toMatch(/of its 0\.2 NEAR allowance\.$/));
    expect(lastVars(again.setVars).allowance).toBe("0.2");
    expect(lastVars(again.setVars).keyLeft).not.toContain("of its 0.2 NEAR allowance. It");
    expect(lastVars(again.setVars).left).not.toBe("0.2");
  });

  it("does not show the same number twice when this browser forgot the starting allowance", async () => {
    await firstVisit();
    localStorage.clear();
    const again = mount(REVOKE);
    await waitFor(() => expect(again.result.current.keyState).toBe("active"));
    await waitFor(() => expect(lastVars(again.setVars).keyLeft).toMatch(/NEAR of allowance left\.$/));
    const { keyLeft, left } = lastVars(again.setVars);
    expect(keyLeft).toBe(`It still had ${left} NEAR of allowance left.`);
  });

  it("fills the gauges from what the key had when it was picked up, if the start is unknown", async () => {
    await firstVisit();
    localStorage.clear();
    const again = mount(REVOKE);
    await waitFor(() => expect(again.result.current.keyState).toBe("active"));
    expect(again.result.current.initial).toBeNull();
    expect(again.result.current.gaugeFrom).toBe(again.result.current.left);
  });

  it("measures the gauges against the starting allowance when it is known", async () => {
    await firstVisit();
    const again = mount(REVOKE);
    await waitFor(() => expect(again.result.current.keyState).toBe("active"));
    expect(again.result.current.gaugeFrom).toBe(200_000_000_000_000_000_000_000n);
  });

  it("records the add-key hash it remembered and that the key was picked up after a reload", async () => {
    const addHash = await firstVisit();
    expect(addHash).toBeTruthy();
    const again = mount(REVOKE);
    await waitFor(() => expect(again.result.current.keyState).toBe("active"));
    await act(() => again.result.current.revoke());
    const ev = lastEvidence(again.reportEvidence);
    expect(ev.keyResumed).toBe("yes");
    expect(ev.addKeyTxHash).toBe(addHash);
    expect(ev.txHash).toBeTruthy();
    expect(ev.txHash).not.toBe(addHash);
  });

  it("says the key was picked up after a reload when the add hash is unknown", async () => {
    await firstVisit();
    localStorage.clear();
    const again = mount(REVOKE);
    await waitFor(() => expect(again.result.current.keyState).toBe("active"));
    await act(() => again.result.current.revoke());
    const ev = lastEvidence(again.reportEvidence);
    expect(ev.keyResumed).toBe("yes");
    expect(ev.addKeyTxHash).toBeUndefined();
  });

  it("does not claim a reload when the key was added in this visit", async () => {
    const first = mount(ADD);
    await waitFor(() => expect(first.result.current.me).not.toBeNull());
    await act(() => first.result.current.addKey());
    first.rerender({ s: REVOKE });
    await act(() => first.result.current.revoke());
    const ev = lastEvidence(first.reportEvidence);
    expect(ev.keyResumed).toBeUndefined();
    expect(ev.addKeyTxHash).toBeTruthy();
  });
});
