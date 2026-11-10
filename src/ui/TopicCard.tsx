import { useId, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import type { LessonManifest, StageEntry } from "../app/types";

export const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="chip-icon">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** What a locked card says when opened: summary and comparison note, or a coming-soon state. */
export function CardDetails({ lesson }: { lesson: LessonManifest }) {
  const t = lesson.topic;
  const written = !!(lesson.summary || t?.comparison);
  return (
    <div className="card-details">
      {lesson.summary ? <p className="card-summary">{lesson.summary}</p> : null}
      {t?.comparison ? (
        <div className="card-note">
          <p className="card-label">Comparison note</p>
          <p>{t.comparison}</p>
        </div>
      ) : null}
      {t?.unverified ? (
        <p className="card-flag">
          Not yet checked: some facts here still need checking against official docs.
        </p>
      ) : null}
      {t?.goingDeeper ? (
        <p className="card-meta">Going deeper: optional reading. You do not need it to finish the stage.</p>
      ) : null}
      {t?.plannedScene ? <p className="card-meta">Planned scene: {t.plannedScene}.</p> : null}
      {t?.source ? (
        <p className="card-meta">
          Source:{" "}
          <a href={t.source} target="_blank" rel="noreferrer">
            {hostOf(t.source)}
          </a>
        </p>
      ) : null}
      <p className="card-soon">
        <LockIcon />
        <span>
          {!written
            ? "Coming soon. This card is not written yet."
            : t
              ? "Coming soon. This topic has no lesson yet."
              : "Coming soon. This lesson is being written."}
        </span>
      </p>
    </div>
  );
}

/** A locked card in the contents: a button that opens its details below it. */
export function LockedCard({ lesson, num }: { lesson: LessonManifest; num: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const deep = !!lesson.topic?.goingDeeper;
  return (
    <>
      <button
        type="button"
        className="lesson-chip locked"
        data-lesson-id={lesson.id}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="num">{num}</span>
        <span className="chip-body">
          <span className="chip-title">{lesson.title}</span>
          {deep ? <span className="tag deep">Going deeper</span> : null}
        </span>
        <span className="chip-state">
          <LockIcon />
          <span className="chip-soon">Coming soon</span>
        </span>
      </button>
      {open ? (
        <section id={id} className="card-panel" aria-label={lesson.title}>
          <CardDetails lesson={lesson} />
        </section>
      ) : null}
    </>
  );
}

/** `/lesson/<id>` for a locked card: the card on its own page. */
export function TopicCardPage({ lesson, stage }: { lesson: LessonManifest; stage: StageEntry }) {
  return (
    <main className="page">
      <div className="page-inner topic-page" style={{ "--stage-accent": stage.accent } as CSSProperties}>
        <p className="eyebrow">
          Stage {stage.id} · {stage.name}
        </p>
        <h1>{lesson.title}</h1>
        {lesson.topic?.goingDeeper ? <span className="tag deep">Going deeper</span> : null}
        <section className="card-panel" aria-label={lesson.title}>
          <CardDetails lesson={lesson} />
        </section>
        <Link className="btn" to="/">
          Back to contents
        </Link>
      </div>
    </main>
  );
}
