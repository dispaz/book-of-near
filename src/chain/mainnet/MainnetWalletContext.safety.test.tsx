import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseNear } from "../units";
import { DemoWallet } from "./DemoWallet";
import { MainnetWalletProvider, useMainnetWallet, WalletPanel } from "./MainnetWalletContext";
import type { SigningOutcome } from "./index";

afterEach(cleanup);

const request = {
  summary: "Send a tiny test payment.",
  receiverId: "book-of-near.near",
  actions: [{ type: "Transfer" as const, deposit: parseNear("0.5") }],
};

function Sender({ onDone }: { onDone: (o: SigningOutcome) => void }) {
  const { sign } = useMainnetWallet();
  return <button onClick={async () => onDone(await sign(request))}>send</button>;
}

describe("provider signing safety", () => {
  it("does not expose the raw wallet to lessons", () => {
    let api: Record<string, unknown> = {};
    function Probe() {
      api = useMainnetWallet() as unknown as Record<string, unknown>;
      return null;
    }
    render(
      <MainnetWalletProvider>
        <Probe />
      </MainnetWalletProvider>,
    );
    expect(api.wallet).toBeUndefined();
    expect(api.signAndSend).toBeUndefined();
  });

  it("a second sign() while one is open or in flight is refused as busy, and the first still resolves", async () => {
    const wallet = new DemoWallet();
    let release!: () => void;
    const send = vi
      .spyOn(wallet, "signAndSend")
      .mockImplementation(() => new Promise((res) => (release = () => res({ txHash: "H1" }))));
    const done = vi.fn();
    render(
      <MainnetWalletProvider demoWallet={wallet}>
        <WalletPanel />
        <Sender onDone={done} />
      </MainnetWalletProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await screen.findByTestId("wallet-account");
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "send" })); // second call while the dialog is open
    await waitFor(() => expect(done).toHaveBeenCalledWith({ ok: false, reason: "busy" }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    // the dialog closes but the learner is told we are waiting; a third call is still refused
    expect(await screen.findByTestId("wallet-waiting")).toHaveTextContent(/waiting for your wallet/i);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenCalledOnce();
    await act(async () => release());
    await waitFor(() => expect(done).toHaveBeenLastCalledWith({ ok: true, txHash: "H1" }));
    expect(screen.queryByTestId("wallet-waiting")).toBeNull();
  });

  it("shows a failed outcome message when the wallet rejects", async () => {
    const wallet = new DemoWallet();
    vi.spyOn(wallet, "signAndSend").mockRejectedValue(new Error("popup closed"));
    const done = vi.fn();
    render(
      <MainnetWalletProvider demoWallet={wallet}>
        <WalletPanel />
        <Sender onDone={done} />
      </MainnetWalletProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await screen.findByTestId("wallet-account");
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() =>
      expect(done).toHaveBeenCalledWith(expect.objectContaining({ ok: false, reason: "failed" })),
    );
    expect(screen.queryByTestId("wallet-waiting")).toBeNull();
  });
});
