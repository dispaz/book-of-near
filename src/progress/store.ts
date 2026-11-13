import {
  ROUTES,
  type CompletionRecord,
  type ExamRecord,
  type Position,
  type ProgressState,
  type Route,
} from "./types";

/** Versioned so a future format can ignore or migrate old data. */
export const STORAGE_KEY = "bon:v1";

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export interface Progress {
  route(): Route | null;
  setRoute(route: Route): void;
  /** Stores a completion record. One record per lesson; a newer one replaces the old one. */
  recordCompletion(record: CompletionRecord): void;
  completions(): CompletionRecord[];
  isComplete(lessonId: string): boolean;
  /** Evidence a scene reports before the lesson ends; merged into that lesson's next record. */
  reportEvidence(lessonId: string, evidence: Record<string, string>): void;
  /** Remembers the lesson and 1-based step the learner has open. */
  recordPosition(lessonId: string, step: number): void;
  /** Where "Continue where you left off" points, or null before any lesson was opened. */
  resumeTarget(): Position | null;
  /** Stores a final exam attempt (issue #28) and returns the record kept for its route (`keepBest`). */
  recordExam(result: Omit<ExamRecord, "attempts">): ExamRecord;
  /** The kept final exam record for an exam route, or null before the first attempt. */
  exam(route: ExamRecord["route"]): ExamRecord | null;
  subscribe(fn: () => void): () => void;
  /** Immutable state, replaced on every change (for useSyncExternalStore). */
  snapshot(): ProgressState;
  /** Re-reads storage, for example after another tab changed it. */
  reload(): void;
}

const empty = (): ProgressState => ({ v: 1, route: null, completions: [], position: null, evidence: {} });

const isExamRecord = (r: unknown): r is ExamRecord => {
  const e = r as Partial<ExamRecord> | null;
  return (
    !!e &&
    (e.route === "general" || e.route === "developer") &&
    typeof e.accountId === "string" &&
    Number.isInteger(e.score) &&
    Number.isInteger(e.total) &&
    typeof e.passed === "boolean" &&
    Number.isInteger(e.attempts)
  );
};

/** Only well-formed exam records survive a reload; none at all leaves the field out. */
function parseExams(raw: unknown): Pick<ProgressState, "exams"> {
  if (!raw || typeof raw !== "object") return {};
  const exams: NonNullable<ProgressState["exams"]> = {};
  for (const [route, rec] of Object.entries(raw as Record<string, unknown>))
    if (isExamRecord(rec) && rec.route === route) exams[rec.route] = rec;
  return Object.keys(exams).length ? { exams } : {};
}

/**
 * The record kept after an attempt: a pass is never replaced by a fail or a lower pass, otherwise the
 * newest attempt wins. Attempts always count up.
 */
export function keepBest(prev: ExamRecord | undefined, next: Omit<ExamRecord, "attempts">): ExamRecord {
  const attempts = (prev?.attempts ?? 0) + 1;
  if (prev?.passed && (!next.passed || next.score < prev.score)) return { ...prev, attempts };
  return { ...next, attempts };
}

function parse(raw: string | null): ProgressState {
  if (!raw) return empty();
  try {
    const d = JSON.parse(raw) as Partial<ProgressState> | null;
    if (!d || d.v !== 1) return empty();
    const pos = d.position;
    return {
      v: 1,
      route: ROUTES.includes(d.route as Route) ? (d.route as Route) : null,
      completions: Array.isArray(d.completions)
        ? d.completions.filter((c) => !!c && typeof c.lessonId === "string")
        : [],
      position: pos && typeof pos.lessonId === "string" && Number.isInteger(pos.step) ? pos : null,
      evidence: d.evidence && typeof d.evidence === "object" ? d.evidence : {},
      ...parseExams(d.exams),
    };
  } catch {
    return empty();
  }
}

/**
 * The single stage-completion interface. Progress lives in the browser only.
 * Storage errors (private mode, blocked site data) are swallowed: the session keeps working in memory.
 */
export function createProgress(storage: KeyValueStorage | null): Progress {
  const read = () => {
    try {
      return parse(storage?.getItem(STORAGE_KEY) ?? null);
    } catch {
      return empty();
    }
  };
  let state = read();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const fn of [...listeners]) fn();
  };

  const commit = (next: ProgressState) => {
    state = next;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked or full: keep the in-memory state */
    }
    emit();
  };

  return {
    route: () => state.route,
    setRoute: (route) => commit({ ...state, route }),
    recordCompletion: (record) => {
      const pending = state.evidence[record.lessonId];
      const evidence = pending || record.evidence ? { ...pending, ...record.evidence } : undefined;
      // The mode is where the evidence was made (a testnet tx stays testnet even if the learner
      // switched to demo before pressing Finish), else the mode active at Finish.
      const evidenceMode =
        evidence?.mode === "demo" || evidence?.mode === "testnet" ? evidence.mode : undefined;
      const full: CompletionRecord = evidence
        ? { ...record, mode: evidenceMode ?? record.mode, evidence }
        : record;
      const rest = { ...state.evidence };
      delete rest[record.lessonId];
      commit({
        ...state,
        completions: [...state.completions.filter((c) => c.lessonId !== record.lessonId), full],
        evidence: rest,
      });
    },
    completions: () => state.completions.map((c) => ({ ...c })),
    isComplete: (id) => state.completions.some((c) => c.lessonId === id),
    reportEvidence: (lessonId, evidence) =>
      commit({
        ...state,
        evidence: { ...state.evidence, [lessonId]: { ...state.evidence[lessonId], ...evidence } },
      }),
    recordPosition: (lessonId, step) => {
      if (state.position?.lessonId === lessonId && state.position.step === step) return;
      commit({ ...state, position: { lessonId, step } });
    },
    resumeTarget: () => (state.position ? { ...state.position } : null),
    recordExam: (result) => {
      const kept = keepBest(state.exams?.[result.route], result);
      commit({ ...state, exams: { ...state.exams, [result.route]: kept } });
      return { ...kept };
    },
    exam: (route) => {
      const r = state.exams?.[route];
      return r ? { ...r } : null;
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    snapshot: () => state,
    reload: () => {
      state = read();
      emit();
    },
  };
}
