import type { CSSProperties } from "react";
import { Link } from "react-router";
import { registry } from "../app/registry";

/** The book's table of contents: every stage with its lessons. */
export function ContentsPage() {
  return (
    <main className="page">
      <div className="page-inner">
        <p className="eyebrow">An interactive course</p>
        <h1>Book of NEAR</h1>
        <p className="lede">
          Learn how NEAR works by doing it. Each lesson is a small scene you can touch. Everything runs in
          demo mode, so you need no wallet and no money.
        </p>
        <nav aria-label="Contents">
          {registry.stages.map((s) => (
            <section
              key={s.id}
              className="stage-card"
              style={{ "--stage-accent": s.accent } as CSSProperties}
              aria-labelledby={`stage-${s.id}`}
            >
              <p className="eyebrow">Stage {s.id}</p>
              <h2 id={`stage-${s.id}`}>
                {s.name}: {s.title}
              </h2>
              <ul className="lessons">
                {s.lessons
                  .filter((l) => !l.hidden && l.status !== "planned")
                  .map((l) => (
                    <li key={l.id}>
                      <Link className="lesson-chip" to={`/lesson/${l.id}`}>
                        <span className="num">
                          {s.id}.{l.order}
                        </span>
                        {l.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </main>
  );
}
