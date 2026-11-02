import { Link } from "react-router";
import { registry } from "../app/registry";

/** Panel opened from the stage bar's Contents button: every stage and its lessons. */
export function StageMenu({ currentId, onPick }: { currentId: string; onPick: () => void }) {
  return (
    <div className="stage-menu" role="dialog" aria-label="Contents">
      <Link to="/" onClick={onPick}>
        ← All stages
      </Link>
      {registry.stages.map((s) => {
        const visible = s.lessons.filter((l) => !l.hidden && l.status !== "planned");
        if (visible.length === 0) return null;
        return (
          <div key={s.id}>
            <h2>
              Stage {s.id} · {s.name}
            </h2>
            <ol>
              {visible.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/lesson/${l.id}`}
                    aria-current={l.id === currentId ? "page" : undefined}
                    onClick={onPick}
                  >
                    {l.title}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
