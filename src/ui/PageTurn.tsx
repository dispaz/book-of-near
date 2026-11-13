import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { LessonManifest, StageEntry } from "../app/types";
import { lessonNumber } from "./contents";

/** How long one leaf takes to turn, the gap between leaves, and the pause on the lesson's opening page. */
const LEAF_MS = 560;
const STAGGER_MS = 95;
const LAND_MS = 380;

/** The whole turn, from the first leaf lifting to the lesson's page filling the book. */
const turnDuration = (leaves: number) => LEAF_MS + (leaves - 1) * STAGGER_MS + LAND_MS;

/**
 * The page turn from the contents to a lesson: `leaves` pages riffle over from right to left, uncovering
 * the lesson's opening page, which then fills the book; `onDone` follows (the lesson page takes over).
 * Decorative only (aria-hidden): the link that started it carries the meaning.
 */
export function PageTurn({
  lesson,
  stage,
  leaves,
  onDone,
}: {
  lesson: LessonManifest;
  stage: StageEntry;
  leaves: number;
  onDone: () => void;
}) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const riffle = LEAF_MS + (leaves - 1) * STAGGER_MS;
    const a = setTimeout(() => setLanded(true), riffle);
    const b = setTimeout(onDone, turnDuration(leaves));
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [leaves, onDone]);
  return (
    <div
      className={`page-turn${landed ? " landed" : ""}`}
      aria-hidden="true"
      data-testid="page-turn"
      style={
        {
          "--accent": stage.accent,
          "--leaf-ms": `${LEAF_MS}ms`,
          "--stagger": `${STAGGER_MS}ms`,
        } as CSSProperties
      }
    >
      <div className="turn-target">
        <p className="turn-kicker">
          Stage {stage.id} · {stage.name}
        </p>
        {lessonNumber(stage.id, lesson.order) ? (
          <p className="turn-number">Lesson {lessonNumber(stage.id, lesson.order)}</p>
        ) : null}
        <p className="turn-title">{lesson.title}</p>
        {lesson.summary ? <p className="turn-summary">{lesson.summary}</p> : null}
      </div>
      {Array.from({ length: leaves }, (_, i) => (
        <div key={i} className="turn-leaf" style={{ "--i": i, zIndex: leaves - i } as CSSProperties}>
          <div className="leaf-front" />
          <div className="leaf-back" />
        </div>
      ))}
    </div>
  );
}
