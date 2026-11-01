import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChainProvider, useChain } from "./ChainContext";
import { ChainError } from "./errors";
import { ModeSwitch } from "./ModeSwitch";
import type { Chain } from "./types";

function Probe() {
  const chain = useChain();
  return <p data-testid="network">{chain.network}</p>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("ChainProvider modes", () => {
  it("starts in demo mode", () => {
    render(
      <ChainProvider>
        <ModeSwitch />
        <Probe />
      </ChainProvider>,
    );
    expect(screen.getByTestId("mode-pill")).toHaveTextContent("Demo mode");
    expect(screen.getByTestId("network")).toHaveTextContent("demo");
  });

  it("falls back to demo with a notice when testnet cannot fund a practice account", async () => {
    window.history.replaceState(null, "", "/?mode=testnet");
    const broken = {
      network: "testnet",
      practiceAccount: () =>
        Promise.reject(new ChainError("Network", "No faucet could fund a practice account.")),
    } as unknown as Chain;
    render(
      <ChainProvider loadTestnetChain={async () => broken}>
        <ModeSwitch />
        <Probe />
      </ChainProvider>,
    );
    expect(await screen.findByTestId("mode-notice")).toHaveTextContent(/demo mode.*No faucet could fund/);
    expect(screen.getByTestId("mode-pill")).toHaveTextContent("Demo mode");
    expect(screen.getByTestId("network")).toHaveTextContent("demo");
    await act(async () => screen.getByRole("button", { name: "Stay in demo" }).click());
    expect(screen.queryByTestId("mode-notice")).toBeNull();
    expect(localStorage.getItem("bon:chain-mode")).toBe("demo");
  });

  it("switches to testnet once the practice account is ready", async () => {
    const fake = {
      network: "testnet",
      practiceAccount: async () => ({ accountId: "a.testnet", publicKey: "ed25519:x" }),
    } as unknown as Chain;
    render(
      <ChainProvider loadTestnetChain={async () => fake}>
        <ModeSwitch />
        <Probe />
      </ChainProvider>,
    );
    await act(async () => screen.getByTestId("mode-toggle").click());
    expect(await screen.findByText("Testnet")).toBeInTheDocument();
    expect(screen.getByTestId("network")).toHaveTextContent("testnet");
    expect(screen.getByTestId("mode-toggle")).toHaveTextContent("Use demo");
  });
});
