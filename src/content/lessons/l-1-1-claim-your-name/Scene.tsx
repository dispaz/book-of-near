import { lazy, Suspense, useContext, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SceneProps } from "../../../app/types";
import { ActionSlot, SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { useChain } from "../../../chain/ChainContext";
import { near, short, type KindError } from "../l-0-3-send-a-transaction/tx";
import { SUFFIX } from "./name";
import { CHECK, COMPARE, CONCEPT, CREATE, HONEST, HOOK, PICK, useClaim, type Claim } from "./useClaim";
import "../l-0-3-send-a-transaction/scene.css";
import "./name.css";

/** The 3D view, loaded only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What is an account id?",
    options: [
      { text: "The address of an account: a name or a hex string.", correct: true },
      { text: "The secret that signs transactions.", why: "That is the private key." },
      {
        text: "A fee paid when you create an account.",
        why: "Fees are paid in NEAR. An id is only an address.",
      },
    ],
  },
  {
    prompt: "How did your name get created?",
    options: [
      {
        text: "A transaction asked the testnet registrar contract to create it and fund it.",
        correct: true,
      },
      {
        text: "The app wrote it into its own database.",
        why: "The account lives on the chain, not in the app.",
      },
      {
        text: "It existed already and the app only read it.",
        why: "The app checked that it was free first.",
      },
    ],
  },
  {
    prompt: "Which id is valid?",
    options: [
      { text: "ana-1.testnet", correct: true },
      { text: "Ana.testnet", why: "Only lowercase letters are allowed." },
      { text: "ana..testnet", why: "A mark such as a dot must sit between two letters or digits." },
    ],
  },
];

/** A fresh lesson state per network: switching to demo mode starts the lesson's name again. */
export default function Scene(props: SceneProps) {
  const chain = useChain();
  return <ClaimScene key={chain.network} {...props} />;
}

/**
 * One state (useClaim) drawn two ways. The facts, the status, the docked controls, the check and the
 * honest take are shared; the picture of the three accounts is flat cards (2D) or the 3D scene.
 */
function ClaimScene({
  step,
  goTo,
  setGate,
  reducedMotion,
  mode,
  view,
  flat,
  setVars,
  reportEvidence,
}: SceneProps) {
  const claim = useClaim({ step, goTo, setGate, reducedMotion, setVars, reportEvidence });
  const { created, error, status } = claim;
  const summary = step >= CHECK;
  // The check and honest-take steps open a quiz window / text page over the scene, so 3D falls back to
  // the one-line summary there (same as lesson 0.3) instead of drawing a scene that sits under the window.
  const three = view === "3d" && !summary;

  const cast = <Cast claim={claim} flat={!three} />;

  return (
    <>
      <div
        className={`stx cn${reducedMotion ? " still" : ""}${summary ? " summary" : ""}${three ? " three" : ""}`}
        data-testid="name-scene"
        data-scene-state={claim.state}
        data-view={view}
        data-mode={mode}
        role="group"
        aria-label="Claiming a name on NEAR testnet"
      >
        {summary ? (
          created ? (
            <p className="stx-sum">
              Your account: <code>{created.id}</code>
            </p>
          ) : null
        ) : three ? (
          <>
            <div className="stx-3d" data-testid="name-3d">
              <Suspense fallback={<p className="stx-3d-loading">Loading the 3D scene…</p>}>
                <Scene3D claim={claim} flat={flat} reducedMotion={reducedMotion} />
              </Suspense>
            </div>
            {/* The 3D scene draws the accounts; the same facts stay readable as text. */}
            <div className="visually-hidden">{cast}</div>
          </>
        ) : (
          cast
        )}

        {summary ? null : status && !three ? (
          <p className="stx-status" aria-live="polite" data-testid="scene-status">
            {status}
          </p>
        ) : null}

        {summary ? null : <Detail claim={claim} flat={!three} />}
      </div>

      {error ? (
        <ErrorBox
          error={error}
          testnet={claim.testnet}
          onDemo={claim.continueInDemo}
          onRetry={claim.tryAnother}
        />
      ) : null}
      {step === PICK ? <NameForm claim={claim} /> : null}
      {step === CREATE && !error ? (
        <SceneAction onClick={claim.create} disabled={!claim.canCreate}>
          {created ? "Created ✓" : claim.busy ? "Creating…" : `Create ${claim.id ?? "your name"}`}
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={claim.passed}
          onPass={() => {
            claim.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith="Ethereum"
          strengths={[
            "Names are accounts. A NEAR account id can be readable, and it is part of the protocol, so the same id works in every app.",
            "One transaction made the account, funded it and added its key. You saw it happen in one step.",
            "The name belongs to the account, not to a key. Keys can change later without changing the name.",
          ]}
          weaknesses={[
            "First come, first served. A taken name is gone, and a shared registrar invites squatting. (How the mainnet registrar handles this is unverified.)",
            "A name costs NEAR to create: the deposit, plus a fee that was about 0.0075 NEAR on testnet. Why that is more than gas times price is unverified.",
            "Ethereum has no names in the protocol. An address is hex, and ENS is a separate service on top of it. That is a trade-off: ENS is optional and independent, while a NEAR name is built in but lives under one registrar. (Details of ENS fees are unverified.)",
            "Hex accounts still exist on NEAR, so wallets and apps must handle both kinds of id.",
          ]}
        />
      ) : null}
    </>
  );
}

// ---------- The three accounts (2D cards) ----------

function Cast({ claim, flat }: { claim: Claim; flat: boolean }) {
  const { me, created, id, free, step } = claim;
  const mark = (name: string) => (flat ? name : undefined);
  // The compare step has its own two cards.
  if (step === COMPARE || step >= CHECK) return null;
  const showOthers = step >= CONCEPT;
  const newLabel = created
    ? created.id
    : id && (free || step >= CREATE)
      ? id
      : step === PICK
        ? "…"
        : "your name?";
  return (
    <div className={`cn-cast${showOthers ? "" : " one"}`}>
      <section className="stx-acct" aria-label="Your practice account" data-explain={mark("account")}>
        <p className="stx-acct-role">You · practice account</p>
        <p className="stx-acct-id" title={me?.accountId}>
          {me ? short(me.accountId, 6, 4) : "…"}
        </p>
        <p className="stx-acct-bal">
          <strong className="stx-num">{claim.start === null ? "…" : near(claim.start)}</strong>
        </p>
      </section>
      {showOthers ? (
        <>
          <Arrow label={step >= CREATE ? "0.1 NEAR + key" : ""} on={claim.busy || !!created} />
          <section className="stx-acct" aria-label="The registrar" data-explain={mark("registrar")}>
            <p className="stx-acct-role">Registrar</p>
            <p className="stx-acct-id">{claim.registrar}</p>
            <p className="stx-acct-bal">
              <span className="stx-note">makes {SUFFIX} names</span>
            </p>
          </section>
          <Arrow label="" on={!!created} />
          <section
            className={`stx-acct${created ? "" : " cn-ghost"}`}
            aria-label="The new account"
            data-explain={mark("name-box")}
          >
            <p className="stx-acct-role">{created ? "Your new account" : "New account"}</p>
            <p className="stx-acct-id" title={newLabel}>
              {newLabel}
            </p>
            <p className="stx-acct-bal">
              {created ? (
                <strong className="stx-num">{near(created.balance)}</strong>
              ) : (
                <span className="stx-note">not created yet</span>
              )}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Arrow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className={`stx-arrow${on ? " moving" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 60 24">
        <path d="M4 12 H52 M44 5 L53 12 L44 19" />
      </svg>
      <span>{label}</span>
    </div>
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

function Detail({ claim, flat }: { claim: Claim; flat: boolean }) {
  const { step, me, created } = claim;
  const mark = (name: string) => (flat ? name : undefined);
  if (step === HOOK)
    return (
      <section className="stx-detail" aria-label="Your practice account's address">
        <p className="stx-detail-title">Your practice account's address</p>
        <dl>
          <Field label="Hex id (64 characters)" wide testId="hex-id">
            {me?.accountId ?? "…"}
          </Field>
          <Field label="Network">
            {claim.testnet ? "NEAR testnet (free coins, no value)" : "Demo mode (in your browser)"}
          </Field>
        </dl>
      </section>
    );
  if (step === CONCEPT)
    return (
      <section className="stx-detail" aria-label="Rules for names">
        <p className="stx-detail-title">What a NEAR account id can look like</p>
        <ul className="cn-rules" data-testid="rules">
          <li>2 to 64 characters.</li>
          <li>Lowercase letters, digits and the marks - _ and . only.</li>
          <li>A mark must sit between two letters or digits.</li>
          <li>
            A hex id of 64 characters is an <em>implicit</em> account, made from a public key.
          </li>
        </ul>
      </section>
    );
  if (step === PICK)
    return (
      <section className="stx-detail" aria-label="Choosing a name">
        <p className="stx-detail-title">Your name</p>
        <p className="cn-pick" data-testid="picked-id">
          {claim.id ?? <span className="stx-pending">type a name in the box above the lesson card</span>}
        </p>
      </section>
    );
  if (step === CREATE)
    return (
      <section
        className="stx-detail"
        aria-label="The new account"
        data-explain={mark("create")}
        data-testid={created ? "created-card" : undefined}
      >
        <p className="stx-detail-title">{created ? "Created" : "The call"}</p>
        {created ? (
          <dl>
            <Field label="Account" wide testId="new-account-id">
              {created.id}
            </Field>
            <Field label="Balance" testId="new-account-balance">
              {near(created.balance)}
            </Field>
            <Field label="Fee paid" testId="create-fee">
              {near(created.fee, 8)}
            </Field>
            <Field label="Transaction ID" wide testId="create-tx-hash">
              {created.txHash}
            </Field>
            <Field label="Included in block" testId="create-block">
              #{created.block}
            </Field>
            <Field label="Full-access key" wide testId="new-account-key">
              {created.keys.map((k) => k.publicKey).join(", ") || "…"}
            </Field>
          </dl>
        ) : (
          <dl>
            <Field label="Call">
              <code>{claim.registrar}.create_account</code>
            </Field>
            <Field label="New id">{claim.id ?? "…"}</Field>
            <Field label="Deposit">0.1 NEAR from you</Field>
            <Field label="Key">a new key, made in this browser</Field>
          </dl>
        )}
      </section>
    );
  if (step === COMPARE && created)
    return (
      <section
        className="stx-detail"
        aria-label="Named account and hex account"
        data-explain={mark("compare")}
      >
        <p className="stx-detail-title">The same key, two possible ids</p>
        <div className="cn-compare">
          <section className="stx-acct" aria-label="Named account" data-testid="compare-named">
            <p className="stx-acct-role">Named · exists</p>
            <p className="stx-acct-id" title={created.id}>
              {created.id}
            </p>
            <p className="stx-note">
              Made by the registrar. Balance {near(created.balance)}. Easy to read, say and check.
            </p>
          </section>
          <section className="stx-acct cn-ghost" aria-label="Hex account" data-testid="compare-hex">
            <p className="stx-acct-role">Hex · not created</p>
            <p className="stx-acct-id" title={created.hexId}>
              {short(created.hexId, 10, 6)}
            </p>
            <p className="stx-note">
              <span className="visually-hidden">{created.hexId} </span>
              The id this key would have as an implicit account. It exists only once someone sends it NEAR.
            </p>
          </section>
        </div>
        {claim.testnet ? (
          <p>
            <a
              href={`https://testnet.nearblocks.io/address/${created.id}`}
              target="_blank"
              rel="noreferrer"
              data-testid="explorer-url"
            >
              See {created.id} on NearBlocks
            </a>
          </p>
        ) : (
          <p className="stx-note">Demo mode: this account lives only in your browser.</p>
        )}
      </section>
    );
  if (step === COMPARE)
    return (
      <section className="stx-detail" aria-label="Create a name first">
        <p className="stx-detail-title">No account yet</p>
        <p>
          Create a name in step 4 first, then come back to compare.{" "}
          <button className="btn" onClick={() => claim.tryAnother()}>
            Go back
          </button>
        </p>
      </section>
    );
  return null;
}

// ---------- Docked controls ----------

/** The name box, docked above the lesson card, with the live feedback under it. */
function NameForm({ claim }: { claim: Claim }) {
  const slot = useContext(ActionSlot);
  const input = useRef<HTMLInputElement>(null);
  // Focus the box once, when it appears.
  useEffect(() => input.current?.focus({ preventScroll: true }), []);
  const form = (
    <form className="stx-form cn-form" aria-label="Pick a name" onSubmit={(e) => e.preventDefault()}>
      <div className="stx-form-row">
        <label>
          <span>Account name</span>
          <input
            ref={input}
            value={claim.text}
            placeholder="ana"
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            maxLength={40}
            disabled={!!claim.created}
            aria-describedby="cn-feedback"
            onChange={(e) => claim.setText(e.target.value)}
          />
          <span>{SUFFIX}</span>
        </label>
      </div>
      <p
        id="cn-feedback"
        className={`cn-feedback ${claim.feedback.tone}`}
        role="status"
        data-testid="name-feedback"
      >
        {claim.feedback.text}
      </p>
    </form>
  );
  return slot ? createPortal(form, slot) : form;
}

/** A clear, kind error with a way forward: demo mode (on testnet) or another name. */
function ErrorBox({
  error,
  testnet,
  onDemo,
  onRetry,
}: {
  error: KindError;
  testnet: boolean;
  onDemo: () => void;
  onRetry: () => void;
}) {
  const slot = useContext(ActionSlot);
  const box = (
    <div className="stx-error" role="alert" data-testid="name-error">
      <p className="stx-error-title">{error.title}</p>
      <p>{error.detail}</p>
      <div className="stx-error-actions">
        {testnet ? (
          <button type="button" className="btn primary" onClick={onDemo}>
            Continue in demo mode
          </button>
        ) : null}
        <button type="button" className="btn" onClick={onRetry}>
          Pick a name again
        </button>
      </div>
    </div>
  );
  return slot ? createPortal(box, slot) : box;
}
