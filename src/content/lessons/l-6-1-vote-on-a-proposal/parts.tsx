/**
 * What both views show in HTML (2D under the drawing, 3D in the book scene's panel): the step's facts,
 * the lock slider, the example proposal and its tally. Same words, same test ids in both views. The 2D
 * view also shows the last pick's note (in 3D the picked object's own slip shows it).
 */
import { useId, type ReactNode } from "react";
import {
  breakdown,
  fmt,
  LOCKED,
  MAX_MONTHS,
  MIN_MONTHS,
  PICK_LABELS,
  PROPOSAL,
  tally,
  timeLocked,
  unlockCost,
  vePower,
} from "./governance";
import { HALL, INSPECT, LOCK, STAKE, VOTE } from "./steps";
import type { Governance } from "./useGovernance";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** What a pick that did the step's action says. */
const ACT_NOTES = {
  lock: "The gauge moved on a year. The extra veNEAR grew.",
  review: "Unrolled. Read the proposal below.",
  vote: "Stamped. Your vote is in the tally.",
} as const;

/** The example label: the proposal is not real and not live. */
export const EXAMPLE_NOTE = "Example proposal, made up for this lesson. Not a real or live proposal.";

export function Tally({ m }: { m: Governance }) {
  const t = tally(m.ballot);
  return (
    <div className="gov-tally" data-testid="tally" data-yes={t.yesPct} data-quorum={t.quorumPct}>
      <p>
        <strong>{t.yesPct}% yes</strong>, <strong>{t.noPct}% no</strong> ({fmt(t.total)} veNEAR voted
        {m.ballot ? `, ${fmt(m.ballot.power)} of it yours` : ""}).
      </p>
      <div
        className="gov-bar"
        role="meter"
        aria-label="Quorum"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, t.quorumPct)}
        aria-valuetext={`${t.quorumPct}% of the ${fmt(t.quorum)} veNEAR quorum`}
      >
        <span className="gov-bar-yes" style={{ width: `${t.yesBar * 100}%` }} />
        <span className="gov-bar-no" style={{ width: `${t.noBar * 100}%` }} />
      </div>
      <p className="gov-side">
        Quorum: {t.quorumPct}% of {fmt(t.quorum)} veNEAR {t.reached ? "(reached)" : "(not reached yet)"}.
      </p>
    </div>
  );
}

export function Facts({
  m,
  compact = false,
  notes = false,
}: {
  m: Governance;
  compact?: boolean;
  notes?: boolean;
}) {
  const { step } = m;
  const slider = useId();
  return (
    <div className={`gov-facts${compact ? " compact" : ""}`}>
      {step === HALL ? (
        <p className="gov-status">Who takes part: delegators, validators and DAO members.</p>
      ) : null}

      {step === STAKE ? (
        <dl className="gov-dl" data-testid="staking">
          <Row label="Delegated">50 NEAR (an example)</Row>
          <Row label="Rewards">a few percent a year</Row>
          <Row label="Unstaking">4 epochs, a little over a day</Row>
          <Row label="Who holds it">the pool's contract, not the validator</Row>
        </dl>
      ) : null}

      {step === LOCK ? (
        <div className="gov-lock">
          <p className="gov-status">
            {LOCKED} NEAR locked: {LOCKED} veNEAR at once, one for each NEAR.
          </p>
          <label htmlFor={slider}>
            Time locked: <strong data-testid="lock-months">{timeLocked(m.months)}</strong>
          </label>
          <input
            id={slider}
            type="range"
            min={MIN_MONTHS}
            max={MAX_MONTHS}
            step={1}
            value={m.months}
            aria-valuetext={timeLocked(m.months)}
            onChange={(e) => m.setMonths(Number(e.target.value))}
          />
          <p className={`gov-status${m.locked ? " done" : ""}`} data-testid="ve-power">
            {breakdown(m.months)}
          </p>
          <p className="gov-side" data-testid="unlock-cost">
            {unlockCost(m.months)}
          </p>
          <p className="gov-side">
            Mainnet setting: the extra grows by half the locked NEAR each year. The House of Stake docs say it
            stops at 4 years.
          </p>
        </div>
      ) : null}

      {step === INSPECT || step === VOTE ? (
        <div className="gov-proposal" data-testid="proposal">
          <p className="gov-example" data-testid="example-label">
            {EXAMPLE_NOTE}
          </p>
          <p>
            <strong>
              #{PROPOSAL.id}: {PROPOSAL.title}
            </strong>
          </p>
          {m.reviewed ? (
            <>
              {step === INSPECT ? (
                <dl className="gov-dl" data-testid="proposal-details">
                  <Row label="Summary">{PROPOSAL.summary}</Row>
                  <Row label="Asks for">{PROPOSAL.ask}</Row>
                  <Row label="Pays to">{PROPOSAL.to}</Row>
                  <Row label="Quorum">{fmt(PROPOSAL.quorum)} veNEAR must vote</Row>
                </dl>
              ) : null}
              <Tally m={m} />
            </>
          ) : (
            <p className="gov-status">Rolled up. Review the proposal, or pick the scroll, to read it.</p>
          )}
        </div>
      ) : null}

      {step === VOTE ? (
        <p className={`gov-status${m.ballot ? " done" : ""}`} data-testid="vote-status">
          {m.ballot
            ? `Practice vote: +${fmt(m.ballot.power)} veNEAR ${m.ballot.choice.toUpperCase()}. Nothing was sent to a chain.`
            : `Not voted yet. Your vote weighs ${fmt(vePower(m.months))} veNEAR.`}
        </p>
      ) : null}

      {notes && m.picked ? (
        <p
          className={`gov-note${m.picked.result.hint ? " not-yet" : ""}`}
          data-testid="picked-note"
          data-not-yet={m.picked.result.hint ? "yes" : undefined}
          key={m.picked.n}
        >
          <strong>{PICK_LABELS[m.picked.what]}:</strong>{" "}
          {m.picked.result.hint ??
            m.picked.result.detail ??
            (m.picked.result.act ? ACT_NOTES[m.picked.result.act] : "")}
        </p>
      ) : null}
    </div>
  );
}
