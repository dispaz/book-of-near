import { useEffect, useId, useRef, useState } from "react";
import { helpFor, KEEP_NOTE } from "./cameraHelp";

const coarsePointer = () => {
  try {
    return window.matchMedia?.("(pointer: coarse)").matches ?? false;
  } catch {
    return false;
  }
};

/**
 * The 3D view's small camera cluster, at the top right of the free part of the canvas: "Controls" opens
 * a card that says how to move the camera, and "Reset view" (shown once the learner has moved it) glides
 * back to the step's picture. A disclosure, not a modal: Esc or a press outside closes the card, and Esc
 * (or its Close button) puts focus back on "Controls".
 */
export function CameraControls({ userView, onReset }: { userView: boolean; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const cardId = useId();
  const [coarse] = useState(coarsePointer);

  useEffect(() => {
    if (!open) return;
    const close = (refocus: boolean) => {
      setOpen(false);
      if (refocus) button.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(true);
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  return (
    <div className="sk-cam" ref={root}>
      <div className="sk-cam-buttons">
        {userView ? (
          <button
            type="button"
            className="pill"
            data-testid="reset-view"
            onClick={() => {
              onReset();
              // Reset view goes away once the camera is handed back: keep focus in the cluster.
              button.current?.focus();
            }}
          >
            Reset view
          </button>
        ) : null}
        <button
          ref={button}
          type="button"
          className="pill"
          aria-expanded={open}
          aria-controls={cardId}
          onClick={() => setOpen((o) => !o)}
        >
          Controls
        </button>
      </div>
      <section id={cardId} className="sk-cam-card" aria-label="Camera controls" hidden={!open}>
        {helpFor(coarse).map((g) => (
          <div key={g.kind} className="sk-cam-group">
            <h3>{g.title}</h3>
            <dl>
              {g.lines.map((l) => (
                <div key={l.what}>
                  <dt>{l.what}</dt>
                  <dd>{l.how}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="sk-cam-note">{KEEP_NOTE}</p>
        <button
          type="button"
          className="pill"
          onClick={() => {
            setOpen(false);
            button.current?.focus();
          }}
        >
          Close
        </button>
      </section>
    </div>
  );
}
