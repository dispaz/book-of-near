/**
 * Lesson 3.3 pieces both views share: the facts panel (HTML), the latency bars' numbers and the
 * one-sentence description for screen readers. No three.js.
 */
import { HISTORICAL_BLOCK, type RpcEndpointId } from "../../../chain/rpcEndpoints";
import { barShare, hostOf, ms, nameOf, RACE_IDS } from "./race";
import { ARCHIVE, FAILOVER, HOOK, OUTAGE, RACE } from "./steps";
import type { RaceState } from "./useRace";

export interface Bar {
  id: RpcEndpointId;
  /** 0..1 of the tallest bar. */
  share: number;
  label: string;
}

/** The latency bars of the race (drawn from the race step until the failover step). */
export function barsOf(r: RaceState): Bar[] {
  if (r.step < RACE || r.step > FAILOVER) return [];
  const got = RACE_IDS.map((id) => r.answers[id]).filter((p) => !!p);
  const max = Math.max(0, ...got.map((p) => p.latencyMs));
  return got.map((p) => ({
    id: p.endpointId as RpcEndpointId,
    share: barShare(p.latencyMs, max),
    label: p.ok ? `${ms(p.latencyMs)} ms` : "no answer",
  }));
}

/** Short tag under a window. */
export function noteOf(r: RaceState, id: RpcEndpointId): string | undefined {
  const look = r.windowLook(id);
  if (look === "down") return "offline";
  if (look === "shut") return "not found";
  if (r.step === ARCHIVE && id === "archival" && look === "lit") return "found";
  if (r.step === FAILOVER && r.fo?.answeredBy === id) return "answered";
  return undefined;
}

export function describe(r: RaceState): string {
  switch (r.step) {
    case HOOK:
      return "Your app's mailbox in front of three RPC counter windows: FastNEAR, NEAR Foundation and FastNEAR's second address.";
    case RACE:
      return r.raced
        ? `The race is done: ${r.raced.winner ? `${nameOf(r.raced.winner.endpointId)} answered first` : "nobody answered"}. A bar beside each window shows its round trip.`
        : "Three counter windows wait for the same question from your app.";
    case OUTAGE:
      return r.blocked
        ? "FastNEAR's window is dark with an offline sign."
        : "FastNEAR's window is open, first in line.";
    case FAILOVER:
      return r.fo?.answeredBy
        ? `FastNEAR is offline; ${nameOf(r.fo.answeredBy)} answered instead.`
        : "FastNEAR is offline. Your app is about to send a new question.";
    case ARCHIVE:
      return r.hist
        ? "FastNEAR's shutter is down: it does not keep the old block. The archival node's window is lit: it has it."
        : "FastNEAR and an archival node wait for a question about an old block.";
    default:
      return "The book is open at the RPC page.";
  }
}

function Source({ r }: { r: RaceState }) {
  return (
    <p className="rpc-soft" data-testid="rpc-source">
      {r.network === "demo"
        ? "Demo mode: round trips recorded once, on 12 Nov 2026, from one computer. Yours will differ. Switch to testnet to time real requests."
        : "Testnet mode: real requests, timed just now in your browser. The first request to a provider also includes connecting to it."}
    </p>
  );
}

function RaceTable({ r }: { r: RaceState }) {
  return (
    <table className="rpc-table" data-testid="race-table">
      <thead>
        <tr>
          <th scope="col">Provider</th>
          <th scope="col">Round trip</th>
        </tr>
      </thead>
      <tbody>
        {RACE_IDS.map((id) => {
          const p = r.answers[id];
          const off = id === "fastnear" && r.down;
          return (
            <tr
              key={id}
              data-testid={`rpc-row-${id}`}
              className={`${r.picked === id ? "picked" : ""}${off ? " off" : ""}`}
            >
              <td>
                {nameOf(id)}
                <span className="rpc-host">
                  <br />
                  <code>{hostOf(id)}</code>
                </span>
              </td>
              <td>
                {off
                  ? "offline (simulated)"
                  : p
                    ? p.ok
                      ? `${ms(p.latencyMs)} ms`
                      : p.message
                    : r.busy === "race"
                      ? "…"
                      : "–"}
                {p && !off && r.raced?.winner?.endpointId === id ? " · first" : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Attempts({ r }: { r: RaceState }) {
  if (!r.attempts.length) return null;
  return (
    <ol className="rpc-attempts" data-testid="failover-attempts">
      {r.attempts.map((a) => (
        <li key={a.endpointId} className={a.ok ? "ok" : "failed"}>
          <strong>{nameOf(a.endpointId)}</strong>:{" "}
          {a.ok ? `answered in ${ms(a.latencyMs)} ms, ${a.message.toLowerCase()}` : a.message}
        </li>
      ))}
      {r.fo ? (
        <li className="rpc-total" data-testid="failover-total">
          {r.fo.answeredBy
            ? `Answer from ${nameOf(r.fo.answeredBy)} after ${ms(r.fo.totalMs)} ms. Your app stayed online.`
            : "No provider answered."}
        </li>
      ) : null}
    </ol>
  );
}

function History({ r }: { r: RaceState }) {
  const h = r.hist;
  const height = HISTORICAL_BLOCK.height.toLocaleString("en-US");
  if (!h) return <p className="rpc-soft">Question: block #{height}.</p>;
  return (
    <dl className="rpc-list" data-testid="history-result">
      <dt>Regular node (FastNEAR)</dt>
      <dd>
        {h.regular.ok
          ? `block #${h.regular.blockHeight.toLocaleString("en-US")}`
          : `not found (UNKNOWN_BLOCK)`}
      </dd>
      <dt>Archival node</dt>
      <dd>
        {h.archival.ok
          ? `block #${h.archival.blockHeight.toLocaleString("en-US")}, made ${new Date(h.archival.blockTimestampMs).toISOString().slice(0, 10)}`
          : "not found"}
      </dd>
    </dl>
  );
}

export function Facts({ r, compact = false }: { r: RaceState; compact?: boolean }) {
  const { step } = r;
  return (
    <div className={`rpc-facts${compact ? " compact" : ""}`} data-testid="rpc-facts">
      {r.error ? (
        <p className="rpc-warn" role="alert">
          {r.error}
        </p>
      ) : null}
      {step >= RACE && step <= OUTAGE ? <RaceTable r={r} /> : null}
      {step === FAILOVER ? <Attempts r={r} /> : null}
      {step === ARCHIVE ? <History r={r} /> : null}
      {step >= RACE && step <= ARCHIVE && (r.raced || r.busy) ? <Source r={r} /> : null}
      {r.hint ? (
        <p className="rpc-hint" role="status" data-testid="pick-hint">
          {r.hint}
        </p>
      ) : null}
    </div>
  );
}
