/**
 * What both views show in HTML (2D under the drawing, 3D in the book scene's panel): which intent is
 * replayed, the step's stops on the trail with a link back to the lesson that taught each one, the
 * step's facts and the last pick's note. Same words, same test ids in both views.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { VERIFIER_CONTRACT } from "../../../chain/intents";
import { PICK_LABELS, settleReached, SIGNERS_NOTE, stopsFor } from "./trail";
import { AUTHORIZE, CONTRACT, MAP, SETTLE, SHARDS, type Capstone } from "./useCapstone";

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

const SOURCE_TEXT = {
  yours: "Your own swap from lesson 4.2.",
  "demo-wallet": "Your demo-wallet swap from lesson 4.2 (simulated, no real money).",
  recorded: "A recorded intent: lesson 4.2's recorded quote, replayed. You made no swap in lesson 4.2.",
} as const;

const SETTLE_TEXT = {
  idle: "Not verified yet.",
  solver: "The solver pays out from its own funds.",
  done: "Done. The solver paid out and the trade is settled.",
} as const;

export function Facts({ m, compact = false }: { m: Capstone; compact?: boolean }) {
  const { step, trail } = m;
  const stops = stopsFor(trail, step);
  return (
    <div className={`cap-facts${compact ? " compact" : ""}`}>
      {step === MAP ? (
        <p className="cap-source" data-testid="intent-source" data-source={trail.intent.source}>
          {SOURCE_TEXT[trail.intent.source]}
        </p>
      ) : null}

      {step === AUTHORIZE ? (
        <p className={`cap-status${m.authorized ? " done" : ""}`} data-testid="authorize-status">
          {m.authorized
            ? `Signed by ${trail.name} with the function-call key. The parcel has left your mailbox.`
            : "Not signed yet."}
        </p>
      ) : null}
      {step === SHARDS ? (
        <p className="cap-status done">The receipt moved to the verifier's shard in a later block.</p>
      ) : null}
      {step === CONTRACT ? (
        <dl className="cap-dl" data-testid="gas-split">
          <Row label="Contract">{VERIFIER_CONTRACT}, running as Wasm</Row>
          <Row label="Gas burned" testId="gas-burned">
            all of it
          </Row>
          <Row label="Gas to the contract" testId="gas-to-contract">
            none (until protocol version 86, the contract got 30%)
          </Row>
        </dl>
      ) : null}
      {step === SETTLE ? (
        <>
          <p className={`cap-status${m.settle === "done" ? " done" : ""}`} data-testid="settle-status">
            {SETTLE_TEXT[m.settle]}
          </p>
          {settleReached(m.settle, "done") ? (
            <p data-testid="settle-where">
              {trail.intent.amountOut} USDC, {trail.intent.where}
            </p>
          ) : null}
          <p className="cap-side" data-testid="signers-note">
            {SIGNERS_NOTE}
          </p>
        </>
      ) : null}

      {stops.length ? (
        <ol className="cap-trail" aria-label="The trail" data-testid="trail">
          {stops.map((s) => (
            <li key={s.layer} data-layer={s.layer} data-mine={s.mine ? "yes" : "no"}>
              <span className="cap-stage">Stage {s.stage}</span> <strong>{s.concept}:</strong> {s.value}
              {s.mine ? " (yours)" : ""}.{" "}
              <Link to={`/lesson/${s.lessonId}`} className="cap-back">
                Back to {s.lesson}
              </Link>
            </li>
          ))}
        </ol>
      ) : null}

      {m.picked ? (
        <p
          className={`cap-note${m.picked.result.notYet ? " not-yet" : ""}`}
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
