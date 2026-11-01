#!/usr/bin/env node
// Scaffolds a lesson from the template in docs/lesson-template.md.
//
//   npm run new-lesson -- <id> --stage N --title "Title" [--chain] [--order N]
//   node scripts/new-lesson.mjs <id> <stage> "Title" [--chain]
//
// Creates src/content/lessons/<id>/{manifest.ts,Scene.tsx} and e2e/lessons/<id>.spec.ts.
// A planned manifest with the same id is replaced in place (same order, same summary).
// A ready (or card) lesson is never overwritten.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE =
  'Usage: npm run new-lesson -- <id> --stage N --title "Title" [--chain] [--order N]\n' +
  '   or: node scripts/new-lesson.mjs <id> <stage> "Title" [--chain]';

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

export function renderManifest({ id, stage, title, order, chain, summary }) {
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
  scene: () => import("./Scene"),
} satisfies LessonManifest;
`;
}

export function renderScene({ title, chain }) {
  const props = chain
    ? "{ step, setGate, reducedMotion, mode, reportEvidence }"
    : "{ step, setGate, reducedMotion, mode }";
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
  return `import { useState } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
${chainImports}
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
      <svg
        viewBox="0 0 800 500"
        role="img"
        aria-label={done ? "The action is done" : "Waiting for your action"}
        data-scene-state={done ? "done" : "idle"}
        data-mode={mode}
      >
        <rect x="230" y="120" width="340" height="220" rx="16" fill="#fffdf7" stroke="#16141f" strokeWidth="3" />
        <text x="400" y="180" textAnchor="middle" fontFamily="Newsreader, serif" fontSize="26" fill="#16141f">
          {${q(title)}}
        </text>
        <circle
          cx="400"
          cy="260"
          r="36"
          stroke="#16141f"
          strokeWidth="3"
          fill={done ? "var(--accent)" : "#fff"}
          style={{ transition: reducedMotion ? "none" : "fill 0.4s" }}
        />
        <text x="400" y="320" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="24" fill="#16141f">
          ${status}
        </text>
      </svg>
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

export function renderSpec({ id, stage, title, chain }) {
  const evidence = chain
    ? `, evidence: { txHash: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/) }`
    : "";
  return `import { expect, test } from "@playwright/test";
import { answerCheck, completionOf, nextStep, seedRoute } from "./helpers";

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
});
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
  for (const f of [sceneFile, specFile])
    if (existsSync(f)) throw new Error(`${f} already exists. Remove it first or edit it by hand.`);

  mkdirSync(dir, { recursive: true });
  mkdirSync(dirname(specFile), { recursive: true });
  const files = {
    [join(dir, "manifest.ts")]: renderManifest(full),
    [sceneFile]: renderScene(full),
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
