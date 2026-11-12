import type { CSSProperties } from "react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { registry } from "../app/registry";
import { useProgress } from "../progress";
import { isOpen, isOptionalStage, ROUTE_INFO, startLesson } from "../progress/routes";
import "../progress/progress.css";
import { LockedCard } from "./TopicCard";
import { ClaimBadge } from "../badges/ClaimBadge";
import { ruleFor } from "../badges/rules";

const TickIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="chip-icon tick">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** The book's table of contents: every stage with its lessons; planned ones and backlog topics as locked cards. */
export function ContentsPage() {
  const { route, completions, position } = useProgress();
  const { hash } = useLocation();
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
  const done = new Set(completions.map((c) => c.lessonId));
  const resume = position ? registry.lessons.get(position.lessonId) : undefined;
  const canResume = !!resume && isOpen(resume);
  const start =
    registry.stages.flatMap((s) => s.lessons).find((l) => isOpen(l) && !done.has(l.id)) ??
    startLesson(registry, 0);
  // Locked cards do not count: only lessons a learner can open.
  const stage0Done = !!registry.stages[0]?.lessons.every((l) => !isOpen(l) || done.has(l.id));

  return (
    <main className="page">
      <div className="page-inner">
        <p className="eyebrow">An interactive course</p>
        <h1>Book of NEAR</h1>
        <p className="lede">
          Learn how NEAR works by doing it. Each lesson is a small scene you can touch. Everything runs in
          demo mode, so you need no wallet and no money.
        </p>
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
        <div className="resume">
          {canResume ? (
            <Link className="btn primary" to={`/lesson/${resume.id}?step=${position!.step}`}>
              Continue where you left off: {resume.title}
            </Link>
          ) : start ? (
            <Link className="btn primary" to={`/lesson/${start.id}`}>
              {done.size > 0 ? "Next up" : "Start reading"}: {start.title}
            </Link>
          ) : null}
        </div>
        <nav aria-label="Contents">
          {registry.stages.map((s) => {
            const visible = s.lessons.filter((l) => !l.hidden);
            const open = visible.filter(isOpen);
            const finished = open.filter((l) => done.has(l.id)).length;
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
                  {s.name}: {s.title}
                </h2>
                <ul className="lessons">
                  {visible.map((l) => {
                    const num = l.order < 10 ? `${s.id}.${l.order}` : "";
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
                        <Link className={isDone ? "lesson-chip done" : "lesson-chip"} to={`/lesson/${l.id}`}>
                          <span className="num">{num}</span>
                          <span className="chip-body">
                            <span className="chip-title">{l.title}</span>
                          </span>
                          {isDone ? (
                            <span className="chip-state">
                              <TickIcon />
                              <span className="visually-hidden">(done)</span>
                            </span>
                          ) : null}
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
      </div>
    </main>
  );
}
