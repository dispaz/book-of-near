import { useEffect, useRef, useState } from "react";

/**
 * The closed book a lesson starts with: stage, lesson number, title and summary on the cover. Opening
 * it swings the cover round its spine (or fades it, with reduced motion) and reveals the first page.
 */
export function BookCover({
  stage,
  number,
  title,
  summary,
  steps,
  reducedMotion,
  onOpened,
}: {
  stage: string;
  number: string;
  title: string;
  summary: string;
  steps: number;
  reducedMotion: boolean;
  onOpened: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (!opening) return;
    const id = setTimeout(onOpened, reducedMotion ? 200 : 950);
    return () => clearTimeout(id);
  }, [opening, reducedMotion, onOpened]);
  return (
    <div
      className={`book-cover${opening ? " opening" : ""}${reducedMotion ? " still" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${title}: closed book`}
      data-testid="book-cover"
      onClick={() => setOpening(true)}
    >
      <div className="cover-face">
        <p className="cover-kicker">{stage}</p>
        <p className="cover-number">Lesson {number}</p>
        <h1 className="cover-title">{title}</h1>
        {summary ? <p className="cover-summary">{summary}</p> : null}
        <button
          ref={button}
          className="btn primary cover-open"
          onClick={(e) => {
            e.stopPropagation();
            setOpening(true);
          }}
        >
          Open the book
        </button>
        <p className="cover-steps">{steps} pages</p>
      </div>
    </div>
  );
}

/** Whether a lesson opened at `step` starts with its cover. Tests and the dev server can turn it off. */
export function startsClosed(stepParam: string | null): boolean {
  if (stepParam && stepParam !== "1") return false;
  try {
    return localStorage.getItem("bon:cover") !== "off";
  } catch {
    return true;
  }
}
