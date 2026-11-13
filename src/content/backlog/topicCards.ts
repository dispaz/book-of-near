import type { LessonManifest } from "../../app/types";

/** The parts of `docs/curriculum/topics.json` the cards use. */
export interface Curriculum {
  topics: {
    name: string;
    stage: number;
    /** Two short sentences for the card. Optional: a card without one shows "not written yet". */
    summary?: string;
    comparison: string;
    /** 1: the comparison relies on secondary reports and is not yet checked. */
    verify: 0 | 1 | number;
    source: string | null;
    goingDeeper: boolean;
    showpiece: string | null;
  }[];
  showpieces: { s: number; name: string; covers: string[] }[];
}

/** Lesson id → the topic names (or name prefixes) that lesson teaches. */
export type Coverage = Record<string, string[]>;

/** Backlog cards sit after the numbered lessons of their stage (orders 1–9). */
const FIRST_CARD_ORDER = 10;
const STOP_WORDS = new Set(["a", "an", "and", "the", "of", "is", "to", "vs"]);

/** A short, stable kebab-case slug: the bracketed part and filler words dropped, at most four words. */
export function topicSlug(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .slice(0, 4)
    .join("-");
}

export const coveredBy = (name: string, coverage: Coverage) =>
  Object.values(coverage).some((prefixes) => prefixes.some((p) => name.startsWith(p)));

/** Every curriculum topic no lesson covers, as a locked (planned) card under its stage. */
export function buildTopicCards(curriculum: Curriculum, coverage: Coverage): LessonManifest[] {
  const nextOrder = new Map<number, number>();
  return curriculum.topics
    .filter((t) => !coveredBy(t.name, coverage))
    .map((t) => {
      const order = nextOrder.get(t.stage) ?? FIRST_CARD_ORDER;
      nextOrder.set(t.stage, order + 1);
      const scene = curriculum.showpieces.find(
        (s) => s.s === t.stage && s.covers.some((p) => t.name.startsWith(p)),
      );
      return {
        id: `topic-${t.stage}-${topicSlug(t.name)}`,
        stage: t.stage,
        order,
        title: t.name,
        status: "planned",
        needsChain: false,
        ...(t.summary ? { summary: t.summary } : {}),
        steps: [],
        topic: {
          comparison: t.comparison,
          goingDeeper: t.goingDeeper,
          unverified: t.verify === 1,
          ...(scene ? { plannedScene: scene.name } : {}),
          ...(t.source ? { source: t.source } : {}),
        },
      } satisfies LessonManifest;
    });
}

type Modules = Record<string, { default: LessonManifest }>;

/**
 * Adds the cards to the lesson modules for `buildRegistry`. A written lesson whose id is a card's id
 * replaces that card, so `npm run new-lesson -- <card id> ...` fills a card in. Cards of a stage that is
 * not registered (5 Enclave is parked, see docs/progress.md #30) are skipped.
 */
export function withTopicCards(
  lessonModules: Modules,
  cards: LessonManifest[],
  stageIds: Iterable<number>,
): Modules {
  const ids = new Set(Object.values(lessonModules).map((m) => m.default.id));
  const stages = new Set(stageIds);
  const extra = Object.fromEntries(
    cards.filter((c) => !ids.has(c.id) && stages.has(c.stage)).map((c) => [`topic:${c.id}`, { default: c }]),
  );
  return { ...lessonModules, ...extra };
}
