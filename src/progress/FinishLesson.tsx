import { useEffect } from "react";
import { Link } from "react-router";
import { registry } from "../app/registry";
import type { ChainMode, LessonManifest } from "../app/types";
import { progress, useProgress } from ".";
import { nextLesson } from "./routes";
import { ruleFor } from "../badges/rules";
import "./progress.css";

/** Remembers the lesson and step the learner has open, for "Continue where you left off". */
export function useRecordPosition(lessonId: string, step: number) {
  useEffect(() => progress.recordPosition(lessonId, step + 1), [lessonId, step]);
}

/** Shown in the lesson card on the last step: records the completion, then offers the next lesson. */
export function FinishLesson({
  lesson,
  mode,
  disabled,
}: {
  lesson: LessonManifest;
  mode: ChainMode;
  disabled?: boolean;
}) {
  const state = useProgress();
  const done = state.completions.some((c) => c.lessonId === lesson.id);
  const next = nextLesson(registry, lesson.id);

  if (!done) {
    return (
      <div className="finish">
        <button
          className="btn primary"
          disabled={disabled}
          onClick={() =>
            progress.recordCompletion({
              lessonId: lesson.id,
              stage: lesson.stage,
              route: progress.route() ?? "newcomer",
              mode,
              completedAt: new Date().toISOString(),
            })
          }
        >
          Finish lesson
        </button>
      </div>
    );
  }
  return (
    <div className="finish done" role="status">
      <p className="finish-title">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="tick">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        Lesson done
      </p>
      <div className="finish-links">
        {next ? (
          <Link className="btn primary" to={`/lesson/${next.id}`}>
            Next: {next.title}
          </Link>
        ) : null}
        {/* The stage's last lesson: the way back to the contents leads to the stage's badge card. */}
        {ruleFor(lesson.stage)?.lessons.at(-1) === lesson.id ? (
          <Link className="btn" to={`/#stage-${lesson.stage}-badge`}>
            Claim the stage {lesson.stage} badge
          </Link>
        ) : (
          <Link className="btn" to="/">
            Back to contents
          </Link>
        )}
      </div>
    </div>
  );
}
