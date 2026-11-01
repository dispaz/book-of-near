import { useSyncExternalStore } from "react";
import { createProgress, STORAGE_KEY, type Progress } from "./store";
import type { ProgressState } from "./types";

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The app-wide progress store, backed by localStorage. */
export const progress: Progress = createProgress(typeof window === "undefined" ? null : browserStorage());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === STORAGE_KEY) progress.reload();
  });
  // Read-only view of progress for end-to-end tests and curious reviewers.
  const w = window as unknown as { __bookOfNear?: Record<string, unknown> };
  w.__bookOfNear = {
    ...w.__bookOfNear,
    progress: Object.freeze({
      route: () => progress.route(),
      completions: () => progress.completions(),
      isComplete: (id: string) => progress.isComplete(id),
      resumeTarget: () => progress.resumeTarget(),
    }),
  };
}

/** Re-renders when progress changes. */
export function useProgress(): ProgressState {
  return useSyncExternalStore(progress.subscribe, progress.snapshot, progress.snapshot);
}

export type { Progress } from "./store";
export type { CompletionRecord, Position, ProgressState, Route } from "./types";
