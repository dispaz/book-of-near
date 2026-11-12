/**
 * The facts both views show in HTML (2D under the drawing, 3D in the book scene's panel), and step 5's
 * finish panel, docked with the step's buttons. Same words, same test ids in both views.
 */
import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ActionSlot } from "../../../ui/SceneAction";
import { REAL_SWAP_AMOUNT, REAL_SWAP_CAP_USD, SLIPPAGE_BPS, VERIFIER_CONTRACT } from "../../../chain/intents";
import { useMainnetWallet } from "../../../chain/mainnet";
import { formatNear } from "../../../chain/units";
import { delivered, PICK_LABELS } from "./swap";
import { DECLARE, FILL, FINISH, HOOK, INSPECT, type IntentSwap } from "./useIntentSwap";

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

const short = (s: string, head = 12, tail = 6) =>
  s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
const usd = (n: number | null) => (n === null ? "" : ` ($${n.toFixed(2)})`);

const FILL_TEXT = {
  idle: "Not filled yet. Nothing moves until you start the simulation.",
  lock: "1. Your NEAR is locked in the verifier contract, intents.near.",
  deliver: "2. The solver sends USDC to your Arbitrum address from its own funds.",
  settle: "3. USDC has arrived. The verifier checks the proof of delivery.",
  done: "Done. You have USDC on Arbitrum, and the verifier released your NEAR to the solver.",
} as const;

export function Facts({ m, compact = false }: { m: IntentSwap; compact?: boolean }) {
  const { step, quote } = m;
  return (
    <div className={`ixs-facts${compact ? " compact" : ""}`}>
      {step === HOOK ? (
        <dl className="ixs-dl">
          <Row label="With a bridge">approve, wrap, bridge, pay gas in two coins, wait</Row>
          <Row label="With an intent">sign one message: what you give, what you want</Row>
        </dl>
      ) : null}

      {step === DECLARE ? (
        <dl className="ixs-dl">
          <Row label="You give">5 NEAR, on NEAR</Row>
          <Row label="You want">USDC, on Arbitrum</Row>
          <Row label="Route">left to the solvers</Row>
          <Row label="Quote" testId="quote-status">
            {quote
              ? `${quote.amountOutFormatted} USDC, about ${quote.timeEstimate} s`
              : m.loading
                ? "asking 1Click…"
                : "not asked yet"}
          </Row>
        </dl>
      ) : null}

      {step === INSPECT ? (
        quote && m.inspected ? (
          <>
            <dl className="ixs-dl" data-testid="quote-breakdown">
              <Row label="You give">
                {quote.amountInFormatted} NEAR{usd(quote.amountInUsd)}
              </Row>
              <Row label="You get" testId="amount-out">
                about {quote.amountOutFormatted} USDC{usd(quote.amountOutUsd)}
              </Row>
              <Row label="Guaranteed minimum" testId="min-out">
                {quote.minAmountOutFormatted} USDC (slippage {SLIPPAGE_BPS / 100}%)
              </Row>
              <Row label="Time" testId="time-estimate">
                about {quote.timeEstimate} seconds
              </Row>
              <Row label="Arbitrum gas you pay">none: the solver pays it</Row>
              {quote.appFee !== null ? (
                <Row label="App fee field">
                  {quote.appFee} (1Click adds it without a key; unit not confirmed)
                </Row>
              ) : null}
              {quote.deadline ? (
                <Row label="Valid until">{quote.deadline.replace("T", " ").slice(0, 16)} UTC</Row>
              ) : null}
              <Row label="1Click's signature" testId="quote-signature">
                <code>{short(quote.signature)}</code>
              </Row>
            </dl>
            <p className="ixs-note" data-testid="solvers-note">
              Three solvers are a drawing. 1Click returns only the winning quote, not the losing bids.
            </p>
          </>
        ) : (
          <p className="ixs-line">The quote slip is inside the parcel. Open it to read the terms.</p>
        )
      ) : null}

      {step === FILL ? (
        <p className={`ixs-status ${m.fill}`} role="status" data-testid="fill-status">
          {FILL_TEXT[m.fill]}
        </p>
      ) : null}

      {step === FINISH ? (
        <p className="ixs-line">
          {delivered(m.fill) ? "Filled: " : ""}
          {quote
            ? `${quote.amountOutFormatted} USDC on Arbitrum for ${quote.amountInFormatted} NEAR (dry run).`
            : ""}
        </p>
      ) : null}

      {step >= DECLARE && step <= FINISH && quote ? (
        <p className="ixs-note" data-testid="quote-source">
          {quote.source === "recorded"
            ? "Recorded quote: a real 1Click answer's shape with the script's numbers, not a live price. No network was used."
            : `Live dry-run quote from 1Click${quote.source === "worker" ? ", through the app's Worker" : ""}. Dry run: no deposit, no money moves.`}
        </p>
      ) : null}
      {m.notice ? (
        <p className="ixs-warn" role="alert" data-testid="quote-notice">
          {m.notice}
        </p>
      ) : null}
      {m.picked ? (
        <p
          className={`ixs-note${m.picked.result.notYet ? " not-yet" : ""}`}
          data-testid="picked-note"
          data-not-yet={m.picked.result.notYet ? "yes" : undefined}
          key={m.picked.n}
        >
          <strong>{PICK_LABELS[m.picked.what]}:</strong> {m.picked.result.note}
        </p>
      ) : null}
    </div>
  );
}

/** Step 5: finish on the dry quote, or the optional tiny swap. Docked with the step's buttons. */
export function FinishPanel({ m }: { m: IntentSwap }) {
  const slot = useContext(ActionSlot);
  const { state, connect, usingReal, setUseReal, loading } = useMainnetWallet();
  const offer = m.offer;
  const rs = m.realSwap;
  const amount = formatNear(REAL_SWAP_AMOUNT, 2);
  const panel = (
    <section className="ixs-finish" aria-label="Optional tiny real swap" data-testid="finish-panel">
      <p className="ixs-finish-title">
        Optional: a tiny real swap of {amount} NEAR, capped at ${REAL_SWAP_CAP_USD}.
      </p>
      {state.status !== "connected" ? (
        <p>
          <button
            type="button"
            className="btn"
            onClick={() => void connect()}
            disabled={state.status === "connecting"}
          >
            {usingReal ? "Connect my mainnet wallet" : "Connect the demo wallet"}
          </button>{" "}
          <button
            type="button"
            className="ixs-link"
            disabled={loading}
            onClick={() => setUseReal(!usingReal)}
          >
            {loading ? "Loading…" : usingReal ? "Back to the demo wallet" : "Use my own wallet"}
          </button>
        </p>
      ) : (
        <p data-testid="swap-wallet">
          {usingReal ? "Your wallet" : "Demo wallet (simulated, no real money)"}:{" "}
          <code>{state.accountId}</code>
        </p>
      )}
      <p
        className={`ixs-offer ${offer.kind}`}
        data-testid="swap-offer"
        data-offer={offer.kind === "enough" ? "offered" : "not-offered"}
      >
        {offer.kind === "enough"
          ? `Offered. ${offer.message}`
          : `Not offered: ${offer.kind === "no-wallet" ? "no wallet is connected." : offer.message.replace(" You can use the free testnet edition instead.", "")} Finish on the dry-run quote instead.`}
      </p>
      {/* Shown until the swap has an outcome; the "Sent" outcome repeats it. One line at a time keeps the
          dock's height steady, so the margin note above it does not jump. */}
      {offer.kind === "enough" && rs.status !== "ended" ? (
        <p data-testid="swap-where">
          The USDC stays in your NEAR Intents account ({VERIFIER_CONTRACT}), not on Arbitrum. You withdraw it
          separately.
        </p>
      ) : null}
      {offer.kind === "enough" ? (
        <button
          type="button"
          className="btn"
          data-testid="swap-real"
          disabled={rs.status === "working" || m.finished}
          onClick={() => void m.swapForReal()}
        >
          {usingReal ? `Swap ${amount} NEAR for real` : `Simulate the ${amount} NEAR swap`}
        </button>
      ) : null}
      {rs.status === "working" ? <p role="status">Getting a live quote and asking your wallet…</p> : null}
      {rs.status === "ended" ? (
        <p
          className={rs.outcome.kind === "done" ? "ixs-ok" : "ixs-warn"}
          role="status"
          data-testid="swap-outcome"
          data-outcome={rs.outcome.kind}
        >
          {rs.outcome.kind === "done"
            ? rs.real
              ? `Sent. Transaction ${rs.outcome.txHash}. Your USDC is kept in your NEAR Intents account (${VERIFIER_CONTRACT}), not on Arbitrum.`
              : `Simulated with the demo wallet (${rs.outcome.txHash}). No real money moved, so this counts as a dry run.`
            : rs.outcome.kind === "declined"
              ? "You cancelled. Nothing was sent."
              : rs.outcome.message}
        </p>
      ) : null}
    </section>
  );
  return slot ? createPortal(panel, slot) : panel;
}
