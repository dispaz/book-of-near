import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { registry } from "../app/registry";
import { progress } from ".";
import { offersTestOut, QUIZ, ROUTE_INFO, routeFromAnswers, startLesson, type QuizAnswers } from "./routes";
import type { Route } from "./types";
import "./progress.css";

/** First screen for a new visitor: three questions that pick a route. Also reached from "Change my path". */
export function OpeningQuiz() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [result, setResult] = useState<Route | null>(null);
  const done = QUIZ.every((q) => answers[q.key]);

  if (result) return <QuizResult route={result} testOut={offersTestOut(answers)} />;

  return (
    <main className="page">
      <div className="page-inner quiz">
        <p className="eyebrow">Book of NEAR · Three quick questions</p>
        <h1>Where should you start?</h1>
        <p className="lede">
          Answer three questions and we will pick a path for you. There are no wrong answers. You can change
          your path later.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!done) return;
            const route = routeFromAnswers(answers);
            progress.setRoute(route);
            setResult(route);
          }}
        >
          {QUIZ.map((q, qi) => (
            <fieldset key={q.key} className="quiz-q">
              <legend>
                <span className="quiz-n">{qi + 1}</span>
                {q.text}
              </legend>
              {q.hint ? <p className="quiz-hint">{q.hint}</p> : null}
              <div className="quiz-options">
                {q.options.map((o) => (
                  <label key={o.value} className="quiz-option">
                    <input
                      type="radio"
                      name={q.key}
                      value={o.value}
                      checked={answers[q.key] === o.value}
                      onChange={() => setAnswers((a) => ({ ...a, [q.key]: o.value }))}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="quiz-actions">
            <button className="btn primary" type="submit" disabled={!done}>
              Show my path
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                progress.setRoute("newcomer");
                void navigate("/");
              }}
            >
              Skip the quiz
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function QuizResult({ route, testOut }: { route: Route; testOut: boolean }) {
  const info = ROUTE_INFO[route];
  const first = startLesson(registry, 0);
  return (
    <main className="page">
      <div className="page-inner quiz">
        <p className="eyebrow">Your path</p>
        <h1>{info.name} path</h1>
        <p className="lede">{info.why}</p>
        <p className="quiz-covers">{info.covers}</p>
        {testOut && route !== "veteran" ? (
          <p className="quiz-covers">
            Already know the basics? A five-question test lets you skip stage 0 and go straight to NEAR.
          </p>
        ) : null}
        <div className="quiz-actions">
          {testOut ? (
            <Link className="btn primary" to="/test-out">
              Take the stage 0 test
            </Link>
          ) : null}
          {first ? (
            <Link className={testOut ? "btn" : "btn primary"} to={`/lesson/${first.id}`}>
              {testOut ? "Start stage 0 anyway" : "Start stage 0"}
            </Link>
          ) : null}
          <Link className="btn" to="/">
            See the contents
          </Link>
        </div>
      </div>
    </main>
  );
}
