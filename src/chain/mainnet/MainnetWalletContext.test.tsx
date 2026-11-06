import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseNear } from "../units";
import { DemoWallet } from "./DemoWallet";
import { FundsNotice, MainnetWalletProvider, useMainnetWallet, WalletPanel } from "./MainnetWalletContext";
import type { MainnetWallet, SigningOutcome } from "./index";

afterEach(cleanup);

describe("WalletPanel in demo mode (no wallet, no network)", () => {
  it("connects the simulated account and shows its balance", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <MainnetWalletProvider>
        <WalletPanel />
      </MainnetWalletProvider>,
    );
    expect(screen.getByTestId("wallet-status")).toHaveTextContent(/not connected/i);
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => expect(screen.getByTestId("wallet-account")).toHaveTextContent("demo-learner.near"));
    expect(screen.getByTestId("wallet-balance")).toHaveTextContent("25 NEAR");
    expect(screen.getByTestId("wallet-status")).toHaveTextContent(/simulated/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("disconnects", async () => {
    render(
      <MainnetWalletProvider>
        <WalletPanel />
      </MainnetWalletProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    fireEvent.click(await screen.findByRole("button", { name: /disconnect/i }));
    expect(screen.getByTestId("wallet-status")).toHaveTextContent(/not connected/i);
  });
});

describe("FundsNotice", () => {
  it("shows no-wallet, then not-enough with the testnet fallback, then enough", async () => {
    const wallet = new DemoWallet({ balance: parseNear("0.1") });
    render(
      <MainnetWalletProvider demoWallet={wallet}>
        <WalletPanel />
        <FundsNotice amount={parseNear("1")} />
      </MainnetWalletProvider>,
    );
    expect(screen.getByTestId("funds-no-wallet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /testnet edition/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(await screen.findByTestId("funds-not-enough")).toHaveTextContent(/short by/i);
    expect(screen.getByRole("link", { name: /testnet edition/i })).toBeInTheDocument();
    cleanup();

    render(
      <MainnetWalletProvider demoWallet={new DemoWallet({ balance: parseNear("5") })}>
        <WalletPanel />
        <FundsNotice amount={parseNear("1")} />
      </MainnetWalletProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(await screen.findByTestId("funds-enough")).toBeInTheDocument();
  });
});

describe("confirmed signing", () => {
  function Sender({ onDone }: { onDone: (o: SigningOutcome) => void }) {
    const { sign } = useMainnetWallet();
    return (
      <button
        onClick={async () =>
          onDone(
            await sign({
              summary: "Send a tiny test payment.",
              receiverId: "book-of-near.near",
              actions: [{ type: "Transfer", deposit: parseNear("0.5") }],
            }),
          )
        }
      >
        send
      </button>
    );
  }

  function setup(wallet: MainnetWallet) {
    const done = vi.fn();
    const send = vi.spyOn(wallet, "signAndSend");
    render(
      <MainnetWalletProvider demoWallet={wallet as DemoWallet}>
        <WalletPanel />
        <Sender onDone={done} />
      </MainnetWalletProvider>,
    );
    return { done, send };
  }

  it("shows the action and amount before the wallet is asked; Cancel never asks it", async () => {
    const { done, send } = setup(new DemoWallet());
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await screen.findByTestId("wallet-account");
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("0.5 NEAR");
    expect(dialog).toHaveTextContent("book-of-near.near");
    expect(dialog).toHaveTextContent("Send a tiny test payment.");
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(done).toHaveBeenCalledWith({ ok: false, reason: "declined" }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks the wallet only after the learner confirms", async () => {
    const { done, send } = setup(new DemoWallet());
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await screen.findByTestId("wallet-account");
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    });
    await waitFor(() => expect(done).toHaveBeenCalledWith({ ok: true, txHash: "demo-0001" }));
    expect(send).toHaveBeenCalledOnce();
  });

  it("refuses with no-wallet and shows no dialog when nobody is connected", async () => {
    const { done, send } = setup(new DemoWallet());
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(done).toHaveBeenCalledWith({ ok: false, reason: "no-wallet" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("real wallet choice", () => {
  it("stays in demo until the learner opts in, then loads the real wallet lazily", async () => {
    const real = new DemoWallet({ accountId: "real-ana.near" }); // stands in for NearConnectWallet
    const loadMainnetWallet = vi.fn(async () => real);
    render(
      <MainnetWalletProvider loadMainnetWallet={loadMainnetWallet}>
        <WalletPanel />
      </MainnetWalletProvider>,
    );
    expect(loadMainnetWallet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /use my own wallet/i }));
    await waitFor(() => expect(loadMainnetWallet).toHaveBeenCalledOnce());
    fireEvent.click(await screen.findByRole("button", { name: /connect/i }));
    expect(await screen.findByTestId("wallet-account")).toHaveTextContent("real-ana.near");
  });

  it("falls back to the demo wallet with a notice when the real one cannot load", async () => {
    render(
      <MainnetWalletProvider
        loadMainnetWallet={async () => {
          throw new Error("chunk failed");
        }}
      >
        <WalletPanel />
      </MainnetWalletProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /use my own wallet/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/could not load/i);
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
  });
});
