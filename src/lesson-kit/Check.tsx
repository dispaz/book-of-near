import { useId, useState } from "react";
import "./lessonKit.css";

export interface CheckOption {
  text: string;
  /** Exactly one option per question is correct. */
  correct?: boolean;
  /** Why this option is wrong (shown when picked), or why it is right. */
  why?: string;
}

export interface CheckQuestion {
  prompt: string;
  options: CheckOption[];
}

/**
 * A lesson's multiple-choice check. Every question must be answered right before `onPass` runs
 * (the scene then calls `setGate(true)`). A wrong pick shows its `why`. Native radios, so arrow keys,
 * Tab and Space work.
 */
export function Check({
  questions,
  onPass,
  passed = false,
  title = "Quick check",
}: {
  questions: CheckQuestion[];
  onPass: () => void;
  /** Start in the passed state, for example when the learner comes back to an opened step. */
  passed?: boolean;
  title?: string;
}) {
  const uid = useId();
  const [picked, setPicked] = useState<(number | undefined)[]>(() => questions.map(() => undefined));
  const [checked, setChecked] = useState<boolean[]>(() => questions.map(() => false));
  const [done, setDone] = useState(passed);

  const isRight = (q: number) => {
    const p = picked[q];
    return p !== undefined && !!questions[q]!.options[p]!.correct;
  };

  const submit = () => {
    setChecked(questions.map(() => true));
    if (questions.every((_, q) => isRight(q))) {
      setDone(true);
      onPass();
    }
  };

  return (
    <section className="lesson-panel check" aria-labelledby={`${uid}-t`}>
      <h2 id={`${uid}-t`} className="panel-title">
        {title}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {questions.map((q, qi) => {
          const p = picked[qi];
          const show = checked[qi] && !done;
          const opt = p === undefined ? undefined : q.options[p];
          return (
            <div key={qi} className="check-q" role="radiogroup" aria-labelledby={`${uid}-q${qi}`}>
              <p id={`${uid}-q${qi}`} className="check-prompt">
                <span className="check-n">{qi + 1}</span>
                {q.prompt}
              </p>
              {q.options.map((o, oi) => (
                <label key={oi} className="check-option">
                  <input
                    type="radio"
                    name={`${uid}-q${qi}`}
                    checked={p === oi}
                    onChange={() => {
                      setPicked((prev) => prev.map((v, i) => (i === qi ? oi : v)));
                      setChecked((prev) => prev.map((v, i) => (i === qi ? false : v)));
                    }}
                  />
                  <span>{o.text}</span>
                </label>
              ))}
              {show ? (
                <p className={`check-feedback ${opt?.correct ? "right" : "wrong"}`}>
                  {!opt ? "Pick an answer." : opt.correct ? "Right." : `Not quite. ${opt.why ?? ""}`.trim()}
                </p>
              ) : null}
            </div>
          );
        })}
        {done ? (
          <p className="check-feedback right" role="status">
            All right. The next step is open.
          </p>
        ) : (
          <button type="submit" className="btn primary">
            Check answers
          </button>
        )}
      </form>
    </section>
  );
}
