import { describe, expect, it } from "vitest";
import { buildTopicCards, coveredBy, topicSlug, withTopicCards, type Curriculum } from "./topicCards";
import { LESSON_TOPICS } from "./coverage";
import { CURRICULUM, TOPIC_CARDS } from ".";
import { registry } from "../../app/registry";
import type { LessonManifest } from "../../app/types";

const topic = (name: string, stage: number, extra: Partial<Curriculum["topics"][number]> = {}) => ({
  name,
  stage,
  comparison: `${name} compared.`,
  verify: 0 as 0 | 1,
  source: null,
  goingDeeper: false,
  showpiece: null,
  ...extra,
});

const fake: Curriculum = {
  showpieces: [{ s: 0, name: "Two chains", covers: ["Bridges"] }],
  topics: [
    topic("Hashing and blocks", 0, { summary: "Blocks link by hash." }),
    topic("Bridges and why cross-chain is hard", 0, { showpiece: "B", verify: 1 }),
    topic("Roadmap: SPICE (consensus separated from execution)", 2, {
      goingDeeper: true,
      source: "https://example.org/spice",
    }),
  ],
};

describe("topicSlug", () => {
  it("makes a short kebab-case slug without the bracketed part", () => {
    expect(topicSlug("Roadmap: SPICE (consensus separated from execution)")).toBe("roadmap-spice");
    expect(topicSlug("Tokens: fungible, NFTs, stablecoins")).toBe("tokens-fungible-nfts-stablecoins");
    expect(topicSlug("Layer 1, layer 2, bridges and why cross-chain is hard")).toBe("layer-1-layer-2");
  });
});

describe("buildTopicCards", () => {
  it("turns every topic no lesson covers into a planned card under its stage", () => {
    const cards = buildTopicCards(fake, { "l-0-1": ["Hashing and blocks"] });
    expect(cards.map((c) => [c.id, c.stage, c.status])).toEqual([
      ["topic-0-bridges-why-cross-chain", 0, "planned"],
      ["topic-2-roadmap-spice", 2, "planned"],
    ]);
    for (const c of cards) {
      expect(c.steps).toEqual([]);
      expect(c.scene).toBeUndefined();
      expect(c.order).toBeGreaterThanOrEqual(10);
    }
  });

  it("carries the comparison, the going-deeper tag, the unverified flag and the planned scene", () => {
    const [bridges, spice] = buildTopicCards(fake, { "l-0-1": ["Hashing"] });
    expect(bridges!.topic).toEqual({
      comparison: "Bridges and why cross-chain is hard compared.",
      goingDeeper: false,
      unverified: true,
      plannedScene: "Two chains",
    });
    expect(bridges!.summary).toBeUndefined();
    expect(spice!.topic).toMatchObject({
      goingDeeper: true,
      unverified: false,
      source: "https://example.org/spice",
    });
  });

  it("keeps the summary written in the curriculum data", () => {
    const [hashing] = buildTopicCards(fake, {});
    expect(hashing!.summary).toBe("Blocks link by hash.");
  });

  it("orders cards after the numbered lessons, in curriculum order", () => {
    const cards = buildTopicCards(fake, {});
    expect(cards.filter((c) => c.stage === 0).map((c) => c.order)).toEqual([10, 11]);
    expect(cards.find((c) => c.stage === 2)!.order).toBe(10);
  });
});

describe("withTopicCards", () => {
  const card = (id: string): LessonManifest => ({
    id,
    stage: 0,
    order: 10,
    title: id,
    status: "planned",
    needsChain: false,
    steps: [],
  });

  it("adds the cards next to the lesson modules", () => {
    const merged = withTopicCards({ "a/manifest.ts": { default: card("l-a") } }, [card("topic-0-x")], [0]);
    expect(Object.values(merged).map((m) => m.default.id)).toEqual(["l-a", "topic-0-x"]);
  });

  it("lets a written lesson with the card's id replace the card (the lesson command fills cards in)", () => {
    const lesson = { ...card("topic-0-x"), status: "ready" as const, steps: [{ caption: "x" }] };
    const merged = withTopicCards({ "x/manifest.ts": { default: lesson } }, [card("topic-0-x")], [0]);
    expect(Object.values(merged).map((m) => m.default)).toEqual([lesson]);
  });

  it("skips cards whose stage is not registered instead of failing", () => {
    const parked = { ...card("topic-5-y"), stage: 5 };
    const merged = withTopicCards({}, [card("topic-0-x"), parked], [0, 1]);
    expect(Object.values(merged).map((m) => m.default.id)).toEqual(["topic-0-x"]);
  });
});

describe("the real curriculum", () => {
  const covered = CURRICULUM.topics.filter((t) => coveredBy(t.name, LESSON_TOPICS));
  // No stage is parked any more (docs/progress.md, #30): stage 5 came back with lesson 5.1 (#84) and
  // stage 6 with lesson 6.1 (#86). To park a stage again, remove its stage folder and list it here.
  const PARKED_STAGES: number[] = [];
  const shown = CURRICULUM.topics.filter((t) => !covered.includes(t) && !PARKED_STAGES.includes(t.stage));

  it("has no registered stage for the parked ones", () => {
    for (const n of PARKED_STAGES) expect(registry.stages.map((s) => s.id)).not.toContain(n);
    expect(CURRICULUM.topics.filter((t) => PARKED_STAGES.includes(t.stage))).toHaveLength(0);
    for (const n of [5, 6]) expect(registry.stages.map((s) => s.id)).toContain(n);
  });

  it("maps every coverage entry to one real lesson and exactly one topic", () => {
    for (const [lessonId, prefixes] of Object.entries(LESSON_TOPICS)) {
      expect(registry.lessons.has(lessonId), lessonId).toBe(true);
      for (const p of prefixes) {
        expect(
          CURRICULUM.topics.filter((t) => t.name.startsWith(p)).map((t) => t.name),
          p,
        ).toHaveLength(1);
      }
    }
  });

  it("registers one locked card per topic without a lesson, so the card count matches the data", () => {
    const cards = [...registry.lessons.values()].filter((l) => l.topic);
    expect(cards).toHaveLength(shown.length);
    expect(cards).toHaveLength(TOPIC_CARDS.filter((c) => !PARKED_STAGES.includes(c.stage)).length);
    expect(cards.every((c) => c.status === "planned")).toBe(true);
    expect(cards.map((c) => c.title).sort()).toEqual(shown.map((t) => t.name).sort());
  });

  it("puts every card under its own stage", () => {
    for (const t of shown) {
      const stage = registry.stages.find((s) => s.id === t.stage);
      expect(stage, `stage ${t.stage}`).toBeDefined();
      expect(stage!.lessons.map((l) => l.title)).toContain(t.name);
    }
  });

  it("tags every going-deeper topic", () => {
    const deep = [...registry.lessons.values()].filter((c) => c.topic?.goingDeeper).map((c) => c.title);
    const expected = shown.filter((t) => t.goingDeeper).map((t) => t.name);
    expect(deep).toEqual(expected);
    expect(deep.length).toBeGreaterThan(0);
  });

  it("gives each card a unique id and a summary (parked stages' cards too)", () => {
    expect(new Set(TOPIC_CARDS.map((c) => c.id)).size).toBe(TOPIC_CARDS.length);
    for (const c of TOPIC_CARDS) expect(c.summary, c.id).toBeTruthy();
  });
});
