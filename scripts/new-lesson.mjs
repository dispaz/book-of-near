#!/usr/bin/env node
// Scaffolds a lesson from the template in docs/lesson-template.md.
//
//   npm run new-lesson -- <id> --stage N --title "Title" [--chain] [--book] [--order N]
//   node scripts/new-lesson.mjs <id> <stage> "Title" [--chain] [--book]
//
// Creates src/content/lessons/<id>/{manifest.ts,Scene.tsx} and e2e/lessons/<id>.spec.ts.
// --book also writes Scene3D.tsx: the 3D view as a book scene (docs/book-scene.md), and offers both views.
// A planned manifest with the same id is replaced in place (same order, same summary).
// A ready (or card) lesson is never overwritten.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE =
  'Usage: npm run new-lesson -- <id> --stage N --title "Title" [--chain] [--book] [--order N]\n' +
  '   or: node scripts/new-lesson.mjs <id> <stage> "Title" [--chain] [--book]';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Lessons with order 10 and up are backlog topics or developer placeholders, not numbered lessons. */
const NUMBERED_MAX = 10;

/** @param {string[]} argv */
export function parseArgs(argv) {
  if (argv.length === 0) throw new Error(USAGE);
  const positional = [];
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chain") flags.chain = true;
    else if (a === "--book") flags.book = true;
    else if (a === "--stage" || a === "--title" || a === "--order") {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value.\n${USAGE}`);
      flags[a.slice(2)] = v;
    } else if (a.startsWith("--")) throw new Error(`Unknown option ${a}.\n${USAGE}`);
    else positional.push(a);
  }
  const [id, posStage, ...posTitle] = positional;
  const stageText = flags.stage ?? posStage;
  const title = String(flags.title ?? posTitle.join(" ")).trim();
  if (!id || !ID_RE.test(id)) throw new Error(`The id must be kebab-case, like l-0-4-my-lesson.\n${USAGE}`);
  if (stageText === undefined || !/^\d+$/.test(String(stageText)))
    throw new Error(`Give the stage as a number.\n${USAGE}`);
  if (!title) throw new Error(`Give the lesson a title.\n${USAGE}`);
  if (flags.order !== undefined && !/^\d+$/.test(String(flags.order)))
    throw new Error(`--order must be a number.\n${USAGE}`);
  return {
    id,
    stage: Number(stageText),
    title,
    chain: flags.chain === true,
    book: flags.book === true,
    order: flags.order === undefined ? undefined : Number(flags.order),
  };
}

/** Reads the plain fields of a manifest.ts without running it. */
export function readManifestInfo(source) {
  const str = (k) => source.match(new RegExp(`\\b${k}:\\s*"((?:[^"\\\\]|\\\\.)*)"`))?.[1];
  const num = (k) => {
    const m = source.match(new RegExp(`\\b${k}:\\s*(\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  const info = { id: str("id"), stage: num("stage"), order: num("order"), status: str("status") };
  const summary = str("summary");
  return summary === undefined ? info : { ...info, summary: JSON.parse(`"${summary}"`) };
}

/** Decides the order and whether a planned manifest is replaced. Throws when the lesson must not be touched. */
export function planLesson(lessons, { id, stage, order }) {
  const existing = lessons.find((l) => l.id === id);
  if (existing) {
    if (existing.status !== "planned")
      throw new Error(
        `Lesson "${id}" is already ${existing.status}. Edit it by hand; the script never overwrites it.`,
      );
    if (existing.stage !== stage)
      throw new Error(
        `Planned lesson "${id}" belongs to stage ${existing.stage}. Use --stage ${existing.stage}.`,
      );
    const plan = { order: order ?? existing.order, replaces: true };
    return existing.summary ? { ...plan, summary: existing.summary } : plan;
  }
  const numbered = lessons.filter((l) => l.stage === stage && l.order < NUMBERED_MAX).map((l) => l.order);
  return { order: order ?? Math.max(0, ...numbered) + 1, replaces: false };
}

const q = (s) => JSON.stringify(s);

/** Where the researched lesson script lives: stage-0/0.1.md for numbered lessons, else <id>.md. */
export const scriptPath = ({ id, stage, order }) =>
  `docs/lessons/stage-${stage}/${order < NUMBERED_MAX ? `${stage}.${order}` : id}.md`;

export function renderManifest({ id, stage, title, order, chain, book, summary }) {
  const views = book
    ? `  // Both views draw one shared state (Scene.tsx); the 3D view is a book scene (docs/book-scene.md).
  views: ["2d", "3d"],
`
    : "";
  return `import type { LessonManifest } from "../../../app/types";

// Scaffolded by \`npm run new-lesson\`. Template: docs/lesson-template.md.
// Lesson script: ${scriptPath({ id, stage, order })}.
// Shape: hook → concept → do (gated) → check (gated) → honest take. Keep the step numbers in Scene.tsx in sync.
export default {
  id: ${q(id)},
  stage: ${stage},
  order: ${order},
  title: ${q(title)},
  status: "ready",
  needsChain: ${chain},
  summary: ${q(summary ?? "Placeholder summary: one line for the contents.")},
  steps: [
    {
      caption: ${q(`Placeholder hook: a question that makes "${title}" worth a few minutes.`)},
      explain: "Replace these placeholder steps with the lesson script.",
    },
    {
      caption: "Placeholder concept: the one idea this lesson teaches, in plain words.",
      explain: "Define each new term the first time it appears.",
    },
    {
      caption: "Your turn: press Try it and watch what happens.",
      action: { label: "Try it", gate: true },
    },
    {
      caption: "Quick check. Get every answer right to go on.",
      action: { label: "Answer the check", gate: true },
    },
    {
      caption: "Honest take: what NEAR does well here, and what it does badly.",
    },
  ],
${views}  scene: () => import("./Scene"),
} satisfies LessonManifest;
`;
}

export function renderScene({ title, chain, book }) {
  const props = `{ step, setGate, reducedMotion, mode${book ? ", view, flat" : ""}${chain ? ", reportEvidence" : ""} }`;
  const reactImport = book ? "{ lazy, Suspense, useState }" : "{ useState }";
  const lazy3d = book
    ? `
// The 3D view pulls in three.js, so it loads only when the learner picks 3D. It is a book scene
// (docs/book-scene.md) and draws the same state as the 2D view below.
const Scene3D = lazy(() => import("./Scene3D"));
`
    : "";
  const open3d = book
    ? `{view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D step={step} done={done} reducedMotion={reducedMotion} flat={flat} mode={mode} />
        </Suspense>
      ) : (
      `
    : "";
  const close3d = book ? ")}" : "";
  const chainImports = chain
    ? `import { useChain } from "../../../chain/ChainContext";
import { isChainError } from "../../../chain/errors";
import { transfer } from "../../../chain/ops";
import { parseNear } from "../../../chain/units";
`
    : "";
  const doAction = chain
    ? `  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ─── CHAIN ─────────────────────────────────────────────────────────────────────────
  // Everything on chain goes through the Chain interface (docs/chain.md). useChain() gives DemoChain
  // in demo mode and TestnetChain in testnet mode. Never call RPC, wallets or SDKs here.
  // TODO(author): replace the placeholder transfer with this lesson's operation (src/chain/ops.ts).
  // ───────────────────────────────────────────────────────────────────────────────────
  const chain = useChain();
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await transfer(chain, "book-of-near.testnet", parseNear("0.01"), {
        pace: reducedMotion ? "instant" : "realtime",
      });
      reportEvidence?.({ txHash: out.transaction.hash });
      setDone(true);
      setGate(true);
    } catch (e) {
      setError(isChainError(e) ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
`
    : `  const run = () => {
    setDone(true);
    setGate(true);
  };
`;
  const button = chain
    ? `<SceneAction onClick={run} disabled={busy}>
          {busy ? "Sending…" : "Try it"}
        </SceneAction>`
    : `<SceneAction onClick={run}>Try it</SceneAction>`;
  const status = chain ? `{error ?? (done ? "Done" : "Not yet")}` : `{done ? "Done" : "Not yet"}`;
  return `import ${reactImport} from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
${chainImports}${lazy3d}
// Step numbers (0-based) from manifest.ts.
const DO = 2;
const CHECK = 3;
const HONEST = 4;

// TODO(author): copy the check from the lesson script. Exactly one option per question is correct,
// and every wrong option says why it is wrong.
const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Placeholder question: which answer is right?",
    options: [
      { text: "This one", correct: true },
      { text: "Not this one", why: "Placeholder: say in one sentence why this option is wrong." },
    ],
  },
];

export default function Scene(${props}: SceneProps) {
  const [done, setDone] = useState(false);
  const [passed, setPassed] = useState(false);
${doAction}
  return (
    <>
      {/* 2D ink scene. Expose the state tests assert on in data-scene-state. */}
      ${open3d}<svg
        viewBox="0 0 800 500"
        role="img"
        aria-label={done ? "The action is done" : "Waiting for your action"}
        data-scene-state={done ? "done" : "idle"}
        data-mode={mode}
      >
        <rect x="230" y="120" width="340" height="220" rx="16" fill="var(--card)" stroke="var(--ink)" strokeWidth="3" />
        <text x="400" y="180" textAnchor="middle" fontFamily="Newsreader, serif" fontSize="26" fill="var(--ink)">
          {${q(title)}}
        </text>
        <circle
          cx="400"
          cy="260"
          r="36"
          stroke="var(--ink)"
          strokeWidth="3"
          fill={done ? "var(--accent)" : "#fff"}
          style={{ transition: reducedMotion ? "none" : "fill 0.4s" }}
        />
        <text x="400" y="320" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="24" fill="var(--ink)">
          ${status}
        </text>
      </svg>${close3d}
      {step === DO && !done ? (
        ${button}
      ) : null}
      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={passed}
          onPass={() => {
            setPassed(true);
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        // TODO(author): real strengths AND weaknesses from the script, with sources. Mark anything not yet
        // verified with { text, unverified: true } (see docs/spikes-seed.md).
        <HonestTake
          comparedWith="Ethereum"
          strengths={["Placeholder strength: something NEAR does better, with a source."]}
          weaknesses={["Placeholder weakness: something NEAR does worse or no better, with a source."]}
        />
      ) : null}
    </>
  );
}
`;
}

/** The 3D view as a book scene (docs/book-scene.md): a working starting point with TODO(author) marks. */
export function renderBookScene3D({ stage, title }) {
  return `import { useRef } from "react";
import {
  AccountBlock,
  BookScene,
  focusOf,
  inset,
  spreadBeside,
  spreadFor,
  textBlock,
  useFreeFrame,
  type Box,
  type Focus,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import { CHECK, tourFor, type Target } from "./tour";

// ─── BOOK SCENE (docs/book-scene.md) ───────────────────────────────────────────────────────────
// The figure stands on the RIGHT page. Wide screens print the step on the LEFT page; narrow screens,
// the quiz and the honest take keep the words docked and use the smaller centred spread.
// TODO(author): make FIGURE the ground box (x, z) that holds every step's objects and their labels.
// ────────────────────────────────────────────────────────────────────────────────────────────────
const FIGURE = { minX: -2, maxX: 2, minZ: -1.6, maxZ: 1.6 };
const SPREAD = { print: spreadBeside(FIGURE), docked: spreadFor(FIGURE) };
/** Where the step's words are printed on the left page. */
const TEXT = textBlock(SPREAD.print);
/** Running heads, only when the words are docked (the printed step heads the page otherwise). */
const HEADS: [string, string] = [${q(`Stage ${stage}`)}, ${q(title)}];
/** TODO(author): one figure caption per sheet (steps 0 to CHECK; later steps share the quiz's sheet). */
const FIGURES = ["Fig. 1  Placeholder", "Fig. 2  Placeholder", "Fig. 3  Placeholder", "Fig. 4  Placeholder"];
/** TODO(author): what the scene shows at each step, in one sentence, for screen readers. */
const DESCRIPTION = [
  "Placeholder: what the 3D scene shows at the hook.",
  "Placeholder: what the 3D scene shows at the concept.",
  "Placeholder: what the 3D scene shows while you try it.",
  "Placeholder: what the 3D scene shows at the check.",
  "Placeholder: what the 3D scene shows at the honest take.",
];

/** What the camera keeps in view at a step: the figure, with its labels. */
function focusFor(_step: number): Focus {
  const box: Box = [FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.6];
  return focusOf([box], 34);
}

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target, base: Focus): Focus {
  if (t.kind === "all") return { ...base, elevation: 28, azimuth: -14 };
  return { center: [0, 0.8, 0], width: 3, depth: 3, height: 2.6, elevation: 24, azimuth: -18 };
}

/** The 3D view: the same state as the 2D view in Scene.tsx, drawn on an open pop-up book. */
export default function Scene3D({
  step,
  done,
  reducedMotion,
  flat,
  mode,
}: {
  step: number;
  done: boolean;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  // Steps after the quiz stay on the quiz's sheet.
  const sheet = Math.min(step, CHECK);
  const focus = focusFor(step);
  const inner = inset(frame, { top: 24, bottom: 24 });
  return (
    <div
      ref={root}
      className={\`book-scene\${summary ? " summary" : ""}\`}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label={${q(`${title}, in 3D`)}}
    >
      <BookScene
        page={step}
        sheet={sheet}
        spread={print ? SPREAD.print : SPREAD.docked}
        heads={print ? undefined : HEADS}
        caption={FIGURES[sheet]}
        text={print ? TEXT : null}
        focus={focus}
        frame={inner}
        size={size}
        shots={tourFor(step)}
        shotFocus={(t: Target) => shotFocus(t, focus)}
        flat={flat}
        reducedMotion={reducedMotion}
        state={done ? "done" : "idle"}
        description={DESCRIPTION[step] ?? ""}
        status={done ? "Done" : undefined}
      >
        {/* Phones: the quiz and the honest take fill the screen, as in 2D. */}
        {summary && !wide ? null : <AccountBlock name={done ? "Done" : "Not yet"} coins={done ? 3 : 0} />}
      </BookScene>
      {/* The scene's own forms and results, over the right page (scene-kit.css places it). */}
      <div className="book-scene-panel" ref={panel} />
    </div>
  );
}
`;
}

/** The 3D view's camera tour (docs/book-scene.md, rule 5): pure, so it is unit tested without three.js. */
export function renderBookTour() {
  return `/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): a few shots, each
 * with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";

// Step numbers (0-based) from manifest.ts. Keep them in sync with Scene.tsx.
export const CHECK = 3;

/** What a tour shot looks at. TODO(author): add the lesson's objects. */
export type Target = { kind: "all" } | { kind: "block" };

/** The tour for a step: the whole figure first, then close-ups. None at the check and honest take. */
export function tourFor(step: number): Shot<Target>[] {
  if (step >= CHECK) return [];
  // TODO(author): two or three shots per step; close-up captions start with "Close up:".
  return [
    { caption: "The whole figure.", target: { kind: "all" } },
    { caption: "Close up: the block.", target: { kind: "block" } },
  ];
}
`;
}

export function renderBookTourTest() {
  return `import { describe, expect, it } from "vitest";
import { CHECK, tourFor } from "./tour";

describe("tourFor", () => {
  it("gives every step before the check a short tour that starts with the whole figure", () => {
    for (let step = 0; step < CHECK; step++) {
      const shots = tourFor(step);
      expect(shots.length).toBeGreaterThanOrEqual(2);
      expect(shots[0]!.target).toEqual({ kind: "all" });
      for (const s of shots.slice(1)) expect(s.caption).toMatch(/^Close up:/);
    }
  });

  it("has no tour at the check and the honest take", () => {
    expect(tourFor(CHECK)).toEqual([]);
    expect(tourFor(CHECK + 1)).toEqual([]);
  });
});
`;
}

/** The e2e tests every book lesson needs (docs/book-scene.md, "Tests every book lesson needs"). */
function bookSpecTests() {
  return `
  test.describe("3D book scene", () => {
    test.beforeEach(() => slow3d());

    test("wide screens print the step on the left page; the tour moves the camera and docks the words", async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(\`/lesson/\${ID}?view=3d&step=2\`);
      await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
      await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
      await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);

      const caption = page.getByTestId("tour-caption");
      await expect(caption).toHaveText(/^Fig\\. 2/);
      await page.getByRole("button", { name: "Play the tour" }).click();
      await expect(caption).not.toHaveText(/^Fig\\. 2/);
      // While the tour runs, the words go back to their docked place: still readable.
      await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
      await expect(page.getByTestId("caption")).toBeVisible();
      // A new step ends the tour and prints the words again.
      await nextStep(page);
      await expect(caption).toHaveText(/^Fig\\. 3/);
      await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
      await ctx.close();
    });

    test("phones keep the step's words docked, not printed on the page", async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(\`/lesson/\${ID}?view=3d&step=2\`);
      await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
      await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
      await expect(page.locator(".book-page")).toHaveCSS("display", "contents");
      await ctx.close();
    });
  });
`;
}

export function renderSpec({ id, stage, title, chain, book }) {
  const evidence = chain
    ? `, evidence: { txHash: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/) }`
    : "";
  return `import { expect, test } from "@playwright/test";
import { answerCheck, completionOf, ${book ? "LOAD_3D, " : ""}nextStep, seedRoute${book ? ", slow3d" : ""} } from "./helpers";

// Scaffolded by \`npm run new-lesson\`. Walks the lesson in demo mode (no wallet, no network).
const ID = ${q(id)};
const TITLE = ${q(title)};
const STAGE = ${stage};

test.beforeEach(({ page }) => seedRoute(page));

test.describe(\`lesson \${ID}\`, () => {
  test("is in the contents and walks to Finish in demo mode", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
    await expect(page).toHaveURL(new RegExp(\`/lesson/\${ID}\`));
    await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
    const scene = page.locator("[data-scene-state]");

    await nextStep(page); // hook → concept
    await nextStep(page); // concept → do
    await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
    await page.getByRole("button", { name: "Try it" }).click();
    await expect(scene).toHaveAttribute("data-scene-state", "done", { timeout: 10_000 });

    await nextStep(page); // do → check
    await answerCheck(page, ["This one"]); // TODO(author): the right answers, in question order

    await nextStep(page); // check → honest take
    await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
    await page.getByRole("button", { name: "Finish lesson" }).click();
    await expect(page.getByText("Lesson done")).toBeVisible();
    expect(await completionOf(page, ID)).toMatchObject({ stage: STAGE, mode: "demo"${evidence} });
  });

  // FAILING-THEN-PASSING STUB. When you start the real scene:
  //   1. change test.fixme to test and write the lesson-specific assertion below; it fails (red),
  //   2. build the scene until it passes (green). Never ship this as test.fixme.
  test.fixme("TODO(author): the scene shows the lesson's real outcome", async ({ page }) => {
    await page.goto(\`/lesson/\${ID}\`);
    await expect(page.getByTestId("scene-area")).toContainText("REPLACE WITH THE LESSON OUTCOME");
  });
${book ? bookSpecTests() : ""}});
`;
}

/** Writes the lesson files under `root`. Returns what it did. */
export function scaffold(root, opts) {
  const stagesDir = join(root, "src/content/stages");
  const hasStage =
    existsSync(stagesDir) && readdirSync(stagesDir).some((d) => d.split("-")[0] === String(opts.stage));
  if (!hasStage) throw new Error(`There is no stage ${opts.stage} in src/content/stages.`);

  const lessonsDir = join(root, "src/content/lessons");
  const lessons = existsSync(lessonsDir)
    ? readdirSync(lessonsDir)
        .map((d) => join(lessonsDir, d, "manifest.ts"))
        .filter((f) => existsSync(f))
        .map((f) => readManifestInfo(readFileSync(f, "utf8")))
    : [];
  const plan = planLesson(lessons, opts);
  const full = { ...opts, ...plan };
  const dir = join(lessonsDir, opts.id);
  const sceneFile = join(dir, "Scene.tsx");
  const specFile = join(root, "e2e/lessons", `${opts.id}.spec.ts`);
  const scene3dFile = join(dir, "Scene3D.tsx");
  const tourFile = join(dir, "tour.ts");
  const tourTestFile = join(dir, "tour.test.ts");
  const bookFiles = opts.book ? [scene3dFile, tourFile, tourTestFile] : [];
  for (const f of [sceneFile, ...bookFiles, specFile])
    if (existsSync(f)) throw new Error(`${f} already exists. Remove it first or edit it by hand.`);

  mkdirSync(dir, { recursive: true });
  mkdirSync(dirname(specFile), { recursive: true });
  const files = {
    [join(dir, "manifest.ts")]: renderManifest(full),
    [sceneFile]: renderScene(full),
    ...(opts.book
      ? {
          [scene3dFile]: renderBookScene3D(full),
          [tourFile]: renderBookTour(),
          [tourTestFile]: renderBookTourTest(),
        }
      : {}),
    [specFile]: renderSpec(full),
  };
  for (const [f, src] of Object.entries(files)) writeFileSync(f, src);
  return { ...plan, files: Object.keys(files) };
}

/** Formats the written files with the repo's Prettier config, so lint passes straight away. */
async function formatFiles(files) {
  const prettier = await import("prettier");
  for (const f of files) {
    const options = (await prettier.resolveConfig(f)) ?? {};
    writeFileSync(f, await prettier.format(readFileSync(f, "utf8"), { ...options, filepath: f }));
  }
}

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const res = scaffold(root, opts);
    await formatFiles(res.files);
    console.log(
      `${res.replaces ? "Replaced the planned lesson" : "Created lesson"} ${opts.id} (stage ${opts.stage}, order ${res.order}):`,
    );
    for (const f of res.files) console.log(`  ${f.slice(root.length + 1)}`);
    console.log(`
Next:
  1. Write or read the script in ${scriptPath({ ...opts, order: res.order })} (shape: docs/lesson-template.md).
  2. Turn the test.fixme in e2e/lessons/${opts.id}.spec.ts into a real, failing assertion, then build the scene.
  3. Open /lesson/${opts.id} in demo mode (npm run dev) and run npx playwright test e2e/lessons/${opts.id}.spec.ts.`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
