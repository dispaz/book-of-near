import { lazy, Suspense, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SceneProps } from "../../../app/types";
import { ActionSlot, SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { useChain } from "../../../chain/ChainContext";
import { near, REASON_TEXT, short, type Attempt } from "./key";
import { ADD, ATTACK, CALL, CHECK, HONEST, LIMIT, REVOKE, useKeyLesson, type Lesson } from "./useKeyLesson";
import "./scene.css";

/** The 3D view, loaded only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What can a function-call key not do?",
    options: [
      { text: "Send NEAR to another account.", correct: true },
      { text: "Call a method on the one contract it names.", why: "That is the one thing it is for." },
      { text: "Pay gas from its allowance.", why: "Gas is exactly what the allowance covers." },
    ],
  },
  {
    prompt: "How do you take back a function-call key you gave to an agent?",
    options: [
      { text: "Delete the key with a transaction signed by your full-access key.", correct: true },
      {
        text: "Ask the agent to give it back.",
        why: "A key you gave out stays valid until it is deleted. Asking changes nothing on the chain.",
      },
      {
        text: "Lower your account balance to zero.",
        why: "The allowance belongs to the key, not to your balance, and the key keeps working.",
      },
    ],
  },
];

/** One state (useKeyLesson) drawn two ways; the controls, check and honest take are shared. */
export default function Scene(props: SceneProps) {
  const chain = useChain();
  // A fresh lesson per network: switching to demo mode starts the lesson again on the new chain.
  return <KeyScene key={chain.network} {...props} />;
}

function KeyScene({ step, setGate, setVars, reducedMotion, mode, view, flat, reportEvidence }: SceneProps) {
  const lesson = useKeyLesson({ step, setGate, setVars, reducedMotion, reportEvidence });
  const summary = step >= CHECK;
  const three = view === "3d" && !summary;

  return (
    <>
      <div
        className={`kl scroll-fade-narrow${reducedMotion ? " still" : ""}${summary ? " summary" : ""}${three ? " three" : ""}`}
        data-testid="key-scene"
        data-scene-state={lesson.state}
        data-view={view}
        data-mode={mode}
        role="group"
        aria-label="Your account, the agent and its limited key"
      >
        {summary ? null : three ? (
          <>
            <div className="kl-3d" data-testid="key-3d">
              <Suspense fallback={<p className="kl-3d-loading">Loading the 3D scene…</p>}>
                <Scene3D lesson={lesson} flat={flat} reducedMotion={reducedMotion} />
              </Suspense>
            </div>
            <div className="visually-hidden">
              <Cards lesson={lesson} marks={false} />
            </div>
            {step >= CALL ? <Log attempts={lesson.attempts} marks={false} /> : null}
          </>
        ) : (
          <>
            <Cards lesson={lesson} marks />
            {step >= CALL ? <Log attempts={lesson.attempts} marks /> : null}
            {lesson.status ? (
              <p className="kl-status" aria-live="polite" data-testid="scene-status">
                {lesson.status}
              </p>
            ) : null}
          </>
        )}
        {summary && lesson.keyState !== "none" ? (
          <p className="kl-sum">
            {lesson.keyState === "revoked"
              ? "The agent's key is revoked."
              : "The agent's key is on your account."}{" "}
            {lesson.refused.length} attacks refused, {lesson.hints} hints used.
          </p>
        ) : null}
      </div>

      {lesson.error ? (
        <Docked>
          <div className="kl-error" role="alert" data-testid="key-error">
            <p className="kl-error-title">That did not work</p>
            <p>{lesson.error}</p>
          </div>
        </Docked>
      ) : null}
      {step === ADD ? <AllowanceForm lesson={lesson} /> : null}
      {step === CALL || step === ATTACK ? <AskForm lesson={lesson} attack={step === ATTACK} /> : null}
      {step === REVOKE ? (
        <SceneAction onClick={lesson.revoke} disabled={!lesson.canRevoke}>
          {lesson.busy === "revoke"
            ? "Deleting…"
            : lesson.keyState === "revoked"
              ? "Deleted ✓"
              : "Delete the agent's key"}
        </SceneAction>
      ) : null}
      {(step === CALL || step === ATTACK || step === REVOKE) && lesson.keyState === "none" ? (
        <p className="kl-needkey" role="status">
          The agent has no key yet. Go back to step 3 and add it.
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
            "Limits live in the account, not in an app. A NEAR account can hold many keys. A function-call key is limited to one contract, optional method names and a gas allowance, and the chain checks it on every transaction.",
            "A leaked limited key has a ceiling. It cannot move NEAR or attach a deposit, and when its allowance is spent it stops working.",
            "Revoking is one transaction. Delete the key with a full-access key.",
          ]}
          weaknesses={[
            'The limits are coarse. A key is bound to one contract and, at most, some method names. It cannot say "at most 1 NEAR a day" or "only to this friend". Finer rules need a contract.',
            "The allowance covers gas only. A key can still call a bad method on its one contract until the allowance runs out.",
            "An allowance cannot be changed. To give a different one, add a new key and delete the old one.",
            "Ethereum can do similar things, with extra setup. A plain Ethereum account has one private key that signs for everything. Smart-contract wallets can add their own rules, such as trusted addresses, but that is an add-on, not part of the plain account.",
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

function Cards({ lesson, marks }: { lesson: Lesson; marks: boolean }) {
  const { me, balance, keyInfo, keyState, initial, left, counter, says, step } = lesson;
  const perm = keyInfo?.permission.type === "FunctionCall" ? keyInfo.permission : null;
  const share = initial && left !== null && initial > 0n ? Number((left * 1000n) / initial) / 10 : 0;
  return (
    <div className="kl-cards">
      <section className="kl-card" aria-label="Your practice account" {...mark(marks, "account")}>
        <p className="kl-role">Your practice account</p>
        <p className="kl-id" title={me?.accountId}>
          {me ? short(me.accountId, 8, 6) : "…"}
        </p>
        <p className="kl-line">
          Balance <b>{balance !== null ? `${near(balance)} NEAR` : "…"}</b>
        </p>
        <p className="kl-line kl-key full">
          <KeyIcon /> Full-access key: <b>yours</b>. Can do anything.
        </p>
        {keyState !== "none" ? (
          <p className="kl-line" {...mark(marks, "counter")}>
            Counter contract: <b data-testid="counter-value">{counter}</b>
          </p>
        ) : null}
      </section>

      <section
        className={`kl-card kl-keycard ${keyState}`}
        aria-label="The agent's key"
        data-testid="key-card"
        {...mark(marks, "keycard")}
      >
        <p className="kl-role">The agent's key</p>
        {keyState === "none" ? (
          <p className="kl-line kl-dim">
            {step === LIMIT
              ? "A function-call key: one contract, a gas allowance, nothing else."
              : "No key yet."}
          </p>
        ) : keyState === "revoked" ? (
          <p className="kl-line">
            <KeyIcon /> <s>Function-call key</s> <b className="kl-revoked">Revoked</b>. Deleted from your
            account.
          </p>
        ) : (
          <>
            <p className="kl-line">
              <KeyIcon /> Function-call key. Can call: <b>this account's counter contract</b>
              {perm && perm.methodNames.length === 0 ? ", any method" : ""}.
            </p>
            <p className="kl-line">
              Allowance left: <b data-testid="allowance-left">{left !== null ? `${near(left)} NEAR` : "…"}</b>
              {initial !== null ? <> of {near(initial)} NEAR</> : null}
            </p>
            <div className="kl-meter" aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
            </div>
          </>
        )}
        {step === LIMIT ? (
          <ul className="kl-can" aria-label="What the key can and cannot do">
            <li className="yes">Call one contract</li>
            <li className="yes">Pay gas, up to its allowance</li>
            <li className="no">Send NEAR</li>
            <li className="no">Attach NEAR to a call</li>
            <li className="no">Add or change keys</li>
          </ul>
        ) : null}
      </section>

      <section className="kl-card kl-agent" aria-label="The agent">
        <p className="kl-role">The agent (a script, not an AI)</p>
        <p className="kl-says" data-testid="agent-says" aria-live="polite">
          {says ?? (keyState === "none" ? "Give me a key and I will help." : "Tell me what to do.")}
        </p>
      </section>
    </div>
  );
}

function Log({ attempts, marks }: { attempts: Attempt[]; marks: boolean }) {
  return (
    <section
      className="kl-log"
      aria-label="What the chain said"
      data-testid="attempt-log"
      {...mark(marks, "log")}
    >
      <p className="kl-role">What the chain said</p>
      {attempts.length === 0 ? <p className="kl-dim">Nothing yet.</p> : null}
      <ol>
        {[...attempts].reverse().map((a) => (
          <li key={a.id} className={a.ok ? "ok" : "no"}>
            <span className="kl-badge">{a.ok ? "Accepted" : a.reason ? "Refused" : "Failed"}</span>{" "}
            <q>{a.prompt}</q>
            {a.ok ? null : (
              <span className="kl-why">
                {a.reason ? <code>{a.reason} </code> : "The call ran but failed. "}
                {a.reason && REASON_TEXT[a.reason] ? REASON_TEXT[a.reason] : a.message}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function KeyIcon() {
  return (
    <svg className="kl-keyicon" viewBox="0 0 24 24" width="18" height="18" role="img" aria-label="key">
      <circle cx="7" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M11 12h10M17 12v4M21 12v3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// ---------- docked controls ----------

function AllowanceForm({ lesson }: { lesson: Lesson }) {
  const added = lesson.keyState !== "none";
  return (
    <Docked>
      <form
        className="kl-form"
        aria-label="Add the agent's key"
        onSubmit={(e) => {
          e.preventDefault();
          void lesson.addKey();
        }}
      >
        <div className="kl-form-row">
          <label>
            <span>Allowance</span>
            <input
              inputMode="decimal"
              value={lesson.allowanceText}
              size={6}
              disabled={added || lesson.busy !== null}
              onChange={(e) => lesson.setAllowanceText(e.target.value)}
            />
            <span>NEAR</span>
          </label>
          <button type="submit" className="btn primary" disabled={added || !lesson.canAdd}>
            {lesson.busy === "add" ? "Adding…" : added ? "Added ✓" : "Add the agent's key"}
          </button>
        </div>
        {lesson.allowanceProblem ? (
          <p className="kl-form-error" role="alert">
            {lesson.allowanceProblem}
          </p>
        ) : (
          <p className="kl-form-hint">From 0.01 to 0.5 NEAR. The key can spend this much on gas, no more.</p>
        )}
      </form>
    </Docked>
  );
}

function AskForm({ lesson, attack }: { lesson: Lesson; attack: boolean }) {
  return (
    <Docked>
      <form
        className="kl-form"
        aria-label="Talk to the agent"
        onSubmit={(e) => {
          e.preventDefault();
          void lesson.ask();
        }}
      >
        <div className="kl-form-row">
          <label className="grow">
            <span className="visually-hidden">Tell the agent what to do</span>
            <input
              aria-label="Tell the agent what to do"
              className="wide"
              value={lesson.prompt}
              placeholder={attack ? "Try to make it misbehave" : "Add one to the counter"}
              disabled={lesson.busy !== null || lesson.keyState !== "active"}
              onChange={(e) => lesson.setPrompt(e.target.value)}
            />
          </label>
          <button type="submit" className="btn primary kl-ask" disabled={!lesson.canAsk}>
            {lesson.busy === "ask" ? (
              "Sending…"
            ) : (
              <>
                Ask<span className="kl-ask-long"> the agent</span>
              </>
            )}
          </button>
        </div>
        {attack ? (
          <div className="kl-hints">
            <button type="button" className="btn" onClick={lesson.showHint} disabled={lesson.noHints}>
              Show a hint
            </button>
            <label className="kl-nohint">
              <input
                type="checkbox"
                checked={lesson.noHints}
                onChange={(e) => lesson.setNoHints(e.target.checked)}
              />
              <span>No-hint mode</span>
            </label>
            {lesson.hint ? (
              <button
                type="button"
                className="kl-hint"
                data-testid="hint"
                onClick={() => lesson.setPrompt(lesson.hint ?? "")}
                title="Use this prompt"
              >
                Hint: {lesson.hint}
              </button>
            ) : (
              <span className="kl-form-hint">Hints used: {lesson.hints}.</span>
            )}
          </div>
        ) : null}
      </form>
    </Docked>
  );
}
