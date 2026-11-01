import type { ChainMode } from "../app/types";

/** A path through the book, picked by the opening quiz. */
export type Route = "newcomer" | "veteran" | "developer";

export const ROUTES: readonly Route[] = ["newcomer", "veteran", "developer"];

/**
 * Emitted once a learner finishes a lesson (or tests out of it). Badge claims and exam
 * gating read these records through the progress interface.
 */
export interface CompletionRecord {
  lessonId: string;
  stage: number;
  route: Route;
  mode: ChainMode;
  /** ISO 8601 timestamp. */
  completedAt: string;
  /** True when the learner skipped the lesson by passing a test-out. */
  testedOut?: boolean;
  /** What the lesson produced, for example `{ txHash: "..." }`. Never keys or seed words. */
  evidence?: Record<string, string>;
}

/** Last lesson and step the learner had open. `step` is 1-based, like `?step=N`. */
export interface Position {
  lessonId: string;
  step: number;
}

export interface ProgressState {
  v: 1;
  route: Route | null;
  completions: CompletionRecord[];
  position: Position | null;
  /** Evidence reported by a scene before the lesson is finished, by lesson id. */
  evidence: Record<string, Record<string, string>>;
}
