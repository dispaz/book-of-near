/** Helpers for the contents page: which lesson a stage opens on, and how far the page turn riffles. */

/** Leaves turned on the way to the lesson at `index` (its place in the book): 3 for the first ones, up to 8. */
export function leafCount(index: number): number {
  return Math.min(8, 3 + Math.floor(Math.max(0, index) / 3));
}

interface EntryLesson {
  id: string;
  hidden?: boolean;
}

/** The lesson a stage opens on: its first unread lesson, or its first one when all are read. */
export function stageEntry<L extends EntryLesson>(
  stage: { lessons: readonly L[] },
  done: ReadonlySet<string>,
  isOpen: (l: L) => boolean,
): L | undefined {
  const open = stage.lessons.filter((l) => !l.hidden && isOpen(l));
  return open.find((l) => !done.has(l.id)) ?? open[0];
}

/** Navigation state the contents page leaves when it turns to a lesson: the lesson then skips its cover. */
export interface TurnedState {
  turned: true;
}

export function turnedHere(state: unknown): boolean {
  return typeof state === "object" && state !== null && (state as { turned?: unknown }).turned === true;
}
