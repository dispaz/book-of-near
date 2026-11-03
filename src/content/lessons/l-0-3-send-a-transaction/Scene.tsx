import {
  lazy,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { SceneProps } from "../../../app/types";
import { ActionSlot, SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { useChain } from "../../../chain/ChainContext";
import { totalGasBurnt, totalTokensBurnt } from "../../../chain/ops";
import { formatTgas } from "../../../chain/units";
import type {
  PhaseEvent,
  PracticeAccount,
  SignedTransaction,
  TxOutcome,
  TxPhase,
  UnsignedTransaction,
} from "../../../chain/types";
import {
  duration,
  explorerUrl,
  near,
  short,
  TRANSFER_FEE,
  TRANSFER_HELD,
  TRANSFER_TGAS,
  type KindError,
} from "./tx";
import {
  ACCOUNT,
  BUILD,
  CHECK,
  EXPLORER,
  FEE,
  FINAL,
  HONEST,
  INCLUDED,
  LIGHTS,
  SEND,
  SIGN,
  useTransaction,
  type BalanceStage,
  type Light,
} from "./useTransaction";
import "./scene.css";

/** The 3D view, loaded only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Put the stages in order.",
    options: [
      { text: "Build, sign, broadcast, included, final.", correct: true },
      {
        text: "Sign, build, included, broadcast, final.",
        why: "You must build a transaction before you can sign it, and broadcast it before it can be included.",
      },
      {
        text: "Build, broadcast, sign, final, included.",
        why: "The network rejects unsigned transactions, and a block must include it before it is final.",
      },
    ],
  },
  {
    prompt: "What does an RPC node do?",
    options: [
      {
        text: "It passes your signed transaction into the network and answers questions about the chain.",
        correct: true,
      },
      {
        text: "It holds your private key and signs for you.",
        why: "Signing happens on your device; the RPC node only sees the signed result.",
      },
      {
        text: "It decides the gas price.",
        why: "The network sets the gas price from how full recent blocks were.",
      },
      { text: "It is the website where you look up transactions.", why: "That is a block explorer." },
    ],
  },
  {
    prompt: "Why does each transaction carry a nonce?",
    options: [
      { text: "So the same signed transaction cannot be sent again to move coins twice.", correct: true },
      { text: "To pay the fee.", why: "The fee comes from gas times the gas price." },
      { text: "To hide the amount.", why: "Amounts are public; the nonce is just a counter." },
      { text: "To choose which validator handles it.", why: "The nonce does not pick a validator." },
    ],
  },
];

/**
 * A fresh lesson state per network: switching to demo mode (after a failure, or with the mode switch)
 * starts the transaction again on the new chain.
 */
export default function Scene(props: SceneProps) {
  const chain = useChain();
  const [switched, setSwitched] = useState(false);
  const first = useRef(chain.network);
  useEffect(() => {
    if (chain.network !== first.current) setSwitched(true);
  }, [chain.network]);
  return <TransactionScene key={chain.network} {...props} switched={switched} />;
}

/**
 * One state (useTransaction) drawn two ways. The pipeline, the facts, the status, the docked controls,
 * the check and the honest take are shared; the picture of the accounts and the transaction is either
 * flat cards (2D) or the 3D scene.
 */
function TransactionScene({
  step,
  goTo,
  setGate,
  reducedMotion,
  mode,
  view,
  flat,
  reportEvidence,
  switched,
}: SceneProps & { switched: boolean }) {
  const tx = useTransaction({ step, goTo, setGate, reducedMotion, reportEvidence, switched });
  const { me, receiver, selfSend, events, outcome, testnet, error, built, signed, busy, status } = tx;
  const summary = step >= CHECK;
  const three = view === "3d" && !summary;
  const finalMs = events.final?.atMs;

  const accounts = (
    <Accounts
      narrow={step === INCLUDED || step === FINAL}
      me={me}
      receiver={receiver}
      selfSend={selfSend}
      senderNow={tx.senderNow}
      receiverNow={tx.receiverNow}
      amount={tx.shownAmount}
      stage={tx.stage}
      moving={!!events.included}
      testnet={testnet}
      explain={!three}
    />
  );

  return (
    <>
      <div
        className={`stx${reducedMotion ? " still" : ""}${summary ? " summary" : ""}${three ? " three" : ""}`}
        data-testid="tx-scene"
        data-scene-state={tx.state}
        data-view={view}
        data-mode={mode}
        role="group"
        aria-label="Your transaction, from build to final"
      >
        {summary ? null : three ? (
          // The 3D scene draws the accounts; the same facts stay readable as text for screen readers.
          <div className="visually-hidden">{accounts}</div>
        ) : (
          accounts
        )}

        <Pipeline
          lit={tx.lit}
          events={events}
          failedAt={tx.failedAt}
          litCount={tx.litCount}
          hintFrom={step >= BUILD}
        />

        {three ? (
          <div className="stx-3d" data-testid="tx-3d">
            <Suspense fallback={<p className="stx-3d-loading">Loading the 3D scene…</p>}>
              <Scene3D tx={tx} flat={flat} reducedMotion={reducedMotion} />
            </Suspense>
          </div>
        ) : status ? (
          <p className="stx-status" aria-live="polite" data-testid="scene-status">
            {status}
          </p>
        ) : null}

        {summary ? (
          outcome ? (
            <p className="stx-sum">
              Transaction{" "}
              <code title={outcome.transaction.hash}>{short(outcome.transaction.hash, 8, 6)}</code>{" "}
              {finalMs !== undefined ? <>was final {duration(finalMs)} after Send.</> : null}
            </p>
          ) : null
        ) : (
          <Detail
            step={step}
            me={me}
            receiver={receiver}
            selfSend={selfSend}
            amount={tx.amount}
            built={built}
            signed={signed}
            events={events}
            outcome={outcome}
            nodeName={tx.nodeName}
            start={tx.start}
            finalBalance={tx.finalBalance}
            refund={tx.refund}
            testnet={testnet}
            explored={tx.explored}
            failed={!!error}
            flat={!three}
          />
        )}
      </div>

      {/* Step actions, docked above the lesson card. An error docks there too, where the learner just clicked. */}
      {error ? (
        <ErrorBox
          error={error}
          testnet={testnet}
          rebuild={!!built}
          onDemo={tx.continueInDemo}
          onRetry={tx.startOver}
        />
      ) : null}
      {step === BUILD ? (
        <AmountForm
          value={tx.amountText}
          problem={tx.amountProblem}
          built={!!built}
          ready={!!me && !!receiver}
          busy={busy === "build"}
          onChange={tx.setAmountText}
          onBuild={tx.build}
        />
      ) : null}
      {step === FEE ? (
        <SceneAction onClick={tx.seeFee} disabled={tx.feeSeen}>
          {tx.feeSeen ? "Got it ✓" : "Got it"}
        </SceneAction>
      ) : null}
      {step === SIGN ? (
        <SceneAction onClick={tx.sign} disabled={!built || !!signed || busy !== null}>
          {busy === "sign" ? "Signing…" : signed ? "Signed ✓" : "Sign"}
        </SceneAction>
      ) : null}
      {step === SEND && !error ? (
        <SceneAction onClick={tx.send} disabled={!signed || !!events.broadcast || busy !== null || !!error}>
          {busy === "send" ? "Sending…" : events.broadcast ? "Sent ✓" : "Send"}
        </SceneAction>
      ) : null}
      {step === EXPLORER && tx.sent && outcome ? (
        testnet ? (
          <ExplorerLink hash={outcome.transaction.hash} onOpen={tx.explore} />
        ) : (
          <SceneAction onClick={tx.explore} disabled={tx.explored}>
            Open the demo explorer
          </SceneAction>
        )
      ) : null}
      {(step === EXPLORER || step === HONEST) && !tx.sent ? (
        <SceneAction onClick={() => goTo(signed ? SEND : built ? SIGN : BUILD)}>
          Go back and send it
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={tx.passed}
          onPass={() => {
            tx.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith={["Ethereum", "Bitcoin"]}
          strengths={[
            "Fast finality. NEAR's docs give finality (the point a block can no longer change) at about 1.2 seconds. ethereum.org says an Ethereum block takes about 15 minutes to finalize. Bitcoin has no fixed point; confidence grows as blocks are added on top.",
            "Low, predictable fees. Each action has a fixed gas cost. A transfer is 0.45 Tgas, about 0.000045 NEAR at the minimum gas price. The price moves at most 1% per block. Paying for extra gas does not make a transaction faster.",
            "You choose how long to wait. NEAR's RPC lets an app get an answer at any stage, from sent to final, so apps can show progress honestly, as this lesson did.",
          ]}
          weaknesses={[
            "Sent is not done. NEAR's docs warn that a successful reply from the RPC node does not prove the later steps succeeded. Apps must check the final status. The default wait level is not full finality.",
            "You trust your RPC node. Most apps read the chain through a node someone else runs. A faulty or busy node can be slow or wrong. This is true on Ethereum and Bitcoin too.",
            "The balance dance confuses beginners. NEAR holds about ten times the final fee up front for a transfer, then gives the extra back a block later.",
            "The docs disagree on block time. One page says about 600 ms, another about one second. Treat any single figure as approximate.",
          ]}
        />
      ) : null}
    </>
  );
}

// ---------- Accounts ----------

function Accounts({
  narrow,
  me,
  receiver,
  selfSend,
  senderNow,
  receiverNow,
  amount,
  stage,
  moving,
  testnet,
  explain,
}: {
  /** Also show on narrow screens (where balances move); otherwise wide screens only. */
  narrow: boolean;
  me: PracticeAccount | null;
  receiver: string | null;
  selfSend: boolean;
  senderNow: bigint | null;
  receiverNow: bigint | null;
  amount: bigint | null;
  stage: BalanceStage;
  moving: boolean;
  testnet: boolean;
  /** The sender card is what the first step's note points at (2D only; 3D points at the account block). */
  explain: boolean;
}) {
  return (
    <div className={`stx-accounts${narrow ? "" : " wide-only"}`}>
      <section
        className="stx-acct"
        aria-label="Your practice account"
        data-explain={explain ? "account" : undefined}
      >
        <p className="stx-acct-role">
          From · your practice account <span className="stx-net">{testnet ? "testnet" : "demo"}</span>
        </p>
        <p className="stx-acct-id" title={me?.accountId} data-testid="sender-id">
          {me ? short(me.accountId, 6, 4) : "…"}
        </p>
        <p className="stx-acct-bal">
          <strong data-testid="sender-balance" key={`${stage}-${String(senderNow)}`} className="stx-num">
            {senderNow === null ? "…" : `${stage === "included" ? "≈ " : ""}${near(senderNow)}`}
          </strong>
          {stage === "included" ? <span className="stx-tag">gas held</span> : null}
          {stage === "final" ? <span className="stx-tag">refund back</span> : null}
        </p>
      </section>
      <div className={`stx-arrow${moving ? " moving" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 60 24">
          <path d="M4 12 H52 M44 5 L53 12 L44 19" />
        </svg>
        <span>{amount !== null ? near(amount) : ""}</span>
      </div>
      <section className="stx-acct" aria-label="Receiver">
        <p className="stx-acct-role">To · {selfSend ? "your own account" : "the app's return account"}</p>
        <p className="stx-acct-id" title={receiver ?? undefined} data-testid="receiver-id">
          {receiver ? short(receiver, 6, 4) : "…"}
        </p>
        <p className="stx-acct-bal">
          {selfSend ? (
            <span className="stx-note">Sent back to you until the app's return account is set.</span>
          ) : (
            <strong data-testid="receiver-balance" key={String(receiverNow)} className="stx-num">
              {receiverNow === null ? "…" : near(receiverNow)}
            </strong>
          )}
        </p>
      </section>
    </div>
  );
}

// ---------- Pipeline ----------

function Pipeline({
  lit,
  events,
  failedAt,
  litCount,
  hintFrom,
}: {
  lit: Record<Light, boolean>;
  events: Partial<Record<TxPhase, PhaseEvent>>;
  failedAt?: Light;
  litCount: number;
  /** Pulse the next light only once the learner can act on it. */
  hintFrom: boolean;
}) {
  const at = Math.max(0, litCount - 1);
  return (
    <div className="stx-pipe-wrap">
      <ol
        className="stx-pipe"
        data-testid="pipeline"
        aria-label="Transaction stages"
        style={{ "--at": at } as CSSProperties}
      >
        {LIGHTS.map(({ phase, label }, i) => {
          const e = events[phase];
          const time =
            phase === "built" || phase === "signed"
              ? lit[phase]
                ? phase === "built"
                  ? "done"
                  : "on device"
                : ""
              : e
                ? `+${duration(e.atMs)}`
                : "";
          const isNext = hintFrom && !lit[phase] && i === litCount;
          const failed = failedAt === phase;
          return (
            <li
              key={phase}
              data-phase={phase}
              data-lit={lit[phase] ? "true" : "false"}
              className={`${lit[phase] ? "lit" : ""}${isNext && !failed ? " next" : ""}${failed ? " failed" : ""}`}
              aria-label={`${label}: ${failed ? "failed" : lit[phase] ? `done${time ? `, ${time}` : ""}` : "not yet"}`}
            >
              <span className="stx-dot" aria-hidden="true">
                <StageIcon phase={phase} />
              </span>
              <span className="stx-name">{label}</span>
              <span className="stx-ms" data-testid={`time-${phase}`}>
                {failed ? "failed" : time || " "}
              </span>
              {e?.status && e.status !== "NONE" ? <span className="stx-rpc">{e.status}</span> : null}
            </li>
          );
        })}
        {litCount > 0 ? (
          <li className="stx-envelope" aria-hidden="true">
            <svg viewBox="0 0 28 20">
              <rect x="1.5" y="1.5" width="25" height="17" rx="2" />
              <path d="M2 3 L14 11 L26 3" />
            </svg>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

/** Small ink icons inside the pipeline dots. */
function StageIcon({ phase }: { phase: Light }) {
  return (
    <svg viewBox="0 0 24 24">
      {phase === "built" ? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 8 H16 M8 12 H16 M8 16 H13" />
        </>
      ) : phase === "signed" ? (
        <>
          <circle cx="8" cy="12" r="4" />
          <path d="M12 12 H21 M18 12 V16 M15 12 V15" />
        </>
      ) : phase === "broadcast" ? (
        <>
          <circle cx="12" cy="17" r="2" />
          <path d="M8 13 A5.5 5.5 0 0 1 16 13 M5 10 A9.5 9.5 0 0 1 19 10" />
        </>
      ) : phase === "included" ? (
        <>
          <rect x="4" y="7" width="16" height="12" rx="2" />
          <path d="M4 11 H20 M9 7 V4 H15 V7" />
        </>
      ) : (
        <>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10 V7 A4 4 0 0 1 16 7 V10" />
        </>
      )}
    </svg>
  );
}

// ---------- What happens at this step ----------

function Field({
  label,
  children,
  testId,
  wide,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
  wide?: boolean;
}) {
  return (
    <div className={`stx-field${wide ? " wide" : ""}`}>
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </div>
  );
}

function Detail({
  step,
  me,
  receiver,
  selfSend,
  amount,
  built,
  signed,
  events,
  outcome,
  nodeName,
  start,
  finalBalance,
  refund,
  testnet,
  explored,
  failed,
  flat,
}: {
  step: number;
  me: PracticeAccount | null;
  receiver: string | null;
  selfSend: boolean;
  amount: bigint | null;
  built: UnsignedTransaction | null;
  signed: SignedTransaction | null;
  events: Partial<Record<TxPhase, PhaseEvent>>;
  outcome: TxOutcome | null;
  nodeName: string;
  start: bigint | null;
  finalBalance: bigint | null;
  refund: bigint | null;
  testnet: boolean;
  explored: boolean;
  /** Sending stopped with an error. */
  failed: boolean;
  /** 2D view: these facts are also what the step's note points at (3D points at its objects instead). */
  flat: boolean;
}) {
  const pending = <span className="stx-pending">fills in when you press Build</span>;
  const mark = (name: string) => (flat ? name : undefined);
  if (step === ACCOUNT)
    return (
      <section className="stx-detail" aria-label="Practice account">
        <p className="stx-detail-title">Your practice account</p>
        <dl>
          <Field label="Address" testId="account-id" wide>
            <code>{me?.accountId ?? "…"}</code>
          </Field>
          <Field label="Balance" testId="practice-balance">
            {start === null ? "…" : near(start)}
          </Field>
          <Field label="Network">
            {testnet ? "NEAR testnet (free coins, no value)" : "Demo mode (in your browser)"}
          </Field>
          <Field label="You will send to">
            <code title={receiver ?? undefined}>{receiver ? short(receiver, 8, 6) : "…"}</code>
            {selfSend ? (
              <span className="stx-note"> (yourself, until the app's return account is set)</span>
            ) : null}
          </Field>
        </dl>
      </section>
    );
  if (step === BUILD)
    return (
      <section className="stx-detail" aria-label="The transaction" data-explain={mark("tx")}>
        <p className="stx-detail-title">The transaction{built ? "" : " (not built yet)"}</p>
        <dl>
          <Field label="Nonce" testId="tx-nonce">
            {built ? <code>{built.nonce.toString()}</code> : pending}
          </Field>
          <Field label="Recent block hash" testId="tx-block-hash" wide>
            {built ? <code title={built.blockHash}>{built.blockHash}</code> : pending}
          </Field>
          <Field label="Action">{built && amount !== null ? `Transfer ${near(amount)}` : "Transfer"}</Field>
          <Field label="Receiver" testId="tx-receiver">
            <code title={receiver ?? undefined}>{receiver ? short(receiver, 8, 6) : "…"}</code>
            {selfSend ? <span className="stx-note"> (yourself)</span> : null}
          </Field>
          <Field label="Sender">
            <code title={me?.accountId}>{me ? short(me.accountId, 8, 6) : "…"}</code>
          </Field>
        </dl>
      </section>
    );
  if (step === FEE)
    return (
      <section
        className="stx-detail"
        aria-label="Gas and fee"
        data-testid="fee-panel"
        data-explain={mark("fee")}
      >
        <p className="stx-detail-title">Gas and the fee for one transfer</p>
        <dl>
          <Field label="Gas">{TRANSFER_TGAS} Tgas (1 Tgas = 10¹² gas)</Field>
          <Field label="Fee at the minimum price">{near(TRANSFER_FEE)}</Field>
          <Field label="Held up front">about {near(TRANSFER_HELD)}</Field>
          <Field label="Refund">the difference, about {near(TRANSFER_HELD - TRANSFER_FEE)}</Field>
        </dl>
        {testnet ? <p className="stx-note">Your real fee shows after Final.</p> : null}
      </section>
    );
  if (step === SIGN)
    return (
      <section className="stx-detail" aria-label="Signature" data-explain={mark("sign")}>
        <p className="stx-detail-title">Signed on your device</p>
        <dl>
          <Field label="Transaction ID (its hash)" testId="tx-hash" wide>
            {signed ? (
              <code>{signed.hash}</code>
            ) : (
              <span className="stx-pending">appears when you press Sign</span>
            )}
          </Field>
          <Field label="Signature" testId="tx-signature" wide>
            {signed ? (
              <code title={signed.signature}>{short(signed.signature, 20, 6)}</code>
            ) : (
              <span className="stx-pending">…</span>
            )}
          </Field>
          <Field label="Signed with">
            <code title={built?.publicKey}>{built ? short(built.publicKey, 14, 4) : "…"}</code>
          </Field>
        </dl>
      </section>
    );
  if (step === SEND)
    return (
      <section className="stx-detail" aria-label="Broadcast" data-explain={mark("rpc")}>
        <p className="stx-detail-title">Broadcast through an RPC node</p>
        <dl>
          <Field label="RPC node" testId="tx-node" wide>
            {nodeName}
          </Field>
          <Field label="Handed to the node" testId="tx-accepted">
            {events.broadcast ? (
              `+${duration(events.broadcast.atMs)}`
            ) : (
              <span className="stx-pending">press Send</span>
            )}
          </Field>
          <Field label="Node's latest answer" testId="tx-rpc-status">
            {events.final
              ? `FINAL at +${duration(events.final.atMs)}`
              : events.included
                ? `INCLUDED at +${duration(events.included.atMs)}`
                : events.broadcast
                  ? failed
                    ? "no answer"
                    : "waiting…"
                  : "—"}
          </Field>
        </dl>
      </section>
    );
  if (step === INCLUDED)
    return (
      <section className="stx-detail" aria-label="Included in a block" data-explain={mark("block")}>
        <p className="stx-detail-title">Included in a block</p>
        {events.included ? (
          <div className="stx-block" data-testid="inclusion-block">
            <span className="stx-block-n">Block #{events.included.blockHeight}</span>
            <code title={events.included.blockHash}>{short(events.included.blockHash ?? "", 8, 6)}</code>
            <span className="stx-block-tx">your transfer is inside</span>
          </div>
        ) : null}
        <dl>
          <Field label="Block height" testId="tx-height">
            {events.included ? (
              `#${events.included.blockHeight}`
            ) : (
              <span className="stx-pending">waiting…</span>
            )}
          </Field>
          <Field label="In a block after" testId="tx-included-ms">
            {events.included ? duration(events.included.atMs) : "…"}
          </Field>
        </dl>
      </section>
    );
  if (step === FINAL)
    return (
      <section className="stx-detail" aria-label="Final">
        <p className="stx-detail-title">Final</p>
        <p className="stx-stopwatch" data-explain={mark("final")}>
          <span data-testid="time-to-final">{events.final ? duration(events.final.atMs) : "…"}</span>
          <small>from Send to Final{testnet ? ", measured just now" : " (recorded demo timing)"}</small>
        </p>
        <dl>
          <Field label="Fee paid" testId="tx-fee">
            {outcome ? near(totalTokensBurnt(outcome), 8) : "…"}
          </Field>
          <Field label="Gas used">{outcome ? `${formatTgas(totalGasBurnt(outcome))} Tgas` : "…"}</Field>
          <Field label="Balance now" testId="final-balance">
            {finalBalance !== null ? near(finalBalance) : "…"}
          </Field>
          {refund !== null && refund > 0n && start !== null ? (
            <Field label="Gas refund">about {near(refund)}</Field>
          ) : null}
        </dl>
        <ul className="stx-compare" aria-label="Time to final on three chains">
          <li>
            <strong>NEAR</strong> about 1.2 s (block about 0.6 s)
          </li>
          <li>
            <strong>Ethereum</strong> about 15 min (block 12 s)
          </li>
          <li>
            <strong>Bitcoin</strong> no fixed point (block about 10 min)
          </li>
        </ul>
      </section>
    );
  if (step === EXPLORER && outcome) {
    const url = explorerUrl(outcome.transaction.hash);
    if (testnet)
      return (
        <section className="stx-detail" aria-label="Block explorer" data-explain={mark("explorer")}>
          <p className="stx-detail-title">Your transaction on NearBlocks</p>
          <p>
            <a href={url} target="_blank" rel="noreferrer" data-testid="explorer-url">
              {url}
            </a>
          </p>
          {explored ? (
            <p className="stx-note">Opened in a new tab. It may take a few seconds to appear there.</p>
          ) : null}
        </section>
      );
    return (
      <section className="stx-detail" aria-label="Block explorer" data-explain={mark("explorer")}>
        <p className="stx-detail-title">{explored ? "Demo explorer (not NearBlocks)" : "Block explorer"}</p>
        {explored ? (
          <dl className="stx-explorer" data-testid="demo-explorer">
            <Field label="Transaction hash" wide>
              <code>{outcome.transaction.hash}</code>
            </Field>
            <Field label="Status">{outcome.status.type === "Failure" ? "Failed" : "Success"}</Field>
            <Field label="Block">#{outcome.transactionOutcome.blockHeight}</Field>
            <Field label="From">
              <code title={outcome.transaction.signerId}>{short(outcome.transaction.signerId, 8, 6)}</code>
            </Field>
            <Field label="To">
              <code>{short(outcome.transaction.receiverId, 8, 6)}</code>
            </Field>
            <Field label="Amount">{amount !== null ? near(amount) : "…"}</Field>
            <Field label="Fee">{near(totalTokensBurnt(outcome), 8)}</Field>
          </dl>
        ) : null}
        <p className="stx-note" data-testid="explorer-note">
          In demo mode this transaction lives only in your browser, so NearBlocks has never seen it. On
          testnet the button opens{" "}
          <a aria-disabled="true" className="stx-dead-link" data-testid="explorer-url">
            {url}
          </a>
          .
        </p>
      </section>
    );
  }
  return null;
}

// ---------- Docked controls ----------

/** Amount box + Build, docked above the lesson card. Enter submits. */
function AmountForm({
  value,
  problem,
  built,
  ready,
  busy,
  onChange,
  onBuild,
}: {
  value: string;
  problem: string | null;
  built: boolean;
  ready: boolean;
  busy: boolean;
  onChange: (t: string) => void;
  onBuild: () => void;
}) {
  const slot = useContext(ActionSlot);
  const form = (
    <form
      className="stx-form"
      aria-label="Build the transaction"
      onSubmit={(e) => {
        e.preventDefault();
        onBuild();
      }}
    >
      <div className="stx-form-row">
        <label>
          <span>Amount</span>
          <input
            inputMode="decimal"
            value={value}
            size={6}
            disabled={built || busy}
            aria-describedby={problem ? "stx-amount-problem" : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          <span>NEAR</span>
        </label>
        <button type="submit" className="btn primary" disabled={built || busy || !ready}>
          {busy ? "Building…" : built ? "Built ✓" : "Build"}
        </button>
      </div>
      {problem ? (
        <p className="stx-form-error" role="alert" id="stx-amount-problem">
          {problem}
        </p>
      ) : (
        <p className="stx-form-hint">From 0.001 to 0.1 NEAR.</p>
      )}
    </form>
  );
  return slot ? createPortal(form, slot) : form;
}

/** A clear, kind error with a way forward: demo mode (on testnet) or a fresh transaction. */
function ErrorBox({
  error,
  testnet,
  rebuild,
  onDemo,
  onRetry,
}: {
  error: KindError;
  testnet: boolean;
  rebuild: boolean;
  onDemo: () => void;
  onRetry: () => void;
}) {
  const slot = useContext(ActionSlot);
  const box = (
    <div className="stx-error" role="alert" data-testid="tx-error">
      <p className="stx-error-title">{error.title}</p>
      <p>{error.detail}</p>
      <div className="stx-error-actions">
        {testnet ? (
          <button type="button" className="btn primary" onClick={onDemo}>
            Continue in demo mode
          </button>
        ) : null}
        <button type="button" className="btn" onClick={onRetry}>
          {rebuild ? "Build a new one" : "Try again"}
        </button>
      </div>
    </div>
  );
  return slot ? createPortal(box, slot) : box;
}

/** The real explorer link on testnet, styled like the step buttons. */
function ExplorerLink({ hash, onOpen }: { hash: string; onOpen: () => void }) {
  const slot = useContext(ActionSlot);
  const link = (
    <a className="btn primary" href={explorerUrl(hash)} target="_blank" rel="noreferrer" onClick={onOpen}>
      Open in NearBlocks
    </a>
  );
  return slot ? createPortal(link, slot) : link;
}
