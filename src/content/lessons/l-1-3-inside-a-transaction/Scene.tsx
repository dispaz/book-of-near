import { lazy, Suspense, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SceneProps } from "../../../app/types";
import { ActionSlot, SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { useChain } from "../../../chain/ChainContext";
import type { SignedTransaction } from "../../../chain/types";
import { ObjectIcon } from "../../../scene-kit/svg/objects";
import { COLORS } from "../../../scene-kit/theme";
import { nearAmount as near, shortId as short } from "../../../ui/format";
import { FATE_TEXT, ITEM_NAME, SHORT_NAME, describeAction, itemText, type ItemKind } from "./batch";
import { replayWhy } from "./replay";
import {
  BREAK,
  BUILD,
  CHECK,
  HONEST,
  HOOK,
  OPEN,
  REPLAY,
  useTxLesson,
  type Lesson,
  type Sent,
} from "./useTxLesson";
import "./scene.css";

/** The 3D view, loaded only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

const QUESTIONS: CheckQuestion[] = [
  {
    prompt:
      "A transaction creates an account, sends it NEAR, then adds a key the account already has. What is left afterwards?",
    options: [
      { text: "No new account. The NEAR came back; only the fee is spent.", correct: true },
      {
        text: "The account exists with the NEAR, but without the key.",
        why: "The actions of one transaction stand or fall together, so the first two were undone.",
      },
      {
        text: "Nothing at all, not even the fee.",
        why: "The work up to the failure was done, so the fee is still paid.",
      },
    ],
  },
  {
    prompt: "Why did your old transaction not run again when you sent it a second time?",
    options: [
      { text: "Its nonce was already used by that key.", correct: true },
      {
        text: "Its signature wore out.",
        why: "A signature does not wear out. What counts is that its nonce was used.",
      },
      {
        text: "Someone else had sent it first.",
        why: "Nobody else sent it. Your own first send used up the nonce.",
      },
    ],
  },
  {
    prompt: "Can one NEAR transaction act on two different accounts?",
    options: [
      { text: "No. All its actions go to its one receiver.", correct: true },
      {
        text: "Yes, each action can name its own account.",
        why: "A transaction has exactly one receiver.",
      },
    ],
  },
];

/** One state (useTxLesson) drawn two ways; the controls, check and honest take are shared. */
export default function Scene(props: SceneProps) {
  const chain = useChain();
  // A fresh lesson per network: switching to demo mode starts the lesson again on the new chain.
  return <TxScene key={chain.network} {...props} />;
}

function TxScene({ step, setGate, setVars, reducedMotion, mode, view, flat, reportEvidence }: SceneProps) {
  const lesson = useTxLesson({ step, setGate, setVars, reducedMotion, reportEvidence });
  const summary = step >= CHECK;
  const three = view === "3d" && !summary;

  return (
    <>
      <div
        className={`tl scroll-fade-narrow step-${step}${reducedMotion ? " still" : ""}${summary ? " summary" : ""}${three ? " three" : ""}`}
        data-testid="tx-scene"
        data-scene-state={lesson.state}
        data-view={view}
        data-mode={mode}
        role="group"
        aria-label="A transaction, its actions and what the chain did with them"
      >
        {summary ? (
          <Summary lesson={lesson} />
        ) : three ? (
          <>
            <div className="tl-3d" data-testid="tx-3d">
              <Suspense fallback={<p className="tl-3d-loading">Loading the 3D scene…</p>}>
                <Scene3D lesson={lesson} flat={flat} reducedMotion={reducedMotion} />
              </Suspense>
            </div>
            <div className="tl-under">
              <Panels lesson={lesson} marks={false} />
            </div>
          </>
        ) : (
          <>
            <Panels lesson={lesson} marks />
            {lesson.status ? (
              <p className="tl-status" aria-live="polite" data-testid="scene-status">
                {lesson.status}
              </p>
            ) : null}
          </>
        )}
      </div>

      {lesson.error ? (
        <Docked>
          <div className="tl-error" role="alert" data-testid="tx-error">
            <p className="tl-error-title">That did not work</p>
            <p>{lesson.error.text}</p>
            {lesson.error.demo && lesson.network !== "demo" ? (
              <button type="button" className="btn" onClick={lesson.continueInDemo}>
                Continue in demo mode
              </button>
            ) : null}
          </div>
        </Docked>
      ) : null}
      {step === OPEN ? (
        <SceneAction onClick={() => void lesson.makeWorkshop()} disabled={!lesson.canMake}>
          {lesson.busy === "workshop"
            ? "Making it…"
            : lesson.workshop
              ? lesson.workshop.reused
                ? "Already made ✓"
                : "Made ✓"
              : "Make the workshop account"}
        </SceneAction>
      ) : null}
      {(step === BUILD || step === BREAK) && lesson.workshop ? (
        <Builder lesson={lesson} breaking={step === BREAK} />
      ) : null}
      {step === REPLAY && lesson.worked ? <ReplayControls lesson={lesson} /> : null}
      {step > OPEN && step < CHECK && !lesson.workshop ? (
        <p className="tl-need" role="status">
          There is no workshop account yet. Go back and make it first.
        </p>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={lesson.passed}
          onPass={() => {
            lesson.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith="Ethereum"
          strengths={[
            "Batching is built in. A NEAR transaction is a list of actions. They run in the order given, and if one fails none of them take effect.",
            "Account changes are plain actions. Creating an account, sending NEAR and adding a key need no contract.",
            "Two guards against copies. The nonce makes a used transaction worthless, and the block hash gives every transaction a deadline.",
          ]}
          weaknesses={[
            "One receiver per transaction. To act on two accounts you need two transactions, or a contract that calls others.",
            "All-or-nothing covers one account's actions only. When a contract calls another contract, that call runs later, in another block, and if it fails the earlier work stays done (Stage 2 shows this).",
            "A failed transaction still costs a fee.",
            "The deadline cuts both ways. A transaction signed now must be sent within a set number of blocks (86,400 in NEAR's docs example, about 14 hours), which makes slow signing setups harder.",
            "Ethereum is closing the gap. A plain Ethereum transaction has one recipient and one call. EIP-7702, part of Ethereum's Pectra upgrade, lets a plain account borrow a contract's code, so it can batch calls such as approve and transferFrom when its wallet supports it.",
          ]}
        />
      ) : null}
    </>
  );
}

// ---------- shared pieces ----------

/** Puts a control in the dock above the lesson card, where step actions live. */
function Docked({ children }: { children: ReactNode }) {
  const slot = useContext(ActionSlot);
  return slot ? createPortal(children, slot) : <>{children}</>;
}

/** The step's note points at these through `data-explain` (3D marks the same names with anchors). */
const mark = (marks: boolean, name: string) => (marks ? { "data-explain": name } : {});

/** What the scene shows at each step: the transaction card, the result and the replay log. */
function Panels({ lesson, marks }: { lesson: Lesson; marks: boolean }) {
  const { step } = lesson;
  return (
    // The panel the step's note points at comes first, next to the note on wide screens.
    <div className="tl-panels">
      {step === BREAK ? <Result sent={lesson.last} marks={marks} /> : null}
      {step === REPLAY ? <ReplayLog lesson={lesson} marks={marks} /> : null}
      <TxCard lesson={lesson} marks={marks} />
      {step === BUILD ? <Result sent={lesson.last} marks={marks} /> : null}
    </div>
  );
}

function TxCard({ lesson, marks }: { lesson: Lesson; marks: boolean }) {
  const { step, shown, workshop, workshopBalance } = lesson;
  const name = step === HOOK ? "tx" : step === BUILD ? "builder" : "fields";
  return (
    <section className="tl-card tl-tx" aria-label="The transaction" {...mark(marks, name)}>
      <p className="tl-role">
        <ObjectIcon kind="parcel" size={18} />{" "}
        {step <= OPEN ? "A transaction" : step === REPLAY ? "Your first batch" : "Your batch"}
      </p>
      {step === REPLAY && lesson.worked ? (
        <Fields tx={lesson.worked.signed} />
      ) : shown && step !== HOOK ? (
        <Fields tx={shown} />
      ) : (
        <Sketch />
      )}
      {step === OPEN && workshop?.reused && !workshop.outcome ? (
        <p className="tl-dim">
          You made {workshop.id} on an earlier visit, so the lesson uses it again. Its transaction is not at
          hand here; the next step shows a new one, field by field.
        </p>
      ) : null}
      {workshop && step >= OPEN ? (
        <p className="tl-line tl-acct">
          Workshop account <b>{workshop.id}</b>
          {workshopBalance !== null ? <> · {near(workshopBalance)} NEAR</> : null}
        </p>
      ) : null}
    </section>
  );
}

/** An empty transaction: its parts, with three action slots. */
function Sketch() {
  return (
    <dl className="tl-fields sketch">
      <dt>Signer</dt>
      <dd>who signs and pays</dd>
      <dt>Receiver</dt>
      <dd>the one account it acts on</dd>
      <dt>Actions</dt>
      <dd>
        <ol className="tl-slots">
          <li>action 1</li>
          <li>action 2</li>
          <li>action 3</li>
        </ol>
      </dd>
      <dt>Nonce</dt>
      <dd>…</dd>
      <dt>Block hash</dt>
      <dd>…</dd>
    </dl>
  );
}

function Fields({ tx }: { tx: SignedTransaction }) {
  // A receiver that is called (the registrar) is a contract: a scroll. A plain account is a mailbox.
  const called = tx.actions.some((a) => a.type === "FunctionCall");
  return (
    <dl className="tl-fields" data-testid="tx-fields">
      <dt>Signer</dt>
      <dd title={tx.signerId}>
        <ObjectIcon kind="mailbox" size={18} /> {short(tx.signerId, 14, 8)}
      </dd>
      <dt>Receiver</dt>
      <dd title={tx.receiverId}>
        <ObjectIcon kind={called ? "scroll" : "mailbox"} size={18} color={called ? undefined : COLORS.blue} />{" "}
        {short(tx.receiverId, 18, 10)}
      </dd>
      <dt>Actions</dt>
      <dd>
        <ol className="tl-acts">
          {tx.actions.map((a, i) => (
            <li key={i}>{describeAction(a)}</li>
          ))}
        </ol>
      </dd>
      <dt>Nonce</dt>
      <dd>
        <code>{tx.nonce.toString()}</code>
        <span className="tl-note">the key's counter, +1 each time</span>
      </dd>
      <dt>Block hash</dt>
      <dd>
        <code title={tx.blockHash}>{short(tx.blockHash, 8, 6)}</code>
        <span className="tl-note">a recent block: sets a deadline</span>
      </dd>
      <dt>Transaction id</dt>
      <dd>
        <code title={tx.hash}>{short(tx.hash, 8, 6)}</code>
      </dd>
    </dl>
  );
}

function Result({ sent, marks }: { sent: Sent | null; marks: boolean }) {
  return (
    <section
      className={`tl-card tl-result ${sent ? (sent.ok ? "ok" : "no") : "none"}`}
      aria-label="What the chain did"
      data-testid="tx-result"
      {...mark(marks, "result")}
    >
      <p className="tl-role">
        <ObjectIcon kind="mailbox" size={18} color={COLORS.blue} /> What the chain did
      </p>
      {!sent ? (
        <p className="tl-dim">Nothing sent yet.</p>
      ) : (
        <>
          <p className="tl-line">
            <span className={`tl-badge ${sent.ok ? "ok" : "no"}`}>{sent.ok ? "Accepted" : "Failed"}</span>{" "}
            Batch {sent.n} to <b>{sent.receiver}</b>
          </p>
          <ol className="tl-fates" aria-label="What happened to each action">
            {sent.items.map((item, i) => {
              const fate = sent.fates[i] ?? "skipped";
              return (
                <li key={item.id} className={fate}>
                  <span className="tl-fate">{FATE_TEXT[fate]}</span>{" "}
                  {itemText(item.kind, near(sent.amount), short(sent.receiver, 14, 8))}
                </li>
              );
            })}
          </ol>
          {sent.failure ? <p className="tl-why">{sent.failure}</p> : null}
          {sent.ok ? (
            <p className="tl-line">
              {sent.receiver} exists
              {sent.receiverBalance !== null ? <> and holds {near(sent.receiverBalance)} NEAR</> : null}. One
              fee, paid by the workshop account: {near(sent.before - sent.after - sent.deposit)} NEAR.
            </p>
          ) : (
            <p className="tl-line">
              {sent.existedBefore
                ? `${sent.receiver} already existed, and it is as it was before.`
                : sent.existsAfter
                  ? `${sent.receiver} exists.`
                  : `${sent.receiver} was not created.`}{" "}
              Only the fee was paid: {near(sent.before - sent.after)} NEAR.
              {sent.deposit > 0n ? ` The ${near(sent.deposit)} NEAR it was sent came back.` : ""}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ReplayLog({ lesson, marks }: { lesson: Lesson; marks: boolean }) {
  return (
    <section
      className="tl-card tl-replay"
      aria-label="Copies sent again"
      data-testid="replay-log"
      {...mark(marks, "replay")}
    >
      <p className="tl-role">
        <ObjectIcon kind="parcel" size={18} /> Sent again, unchanged
      </p>
      {lesson.replays.length === 0 ? <p className="tl-dim">Nothing sent again yet.</p> : null}
      <ol>
        {[...lesson.replays].reverse().map((r) => (
          <li key={r.n} className={r.notRun ? "no" : "ok"}>
            <span className={`tl-badge ${r.notRun ? "no" : "ok"}`}>{r.notRun ? "Not run again" : "Ran"}</span>{" "}
            The batch that {r.which}, nonce <code>{r.txNonce.toString()}</code>.
            {r.notRun ? (
              <span className="tl-why">
                {r.reason ? <code>{r.reason} </code> : null}
                {replayWhy(r)}
              </span>
            ) : (
              <span className="tl-why">{r.message}</span>
            )}
          </li>
        ))}
      </ol>
      <p className="tl-dim">
        A real node answers an exact copy with the first result; the app checks the nonce first, so you see
        why. The block hash is a second guard: after a set number of blocks, even an unused transaction
        expires.
      </p>
    </section>
  );
}

function Summary({ lesson }: { lesson: Lesson }) {
  if (!lesson.worked) return null;
  return (
    <p className="tl-sum">
      Your batch made {lesson.worked.receiver}.{" "}
      {lesson.broke ? `The broken one left nothing behind (${lesson.broke.receiver}). ` : ""}
      {lesson.notRun.length ? `${lesson.notRun.length} copies sent again; none ran.` : ""}
    </p>
  );
}

// ---------- docked controls ----------

/** Short chip labels, so the builder stays small on phones; the accessible names are the full ones. */
const CHIP_NAME: Record<ItemKind, string> = {
  create: "Create",
  transfer: "Send NEAR",
  addkey: "Add key",
  again: "Same key again",
};

function Builder({ lesson, breaking }: { lesson: Lesson; breaking: boolean }) {
  const kinds: ItemKind[] = breaking
    ? ["create", "transfer", "addkey", "again"]
    : ["create", "transfer", "addkey"];
  const locked = lesson.busy !== null;
  const done = breaking ? !!lesson.broke : !!lesson.worked;
  return (
    <Docked>
      <form
        className="tl-form"
        aria-label="Build the transaction"
        onSubmit={(e) => {
          e.preventDefault();
          void lesson.send();
        }}
      >
        <div className="tl-form-row">
          <label className="tl-name">
            <span className="visually-hidden">New account name</span>
            <input
              aria-label="New account name"
              value={lesson.label}
              size={7}
              disabled={locked}
              onChange={(e) => lesson.setLabel(e.target.value)}
            />
            <span className="tl-suffix" title={lesson.workshop?.id}>
              .{short(lesson.workshop?.id ?? "", 10, 8)}
            </span>
          </label>
          <label>
            <span className="visually-hidden">Amount to send</span>
            <input
              aria-label="Amount to send"
              inputMode="decimal"
              value={lesson.amountText}
              size={5}
              disabled={locked}
              onChange={(e) => lesson.setAmountText(e.target.value)}
            />
            <span>NEAR</span>
          </label>
        </div>
        <ol className="tl-rows" aria-label="Actions in this transaction">
          {lesson.items.length === 0 ? <li className="tl-dim">No actions yet. Add some above.</li> : null}
          {lesson.items.map((item, i) => (
            <li key={item.id} className={item.kind === "again" ? "again" : undefined}>
              <span className="tl-n">{i + 1}</span>
              <span className="tl-what">
                {itemText(item.kind, lesson.amountText.trim() || "?", lesson.label.trim() || "?")}
              </span>
              <span className="tl-what-short" aria-hidden="true">
                {SHORT_NAME[item.kind]}
              </span>
              <button
                type="button"
                aria-label={`Move action ${i + 1} up`}
                disabled={locked || i === 0}
                onClick={() => lesson.moveItem(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move action ${i + 1} down`}
                disabled={locked || i === lesson.items.length - 1}
                onClick={() => lesson.moveItem(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove action ${i + 1}`}
                disabled={locked}
                onClick={() => lesson.removeItem(i)}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
        {lesson.problem ? (
          <p className="tl-form-error" role="alert">
            {lesson.problem}
          </p>
        ) : (
          <p className="tl-form-hint">
            {breaking ? "The last action adds the same key again." : "One transaction, signed once."}
          </p>
        )}
        {/* The add buttons and Send stay at the bottom, so adding rows never moves them under the pointer. */}
        <div className="tl-form-row tl-bottom">
          <div className="tl-add" role="group" aria-label="Add an action">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className="tl-chip"
                aria-label={`Add: ${ITEM_NAME[k]}`}
                disabled={locked}
                onClick={() => lesson.add(k)}
              >
                + {CHIP_NAME[k]}
              </button>
            ))}
          </div>
          <button type="submit" className="btn primary" disabled={!lesson.canSend}>
            {lesson.busy === "send" ? (
              "Sending…"
            ) : (
              <>
                Send<span className="tl-long"> the batch{done ? " again" : ""}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Docked>
  );
}

function ReplayControls({ lesson }: { lesson: Lesson }) {
  return (
    <Docked>
      <div className="tl-form tl-replay-row" role="group" aria-label="Send an old transaction again">
        <button
          type="button"
          className="btn primary"
          disabled={!lesson.canReplay}
          onClick={() => void lesson.replay("worked")}
        >
          Re-send the batch that worked
        </button>
        {lesson.lastFailed ? (
          <button
            type="button"
            className="btn"
            disabled={!lesson.canReplay}
            onClick={() => void lesson.replay("failed")}
          >
            Re-send the batch that failed
          </button>
        ) : null}
      </div>
    </Docked>
  );
}
