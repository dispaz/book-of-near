import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseArgs,
  readManifestInfo,
  planLesson,
  renderManifest,
  renderScene,
  renderSpec,
  scaffold,
  scriptPath,
  // @ts-expect-error plain JS module without types
} from "./new-lesson.mjs";

describe("parseArgs", () => {
  it("reads flags", () => {
    expect(
      parseArgs(["my-lesson", "--stage", "2", "--title", "Hello there", "--chain", "--order", "4"]),
    ).toEqual({ id: "my-lesson", stage: 2, title: "Hello there", chain: true, order: 4 });
  });

  it("reads positionals, as the /new-lesson command passes them", () => {
    expect(parseArgs(["my-lesson", "1", "Claim a name"])).toEqual({
      id: "my-lesson",
      stage: 1,
      title: "Claim a name",
      chain: false,
      order: undefined,
    });
  });

  it.each([
    [[], /usage/i],
    [["Bad_Id", "--stage", "0", "--title", "x"], /id/i],
    [["ok-id", "--title", "x"], /stage/i],
    [["ok-id", "--stage", "0"], /title/i],
    [["ok-id", "--stage", "zero", "--title", "x"], /stage/i],
  ])("rejects %j", (argv, msg) => {
    expect(() => parseArgs(argv)).toThrow(msg);
  });
});

describe("readManifestInfo", () => {
  it("pulls id, stage, order, status and summary out of a manifest", () => {
    const src = `export default {\n  id: "l-0-1-x",\n  stage: 0,\n  order: 1,\n  title: "T",\n  status: "planned",\n  summary: "Move coins.",\n};`;
    expect(readManifestInfo(src)).toEqual({
      id: "l-0-1-x",
      stage: 0,
      order: 1,
      status: "planned",
      summary: "Move coins.",
    });
  });
});

describe("planLesson", () => {
  const lessons = [
    { id: "a", stage: 0, order: 1, status: "ready" },
    { id: "b", stage: 0, order: 2, status: "planned", summary: "Kept summary." },
    { id: "backlog", stage: 0, order: 10, status: "planned" },
    { id: "placeholder", stage: 0, order: 90, status: "ready" },
    { id: "c", stage: 1, order: 5, status: "ready" },
  ];

  it("appends a new lesson after the stage's numbered lessons", () => {
    expect(planLesson(lessons, { id: "new", stage: 0 })).toEqual({ order: 3, replaces: false });
    expect(planLesson(lessons, { id: "new", stage: 4 })).toEqual({ order: 1, replaces: false });
  });

  it("honours --order", () => {
    expect(planLesson(lessons, { id: "new", stage: 0, order: 7 })).toEqual({ order: 7, replaces: false });
  });

  it("replaces a planned lesson in place, keeping its order and summary", () => {
    expect(planLesson(lessons, { id: "b", stage: 0 })).toEqual({
      order: 2,
      replaces: true,
      summary: "Kept summary.",
    });
  });

  it("refuses to overwrite a ready lesson", () => {
    expect(() => planLesson(lessons, { id: "a", stage: 0 })).toThrow(/already ready/);
  });

  it("refuses to move a planned lesson to another stage", () => {
    expect(() => planLesson(lessons, { id: "b", stage: 1 })).toThrow(/stage 0/);
  });
});

describe("scriptPath", () => {
  it("points numbered lessons at <stage>.<order>.md and others at <id>.md", () => {
    expect(scriptPath({ id: "l-0-1-x", stage: 0, order: 1 })).toBe("docs/lessons/stage-0/0.1.md");
    expect(scriptPath({ id: "extra", stage: 2, order: 12 })).toBe("docs/lessons/stage-2/extra.md");
  });
});

describe("templates", () => {
  const opts = { id: "x-lesson", stage: 2, title: 'Say "hi"', order: 3, chain: false };

  it("writes a ready manifest with the five template steps and gated do + check", () => {
    const src = renderManifest(opts);
    expect(src).toContain('id: "x-lesson"');
    expect(src).toContain('title: "Say \\"hi\\""');
    expect(src).toContain('status: "ready"');
    expect(src).toContain("needsChain: false");
    expect(src).toContain("order: 3");
    expect(src.match(/gate: true/g)).toHaveLength(2);
    expect(src).toContain('scene: () => import("./Scene")');
  });

  it("writes a scene that uses Check and HonestTake and never imports the chain", () => {
    const src = renderScene(opts);
    expect(src).toContain('from "../../../lesson-kit"');
    expect(src).toContain("<Check");
    expect(src).toContain("<HonestTake");
    expect(src).not.toMatch(/^import .*chain/m);
  });

  it("goes through useChain in a chain lesson, honours reduced motion and reports evidence", () => {
    const src = renderScene({ ...opts, chain: true });
    expect(src).toMatch(/^import \{ useChain \} from "..\/..\/..\/chain\/ChainContext";$/m);
    expect(src).toContain("const chain = useChain()");
    expect(src).toContain('pace: reducedMotion ? "instant" : "realtime"');
    expect(src).toContain("reportEvidence?.({ txHash: out.transaction.hash })");
    expect(src).toContain("TODO(author)");
  });

  it("writes an e2e spec that walks to Finish and holds a fixme stub for the author", () => {
    const src = renderSpec(opts);
    expect(src).toContain('const ID = "x-lesson"');
    expect(src).toContain("Finish lesson");
    expect(src).toContain("completionOf");
    expect(src).toContain("test.fixme(");
    expect(renderSpec({ ...opts, chain: true })).toContain("txHash");
  });
});

describe("scaffold", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "new-lesson-"));
    mkdirSync(join(root, "src/content/stages/0-blank-page"), { recursive: true });
    mkdirSync(join(root, "src/content/lessons/l-0-1-planned"), { recursive: true });
    writeFileSync(
      join(root, "src/content/lessons/l-0-1-planned/manifest.ts"),
      `export default { id: "l-0-1-planned", stage: 0, order: 1, title: "Old", status: "planned", needsChain: false, steps: [] };`,
    );
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("creates manifest, scene and e2e spec for a new lesson", () => {
    const res = scaffold(root, { id: "throwaway", stage: 0, title: "Throwaway", chain: false });
    expect(res.replaces).toBe(false);
    expect(res.order).toBe(2);
    for (const f of [
      "src/content/lessons/throwaway/manifest.ts",
      "src/content/lessons/throwaway/Scene.tsx",
      "e2e/lessons/throwaway.spec.ts",
    ]) {
      expect(existsSync(join(root, f))).toBe(true);
    }
  });

  it("replaces a planned manifest in place", () => {
    const res = scaffold(root, { id: "l-0-1-planned", stage: 0, title: "New title", chain: true });
    expect(res.replaces).toBe(true);
    const src = readFileSync(join(root, "src/content/lessons/l-0-1-planned/manifest.ts"), "utf8");
    expect(src).toContain('status: "ready"');
    expect(src).toContain("order: 1");
    expect(src).toContain("needsChain: true");
    // A second run refuses: the lesson is now ready.
    expect(() => scaffold(root, { id: "l-0-1-planned", stage: 0, title: "Again", chain: false })).toThrow(
      /already ready/,
    );
  });

  it("refuses an unknown stage", () => {
    expect(() => scaffold(root, { id: "x", stage: 5, title: "X", chain: false })).toThrow(/stage 5/);
  });
});
