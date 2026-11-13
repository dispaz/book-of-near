import type { CSSProperties, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { registry } from "../app/registry";
import type { LessonManifest, StageEntry } from "../app/types";
import { useProgress } from "../progress";
import { isOpen, isOptionalStage, ROUTE_INFO, startLesson } from "../progress/routes";
import "../progress/progress.css";
import "./contents.css";
import { LockedCard } from "./TopicCard";
import { ClaimBadge } from "../badges/ClaimBadge";
import { ruleFor } from "../badges/rules";
import { useReducedMotion } from "./hooks";
import { leafCount, lessonNumber, stageEntry, type TurnedState } from "./contents";
import { PageTurn } from "./PageTurn";

const TickIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="chip-icon tick">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const TURNED: TurnedState = { turned: true };

/** Every lesson a learner can open, in book order: how far into the book a lesson is sets the riffle. */
const bookOrder = registry.stages.flatMap((s) => s.lessons).filter(isOpen);

interface Turn {
  to: string;
  lesson: LessonManifest;
  stage: StageEntry;
}

/**
 * The first spread of the book. The left page is the title page (what the book is, your path, where to
 * go next); the right page is the table of contents: every stage with its lessons, planned ones and
 * backlog topics as locked cards. Picking a lesson (or a stage) turns the pages to it and opens its
 * first page. Phones get one page with both.
 */
export function ContentsPage() {
  const { route, completions, position } = useProgress();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [turn, setTurn] = useState<Turn | null>(null);
  // "Claim the stage N badge" at the end of a stage links here: bring its card into view.
  useEffect(() => {
    if (!hash.startsWith("#stage-")) return;
    let tries = 0;
    const t = window.setInterval(() => {
      const el = document.getElementById(hash.slice(1));
      if (el || ++tries > 20) window.clearInterval(t);
      el?.scrollIntoView({ block: "center" });
    }, 100);
    return () => window.clearInterval(t);
  }, [hash]);
  const done = useMemo(() => new Set(completions.map((c) => c.lessonId)), [completions]);
  // Only lessons still in the book: a completion of a lesson since removed does not count.
  const readCount = bookOrder.filter((l) => done.has(l.id)).length;
  const resume = position ? registry.lessons.get(position.lessonId) : undefined;
  const canResume = !!resume && isOpen(resume);
  const start =
    registry.stages.flatMap((s) => s.lessons).find((l) => isOpen(l) && !done.has(l.id)) ??
    startLesson(registry, 0);
  // Locked cards do not count: only lessons a learner can open.
  const stage0Done = !!registry.stages[0]?.lessons.every((l) => !isOpen(l) || done.has(l.id));

  /** Click handler for a link to a lesson: turn the pages, then open it. A new-tab click stays a link. */
  const turnTo = (lesson: LessonManifest, to: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (turn) return;
    const stage = registry.stages.find((s) => s.id === lesson.stage);
    if (reducedMotion || !stage) {
      navigate(to, { state: TURNED });
      return;
    }
    lesson.scene?.().catch(() => {}); // start loading the scene while the pages turn
    setTurn({ to, lesson, stage });
  };
  const landed = useCallback(() => {
    if (turn) navigate(turn.to, { state: TURNED });
  }, [turn, navigate]);

  const titlePage = (
    <div className="title-page">
      <p className="eyebrow">An interactive course</p>
      <h1>Book of NEAR</h1>
      <p className="lede">
        Learn how NEAR works by doing it. Each lesson is a small scene you can touch. Everything runs in demo
        mode, so you need no wallet and no money.
      </p>
      <div className="resume">
        {canResume ? (
          <Link
            className="btn primary"
            to={`/lesson/${resume.id}?step=${position!.step}`}
            onClick={turnTo(resume, `/lesson/${resume.id}?step=${position!.step}`)}
          >
            Continue where you left off: {resume.title}
          </Link>
        ) : start ? (
          <Link
            className="btn primary"
            to={`/lesson/${start.id}`}
            onClick={turnTo(start, `/lesson/${start.id}`)}
          >
            {done.size > 0 ? "Next up" : "Start reading"}: {start.title}
          </Link>
        ) : null}
      </div>
      <div className="path-bar">
        {route ? (
          <p className="path-name">
            Your path: <strong>{ROUTE_INFO[route].name}</strong>
          </p>
        ) : null}
        <Link className="pill" to="/start">
          Change my path
        </Link>
        <Link className="pill" to="/my-book">
          My book
        </Link>
        <Link className="pill" to="/check">
          Badge checker
        </Link>
        {route && route !== "newcomer" && !stage0Done ? (
          <Link className="pill" to="/test-out">
            Test out of stage 0
          </Link>
        ) : null}
      </div>
      <p className="title-note">
        {readCount > 0
          ? `You have read ${readCount} of ${bookOrder.length} lessons.`
          : `${bookOrder.length} lessons in ${registry.stages.length} stages. Pick one on the contents page.`}
      </p>
    </div>
  );

  const contents = (
    <nav aria-label="Contents" className="toc">
      <h2 className="toc-heading">Contents</h2>
      {registry.stages.map((s) => {
        const visible = s.lessons.filter((l) => !l.hidden);
        const open = visible.filter(isOpen);
        const finished = open.filter((l) => done.has(l.id)).length;
        const entry = stageEntry(s, done, isOpen);
        return (
          <section
            key={s.id}
            className="stage-card"
            style={{ "--stage-accent": s.accent } as CSSProperties}
            aria-labelledby={`stage-${s.id}-n stage-${s.id}`}
          >
            <div className="stage-head">
              <p className="eyebrow" id={`stage-${s.id}-n`}>
                Stage {s.id}
              </p>
              {isOptionalStage(route, s.id) ? <span className="tag">Optional for your path</span> : null}
              {open.length === 0 ? <span className="tag">Coming later</span> : null}
              {finished > 0 ? (
                <span className="tag done">
                  {finished} of {open.length} done
                </span>
              ) : null}
            </div>
            <h2 id={`stage-${s.id}`}>
              {entry ? (
                <Link
                  className="stage-link"
                  to={`/lesson/${entry.id}`}
                  onClick={turnTo(entry, `/lesson/${entry.id}`)}
                >
                  {s.name}: {s.title}
                </Link>
              ) : (
                <>
                  {s.name}: {s.title}
                </>
              )}
            </h2>
            <ul className="lessons">
              {visible.map((l) => {
                const num = lessonNumber(s.id, l.order);
                if (l.status === "planned") {
                  return (
                    <li key={l.id}>
                      <LockedCard lesson={l} num={num} />
                    </li>
                  );
                }
                const isDone = done.has(l.id);
                return (
                  <li key={l.id}>
                    <Link
                      className={isDone ? "lesson-chip done" : "lesson-chip"}
                      to={`/lesson/${l.id}`}
                      onClick={turnTo(l, `/lesson/${l.id}`)}
                    >
                      <span className="num">{num}</span>
                      <span className="chip-body">
                        <span className="chip-title">{l.title}</span>
                      </span>
                      <span className="leader" aria-hidden="true" />
                      {isDone ? (
                        <span className="chip-state">
                          <TickIcon />
                          <span className="visually-hidden">(done)</span>
                        </span>
                      ) : (
                        <span className="chip-pages">{l.steps.length} pages</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {ruleFor(s.id) && open.length > 0 && finished > 0 ? (
              <ClaimBadge stage={s.id} accent={s.accent} />
            ) : null}
          </section>
        );
      })}
    </nav>
  );

  return (
    <main className="contents-book" data-turning={turn ? "" : undefined}>
      <div className="book-leaf left" inert={!!turn}>
        {titlePage}
        <p className="folio">i</p>
      </div>
      <div className="book-leaf right" inert={!!turn}>
        {contents}
        <p className="folio">ii</p>
      </div>
      {turn ? (
        <PageTurn
          lesson={turn.lesson}
          stage={turn.stage}
          leaves={leafCount(bookOrder.findIndex((l) => l.id === turn.lesson.id))}
          onDone={landed}
        />
      ) : null}
    </main>
  );
}
