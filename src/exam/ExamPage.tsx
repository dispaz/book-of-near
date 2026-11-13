import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Link, useSearchParams } from "react-router";
import { useChain } from "../chain/ChainContext";
import { progress, useProgress } from "../progress";
import { STAGE_ACCENTS } from "../scene-kit/theme";
import { questionsFor } from "./bank";
import { readExamGate, submitExam, type ExamOutcome, type GateView } from "./examFlow";
import type { Picks } from "./grade";
import {
  badgeList,
  EXAM_ROUTE_INFO,
  EXAM_ROUTES,
  examRouteFor,
  isExamRoute,
  passMark,
  type ExamRoute,
} from "./routes";
import "../progress/progress.css";
import "./exam.css";

type View =
  | { s: "checking" }
  | { s: "error"; text: string }
  | { s: "locked"; gate: GateView }
  | { s: "open"; gate: GateView }
  | { s: "grading" }
  | { s: "graded"; outcome: Extract<ExamOutcome, { ok: true }> };

/**
 * The final exam (issue #28). A form, so 2D only: there is no scene to switch to. Native radios in
 * fieldsets give keyboard access; nothing animates, so reduced motion needs no change.
 */
export function ExamPage() {
  const chain = useChain();
  const state = useProgress();
  const [params, setParams] = useSearchParams();
  const route: ExamRoute = isExamRoute(params.get("route"))
    ? (params.get("route") as ExamRoute)
    : examRouteFor(state.route);
  const info = EXAM_ROUTE_INFO[route];
  const questions = questionsFor(route);
  const mark = passMark(questions.length);
  const kept = state.exams?.[route];

  const [view, setView] = useState<View>({ s: "checking" });
  const [picks, setPicks] = useState<Picks>(() => questions.map(() => null));
  const [blank, setBlank] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const blankNote = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let live = true;
    setView({ s: "checking" });
    setPicks(questionsFor(route).map(() => null));
    setBlank(null);
    setSubmitError(null);
    readExamGate(chain, route)
      .then((gate) => live && setView(gate.open ? { s: "open", gate } : { s: "locked", gate }))
      .catch(
        () => live && setView({ s: "error", text: "Your badges could not be read. Try again in a minute." }),
      );
    return () => {
      live = false;
    };
  }, [chain, route]);

  useEffect(() => {
    if (view.s === "graded") resultHeading.current?.focus();
  }, [view.s]);

  async function submit() {
    const left = picks.filter((p) => p === null).length;
    if (left > 0) {
      setBlank(left);
      requestAnimationFrame(() => blankNote.current?.focus());
      return;
    }
    setBlank(null);
    setSubmitError(null);
    setView({ s: "grading" });
    const outcome = await submitExam(chain, route, picks, {
      workerUrl: import.meta.env.VITE_WORKER_URL as string | undefined,
    }).catch((): ExamOutcome => ({ ok: false, error: "Something went wrong while grading. Try again." }));
    if (!outcome.ok) {
      setSubmitError(outcome.error);
      setView({ s: "checking" });
      readExamGate(chain, route)
        .then((gate) => setView(gate.open ? { s: "open", gate } : { s: "locked", gate }))
        .catch(() => setView({ s: "error", text: outcome.error }));
      return;
    }
    progress.recordExam({
      route,
      accountId: (await chain.practiceAccount()).accountId,
      mode: chain.network === "testnet" ? "testnet" : "demo",
      score: outcome.score,
      total: outcome.total,
      passed: outcome.passed,
      takenAt: new Date().toISOString(),
      ...(outcome.receipt
        ? {
            receipt: {
              contractId: outcome.receipt.contractId,
              passedAtMs: outcome.receipt.passedAtMs,
              signature: outcome.receipt.signature,
            },
          }
        : {}),
    });
    setView({ s: "graded", outcome });
    window.scrollTo(0, 0);
  }

  function retake() {
    setPicks(questions.map(() => null));
    setView({ s: "checking" });
    readExamGate(chain, route)
      .then((gate) => setView(gate.open ? { s: "open", gate } : { s: "locked", gate }))
      .catch(() => setView({ s: "error", text: "Your badges could not be read. Try again in a minute." }));
    window.scrollTo(0, 0);
  }

  const demo = chain.network !== "testnet";

  return (
    <main className="page exam-page" style={{ "--stage-accent": STAGE_ACCENTS[7] } as CSSProperties}>
      <div className="page-inner quiz">
        <p className="eyebrow">Book of NEAR · Stage 7 · Final exam</p>
        <h1>The final exam</h1>
        <p className="lede">
          {questions.length} questions from the lessons. Pick one answer for each. Get {mark} right to pass.
          You can take it again as often as you like; your best result is kept.
        </p>

        {view.s !== "graded" && view.s !== "grading" ? (
          <fieldset className="exam-routes">
            <legend>Route</legend>
            {EXAM_ROUTES.map((r) => (
              <label key={r} className="quiz-option">
                <input
                  type="radio"
                  name="exam-route"
                  checked={route === r}
                  onChange={() => setParams({ route: r }, { replace: true })}
                />
                <span>
                  <strong>{EXAM_ROUTE_INFO[r].name}</strong>
                  <span className="exam-route-for">
                    {EXAM_ROUTE_INFO[r].forWho} Needs the {badgeList(EXAM_ROUTE_INFO[r].requiredBadges)}.
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {kept && view.s !== "graded" ? (
          <p className="exam-kept" data-testid="exam-kept">
            {kept.passed
              ? `You passed the ${info.name.toLowerCase()} with ${kept.score} of ${kept.total}.`
              : `Your last try on the ${info.name.toLowerCase()}: ${kept.score} of ${kept.total}.`}{" "}
            Attempts: {kept.attempts}.
          </p>
        ) : null}

        {submitError ? (
          <p className="exam-alert" role="alert">
            {submitError}
          </p>
        ) : null}

        {view.s === "checking" ? <p role="status">Checking your badges…</p> : null}
        {view.s === "error" ? <p role="alert">{view.text}</p> : null}

        {view.s === "locked" ? (
          <section className="exam-locked" aria-labelledby="exam-locked-h" data-exam-state="locked">
            <h2 id="exam-locked-h">The exam is locked</h2>
            <p>
              The {info.name.toLowerCase()} opens when your account holds the {badgeList(info.requiredBadges)}
              . The app reads them from the badge contract
              {demo ? " (in demo mode, the demo contract in this browser)" : " on testnet"}.
            </p>
            <ul className="exam-badges">
              {info.requiredBadges.map((s) => {
                const has = !view.gate.missing.includes(s);
                return (
                  <li key={s} className={has ? "has" : "missing"}>
                    Stage {s} badge: {has ? "held" : "not yet"}
                  </li>
                );
              })}
            </ul>
            <div className="quiz-actions">
              <Link className="btn primary" to="/">
                Claim badges on the contents page
              </Link>
              <Link className="btn" to="/my-book">
                My book
              </Link>
            </div>
          </section>
        ) : null}

        {view.s === "open" ? (
          <form
            data-exam-state="open"
            aria-label={`${info.name} questions`}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {questions.map((q, qi) => (
              <fieldset key={q.id} className="quiz-q" data-question={q.id}>
                <legend>
                  <span className="quiz-n">{qi + 1}</span>
                  {q.prompt}
                </legend>
                <div className="quiz-options stacked">
                  {q.options.map((o, oi) => (
                    <label key={oi} className="quiz-option">
                      <input
                        type="radio"
                        name={q.id}
                        checked={picks[qi] === oi}
                        onChange={() => setPicks((p) => p.map((v, i) => (i === qi ? oi : v)))}
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {blank ? (
              <p className="exam-alert" role="alert" tabIndex={-1} ref={blankNote}>
                Answer every question first. {blank === 1 ? "One is" : `${blank} are`} still blank.
              </p>
            ) : null}
            <div className="quiz-actions">
              <button className="btn primary" type="submit">
                Hand in my answers
              </button>
              <Link className="btn" to="/">
                Back to contents
              </Link>
            </div>
          </form>
        ) : null}

        {view.s === "grading" ? (
          <p role="status">
            Grading…{demo ? "" : " The app's server checks your badges on testnet, then marks the answers."}
          </p>
        ) : null}

        {view.s === "graded" ? (
          <Result
            outcome={view.outcome}
            route={route}
            demo={demo}
            headingRef={resultHeading}
            onRetake={retake}
          />
        ) : null}
      </div>
    </main>
  );
}

function Result({
  outcome,
  route,
  demo,
  headingRef,
  onRetake,
}: {
  outcome: Extract<ExamOutcome, { ok: true }>;
  route: ExamRoute;
  demo: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRetake: () => void;
}) {
  const questions = questionsFor(route);
  return (
    <section
      className="exam-result"
      aria-labelledby="exam-result-h"
      data-exam-state={outcome.passed ? "passed" : "failed"}
    >
      <p className="eyebrow">
        {EXAM_ROUTE_INFO[route].name} · {outcome.score} of {outcome.total} right
      </p>
      <h2 id="exam-result-h" tabIndex={-1} ref={headingRef}>
        {outcome.passed ? "You passed the final exam" : "Not passed yet"}
      </h2>
      {outcome.passed ? (
        <p className="lede">
          {outcome.score} of {outcome.total}. Your result is saved in this browser with a signed receipt,
          which the final badge will check. The final badge is not open yet.
          {demo
            ? " In demo mode the receipt is signed with the public demo key, so it counts in this browser only."
            : ""}
        </p>
      ) : (
        <p className="lede">
          You need {outcome.passMark} of {outcome.total}. Read why each answer is right below, then take the
          exam again.
        </p>
      )}
      <ol className="exam-review" aria-label="Your answers">
        {outcome.results.map((r, i) => {
          const q = questions[i];
          if (!q) return null;
          return (
            <li key={r.id} className={r.correct ? "right" : "wrong"} data-question={r.id}>
              <p className="exam-review-q">{q.prompt}</p>
              <p className="exam-review-mark">
                {r.correct ? "Right" : "Wrong"}
                {!r.correct && r.picked !== null ? (
                  <>
                    . You picked: <em>{q.options[r.picked]}</em>
                  </>
                ) : null}
              </p>
              {r.whyPicked ? <p className="exam-review-why">{r.whyPicked}</p> : null}
              <p className="exam-review-answer">
                Answer: <strong>{q.options[r.answer]}</strong>
              </p>
              <p className="exam-review-why">{r.why}</p>
            </li>
          );
        })}
      </ol>
      <div className="quiz-actions">
        <button className="btn primary" type="button" onClick={onRetake}>
          Take the exam again
        </button>
        <Link className="btn" to="/my-book">
          My book
        </Link>
        <Link className="btn" to="/">
          Back to contents
        </Link>
      </div>
    </section>
  );
}
