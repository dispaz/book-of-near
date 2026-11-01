import { useMemo, useState } from "react";
import { Link } from "react-router";
import { registry } from "../app/registry";
import { initialMode } from "../app/mode";
import { progress } from ".";
import { startLesson } from "./routes";
import { gradeTestOut, TEST_OUT_PASS, TEST_OUT_QUESTIONS, testOutRecords } from "./testOutQuiz";
import "./progress.css";

/** Short test that lets an experienced learner skip stage 0. Passing records tested-out completions. */
export function TestOut() {
  const [picks, setPicks] = useState<(number | undefined)[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const mode = useMemo(initialMode, []);
  const total = TEST_OUT_QUESTIONS.length;

  if (result) {
    const next = startLesson(registry, result.passed ? 1 : 0);
    return (
      <main className="page">
        <div className="page-inner quiz">
          <p className="eyebrow">Stage 0 test · {`${result.score} of ${total} right`}</p>
          {result.passed ? (
            <>
              <h1>You tested out of stage 0</h1>
              <p className="lede">
                Nice. Stage 0 is marked as done, so you can go straight to the NEAR lessons. You can still
                open any stage 0 lesson from the contents.
              </p>
            </>
          ) : (
            <>
              <h1>Start with stage 0</h1>
              <p className="lede">
                You need {TEST_OUT_PASS} of {total} to skip it. Stage 0 is short, and it fills the gaps.
              </p>
            </>
          )}
          <div className="quiz-actions">
            {next ? (
              <Link className="btn primary" to={`/lesson/${next.id}`}>
                Start stage {next.stage}
              </Link>
            ) : null}
            {!result.passed ? (
              <button
                className="btn"
                onClick={() => {
                  setPicks([]);
                  setResult(null);
                }}
              >
                Try again
              </button>
            ) : null}
            <Link className={next ? "btn" : "btn primary"} to="/">
              See the contents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-inner quiz">
        <p className="eyebrow">Book of NEAR · Stage 0 test</p>
        <h1>Skip the basics?</h1>
        <p className="lede">
          Five questions on blockchains, wallets and transactions. Get {TEST_OUT_PASS} right and stage 0 is
          marked as done.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const r = gradeTestOut(picks);
            if (r.passed) {
              const route = progress.route() ?? "veteran";
              const now = new Date().toISOString();
              for (const rec of testOutRecords(registry, route, mode, now)) progress.recordCompletion(rec);
            }
            setResult(r);
            window.scrollTo(0, 0);
          }}
        >
          {TEST_OUT_QUESTIONS.map((q, qi) => (
            <fieldset key={qi} className="quiz-q">
              <legend>
                <span className="quiz-n">{qi + 1}</span>
                {q.text}
              </legend>
              <div className="quiz-options stacked">
                {q.options.map((o, oi) => (
                  <label key={oi} className="quiz-option">
                    <input
                      type="radio"
                      name={`q${qi}`}
                      checked={picks[qi] === oi}
                      onChange={() =>
                        setPicks((p) => {
                          const next = [...p];
                          next[qi] = oi;
                          return next;
                        })
                      }
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="quiz-actions">
            <button className="btn primary" type="submit">
              Check my answers
            </button>
            <Link className="btn" to="/">
              Back to contents
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
