/**
 * What both views show in HTML (2D under the drawing, 3D in the book scene's panel): the step's recorded
 * figures, the trade table and the "Recorded on … Not live data." label. Same words, same test ids in
 * both views. The 2D view also shows the last pick's note (in 3D the picked object's own slip shows it).
 */
import type { ReactNode } from "react";
import {
  INTENTS,
  ORACLE_READ,
  PICK_LABELS,
  POOLS,
  QUOTES,
  RECORDED_NOTE,
  simpleLine,
  stableLine,
  SUPPLY,
  TVL,
} from "./money";
import { DOLLARS, FLOWS, MAP, ORACLE, SWAP } from "./steps";
import type { MoneyMap } from "./useMoneyMap";

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
  compare: "Opened. Native USDC and the bridged USDC.e are side by side below.",
  read: "Read. The stored price and its age are below.",
  trade: "Traded, on paper: the recorded quotes are below.",
  flows: "The flows run from the NEAR Intents area onto the page.",
} as const;

export function Facts({
  m,
  compact = false,
  notes = false,
}: {
  m: MoneyMap;
  compact?: boolean;
  notes?: boolean;
}) {
  const { step } = m;
  return (
    <div className={`money-facts${compact ? " compact" : ""}`}>
      <p className="money-recorded" data-testid="recorded-label">
        {RECORDED_NOTE}
      </p>

      {step === MAP ? (
        <dl className="money-dl" data-testid="tvl">
          <Row label="NEAR DeFi">{TVL.near} (TVL)</Row>
          <Row label="Rhea Lend">{TVL.rheaLend} (lending, was Burrow)</Row>
          <Row label="Rhea Dex">{TVL.rheaDex} (exchange, was Ref Finance)</Row>
          <Row label="Source">DefiLlama</Row>
        </dl>
      ) : null}

      {step === DOLLARS ? (
        m.compared ? (
          <dl className="money-dl" data-testid="supplies">
            <Row label={SUPPLY.usdc.name}>
              {SUPPLY.usdc.amount}, {SUPPLY.usdc.by}
            </Row>
            <Row label={SUPPLY.usdce.name}>
              {SUPPLY.usdce.amount}, {SUPPLY.usdce.by}
            </Row>
            <Row label="Source">each token's contract on NEAR mainnet</Row>
          </dl>
        ) : (
          <p className="money-status">Closed. Compare the two USDCs, or pick the mailbox.</p>
        )
      ) : null}

      {step === ORACLE ? (
        m.oracleRead ? (
          <dl className="money-dl" data-testid="oracle">
            <Row label="Contract">{ORACLE_READ.contract}</Row>
            <Row label="Stored price">
              {ORACLE_READ.feed} {ORACLE_READ.stored} {ORACLE_READ.confidence}
            </Row>
            <Row label="Published">{ORACLE_READ.published}</Row>
            <Row label="get_price">{ORACLE_READ.getPrice}: it checks the age, and this price is too old</Row>
            <Row label="Market that day">{ORACLE_READ.market} (DefiLlama)</Row>
          </dl>
        ) : (
          <p className="money-status">Dark. Read the oracle, or pick the booth.</p>
        )
      ) : null}
      {step === ORACLE && m.oracleRead ? (
        <p className="money-side">
          Pyth's docs: Pyth Core no longer supports NEAR. A contract must check a price's age.
        </p>
      ) : null}

      {step === SWAP ? (
        m.trade ? (
          <div className="money-trade" data-testid="trade" data-size={m.trade}>
            <p className="money-status done">
              Stable pool #{POOLS.stable.id}: {stableLine(m.trade)}
            </p>
            <p className="money-status done">
              Simple pool #{POOLS.simple.id}: {simpleLine(m.trade)}, {QUOTES[m.trade].overStart} over the
              starting ${POOLS.simple.startPrice.toFixed(4)}
            </p>
            <p className="money-side">
              Stable: {POOLS.stable.holds}, fee {POOLS.stable.fee}. Simple: {POOLS.simple.holds}, fee{" "}
              {POOLS.simple.fee}. Nothing was sent.
            </p>
          </div>
        ) : (
          <p className="money-status">No trade yet. Pick a size, or pick a pool.</p>
        )
      ) : null}

      {step === FLOWS ? (
        <dl className="money-dl" data-testid="intents">
          <Row label="One day">{INTENTS.day} of NEAR Intents trades</Row>
          <Row label="30 days">{INTENTS.month}</Row>
          <Row label="Held on NEAR">{TVL.intentsHeld}</Row>
          <Row label="NEAR DeFi TVL">{TVL.near}</Row>
        </dl>
      ) : null}

      {notes && m.picked ? (
        <p
          className={`money-note${m.picked.result.hint ? " not-yet" : ""}`}
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
