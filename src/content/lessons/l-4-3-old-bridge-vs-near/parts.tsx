/**
 * The HTML both views show (2D under the drawing, 3D in the book scene's panel): the two timelines side
 * by side with each step's time and fee (every estimate tagged "est."), and each step's facts. Same words,
 * same test ids in both views.
 */
import type { ReactNode } from "react";
import {
  BRIDGE_STEPS,
  bridgeTotal,
  intentSteps,
  intentTotal,
  litSteps,
  PICK_LABELS,
  sourceTag,
  VAULT_USD,
  type Figure,
  type TimelineStep,
} from "./compare";
import { BACKING, COMPARE, CONFIDENTIAL, EXPLOIT, HOOK } from "./steps";
import type { BridgeCompare } from "./useBridgeCompare";

/** A number and where it came from: "est." for an estimate, "recorded quote" or "live quote" otherwise. */
function Fig({ f }: { f: Figure }) {
  return (
    <span className="blc-fig" data-source={f.source}>
      {f.text} <small className={`blc-tag ${f.source}`}>{sourceTag(f.source)}</small>
    </span>
  );
}

function Track({
  title,
  testId,
  steps,
  lit,
  total,
}: {
  title: string;
  testId: string;
  steps: TimelineStep[] | null;
  lit: number;
  total: { time: Figure; fee: Figure } | null;
}) {
  const done = steps !== null && lit >= steps.length;
  return (
    <section className={`blc-track${done ? " done" : ""}`} data-testid={testId} data-lit={lit}>
      <h3>{title}</h3>
      {steps ? (
        <ol>
          {steps.map((s, i) => (
            <li key={s.label} className={i < lit ? "lit" : undefined} data-lit={i < lit ? "yes" : "no"}>
              <span className="blc-label">{s.label}</span>
              <span className="blc-figs">
                <Fig f={s.time} /> · <Fig f={s.fee} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="blc-note">Waiting for the quote…</p>
      )}
      {total && done ? (
        <dl className="blc-total" data-testid={`${testId}-total`}>
          <dt>Time</dt>
          <dd>
            <Fig f={total.time} />
          </dd>
          <dt>Fees</dt>
          <dd>
            <Fig f={total.fee} />
          </dd>
        </dl>
      ) : null}
    </section>
  );
}

/** Step 2: the old bridge and the intent, played side by side. */
export function Timelines({ m }: { m: BridgeCompare }) {
  const lit = litSteps(m.played);
  return (
    <div className="blc-timelines">
      <Track
        title="Path A: the old bridge"
        testId="timeline-bridge"
        steps={BRIDGE_STEPS}
        lit={lit.bridge}
        total={bridgeTotal()}
      />
      <Track
        title="Path B: the NEAR way"
        testId="timeline-intent"
        steps={m.quote ? intentSteps(m.quote) : null}
        lit={lit.intent}
        total={m.quote ? intentTotal(m.quote) : null}
      />
    </div>
  );
}

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

const EXPLOIT_TEXT = {
  idle: "The vault is full. Nothing has happened yet.",
  crack: "1. The attacker breaks into the vault.",
  drain: "2. The collateral drains out.",
  done: "Done. The vault is empty: wUSDC has no backing. Native USDC is untouched.",
} as const;

export function Facts({ m, compact = false }: { m: BridgeCompare; compact?: boolean }) {
  const { step, quote } = m;
  return (
    <div className={`blc-facts${compact ? " compact" : ""}`}>
      {step === HOOK ? (
        <dl className="blc-dl">
          <Row label="Path A">lock coins in a vault, get a wrapped IOU on the other chain</Row>
          <Row label="Path B">sign an intent, a solver delivers the native coin</Row>
        </dl>
      ) : null}

      {step === COMPARE ? <Timelines m={m} /> : null}
      {step === COMPARE && quote ? (
        <p className="blc-note" data-testid="quote-source">
          {quote.source === "recorded"
            ? "Intent figures from a recorded 1Click quote (5 NEAR for USDC on Arbitrum), not a live price. No network was used. Figures marked est. are estimates."
            : "Intent figures from a live dry-run 1Click quote (5 NEAR for USDC on Arbitrum). No money moves. Figures marked est. are estimates."}
        </p>
      ) : null}

      {step === BACKING ? (
        m.inspected ? (
          <dl className="blc-dl" data-testid="backing">
            <Row label="wUSDC (path A)">an IOU: a claim on the USDC locked in the bridge vault</Row>
            <Row label="USDC (path B)">native USDC, issued on its own chain; nothing else backs it</Row>
          </dl>
        ) : (
          <p className="blc-line">Two tokens that both say USDC. Inspect what stands behind each one.</p>
        )
      ) : null}

      {step === EXPLOIT ? (
        <>
          <p className={`blc-status ${m.exploit}`} role="status" data-testid="exploit-status">
            {EXPLOIT_TEXT[m.exploit]}
          </p>
          <dl className="blc-dl">
            <Row label="Bridge vault" testId="vault-left">
              {m.exploited ? "$0 left (simulated)" : `${VAULT_USD} locked (simulated)`}
            </Row>
            <Row label="wUSDC" testId="wusdc-value">
              {m.exploited ? "$0.00: no backing" : "$1.00"}
            </Row>
            <Row label="Native USDC" testId="usdc-value">
              $1.00: safe
            </Row>
          </dl>
        </>
      ) : null}

      {step === CONFIDENTIAL ? (
        <dl className="blc-dl" data-testid="confidential">
          <Row label="Public intent">amount and price visible to anyone watching</Row>
          <Row label="Confidential intent">
            {m.shielded ? "amount and price encrypted until matched" : "not shielded yet"}
          </Row>
        </dl>
      ) : null}

      {m.notice ? (
        <p className="blc-warn" role="alert" data-testid="quote-notice">
          {m.notice}
        </p>
      ) : null}
      {m.picked ? (
        <p
          className={`blc-note${m.picked.result.notYet ? " not-yet" : ""}`}
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
