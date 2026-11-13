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

/**
 * The learner's best final exam result on one exam route (issue #28). Evidence for the final badge
 * (#29): a passed result carries the receipt the Worker (testnet) or the demo key (demo) signed.
 */
export interface ExamRecord {
  route: "general" | "developer";
  /** The account the exam was taken for (its badges opened the exam). */
  accountId: string;
  mode: ChainMode;
  score: number;
  total: number;
  passed: boolean;
  /** ISO 8601 time of this result. */
  takenAt: string;
  /** Attempts on this route so far, this one included. */
  attempts: number;
  /** A passed exam's signed receipt (src/exam/grade.ts `examMessage`). */
  receipt?: {
    contractId: string;
    passedAtMs: number;
    signature: string;
  };
}

export interface ProgressState {
  v: 1;
  route: Route | null;
  completions: CompletionRecord[];
  position: Position | null;
  /** Evidence reported by a scene before the lesson is finished, by lesson id. */
  evidence: Record<string, Record<string, string>>;
  /** Final exam results by exam route; absent before the first attempt. */
  exams?: Partial<Record<ExamRecord["route"], ExamRecord>>;
}
