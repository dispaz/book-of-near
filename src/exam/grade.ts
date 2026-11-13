/**
 * Grading the final exam, and the signed receipt a passed exam earns (issue #28). Pure, no imports
 * beyond types: the Worker grades testnet exams with this, demo mode grades in the browser.
 */
import type { ExamQuestion } from "./bank";
import type { KeyEntry } from "./answerKey";
import { passMark, type ExamRoute } from "./routes";

/** `picks[i]` is the option chosen for question i, or null when it was left blank. */
export type Picks = (number | null)[];

export interface QuestionResult {
  id: string;
  picked: number | null;
  answer: number;
  correct: boolean;
  /** Why the right option is right. */
  why: string;
  /** Why the picked option is wrong (only for a wrong pick). */
  whyPicked?: string;
}

export interface Graded {
  score: number;
  total: number;
  passMark: number;
  passed: boolean;
  results: QuestionResult[];
}

/** Picks that are a list of option indices (or null) for exactly these questions. */
export function validPicks(questions: ExamQuestion[], picks: unknown): picks is Picks {
  return (
    Array.isArray(picks) &&
    picks.length === questions.length &&
    picks.every((p, i) => p === null || (Number.isInteger(p) && p >= 0 && p < questions[i]!.options.length))
  );
}

export function gradeExam(questions: ExamQuestion[], key: Record<string, KeyEntry>, picks: Picks): Graded {
  const results = questions.map((q, i): QuestionResult => {
    const k = key[q.id];
    if (!k) throw new Error(`No answer for ${q.id}`);
    const picked = picks[i] ?? null;
    const correct = picked === k.answer;
    return {
      id: q.id,
      picked,
      answer: k.answer,
      correct,
      why: k.why[k.answer] ?? "",
      ...(!correct && picked !== null ? { whyPicked: k.why[picked] ?? "" } : {}),
    };
  });
  const score = results.filter((r) => r.correct).length;
  const total = questions.length;
  const mark = passMark(total);
  return { score, total, passMark: mark, passed: score >= mark, results };
}

/** How long the app waits for the Worker to grade (it reads the badge contract first). */
export const EXAM_TIMEOUT_MS = 20_000;

/**
 * The text a passed exam's receipt signs: the evidence the final badge (#29) checks.
 * `bon-exam-v1|<badge contract>|<account>|<route>|<score>|<total>|<passed_at_ms>`.
 * Signed with the claim key (Worker) or the public demo claim key (demo mode). The `bon-exam-v1`
 * prefix can never equal a `bon-badge-v1` line, so the contract cannot mistake it for a mint claim.
 */
export function examMessage(
  contractId: string,
  accountId: string,
  route: ExamRoute,
  score: number,
  total: number,
  passedAtMs: number,
): string {
  return `bon-exam-v1|${contractId}|${accountId}|${route}|${score}|${total}|${passedAtMs}`;
}

/** A passed exam's signed receipt. */
export interface ExamReceipt {
  contractId: string;
  accountId: string;
  route: ExamRoute;
  score: number;
  total: number;
  passedAtMs: number;
  /** base64 of the 64-byte ed25519 signature over `examMessage`. */
  signature: string;
}
