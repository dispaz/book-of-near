/**
 * Records the real app for the demo video: one WebM per shot in public/clips, plus manifest.json with
 * where each shot's useful footage starts (`trimStart`) and how long it runs. Remotion reads both.
 *
 *   npm run capture                       every shot, demo mode, against http://localhost:5173
 *   npm run capture -- --only learn,claim just these shots
 *   npm run capture -- --base http://localhost:4173   another server (e.g. `npm run preview`)
 *   npm run capture -- --headed           watch it record
 *   npm run capture -- --testnet          the claim shot on NEAR testnet (see video/README.md)
 *   npm run capture -- --manual claim     record by hand: a window opens, do the take, close it
 *
 * The app must be running (`npm run dev` in the repo root). Each shot gets a fresh browser context with
 * its own seeded progress, so shots never depend on each other.
 */
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { installCursor } from "./cursor.ts";
import { CARD, COLORS, INK } from "../../src/scene-kit/theme.ts";

const here = dirname(fileURLToPath(import.meta.url));
const CLIPS = join(here, "..", "public", "clips");
const MANIFEST = join(CLIPS, "manifest.json");
// A desktop layout (≥1100px: step copy printed on the left page) at a size that reads well in the
// video's 1680px-wide frame.
const SIZE = { width: 1600, height: 900 };

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    base: { type: "string", default: process.env.BASE_URL ?? "http://localhost:5173" },
    headed: { type: "boolean", default: false },
    testnet: { type: "boolean", default: false },
    manual: { type: "string" },
  },
});
const BASE = args.base!.replace(/\/$/, "");

// ---------------------------------------------------------------------------------------------------
// Seeds (the shapes e2e/badges.spec.ts uses: src/progress and src/badges/rules.ts).

const done = (lessonId: string, evidence?: Record<string, string>) => ({
  lessonId,
  stage: Number(lessonId.split("-")[1]),
  route: "newcomer",
  mode: "demo",
  completedAt: "2026-11-12T10:00:00.000Z",
  ...(evidence ? { evidence } : {}),
});
const STAGE0 = [
  done("l-0-1-blockchain-basics"),
  done("l-0-2-make-a-wallet"),
  done("l-0-3-send-a-transaction", { txHash: "8kQ3demo", mode: "demo" }),
];

interface Seed {
  /** Completions to put in bon:v1 (a route is always set, so "/" shows the contents). */
  completions?: unknown[];
  /** Show the closed-book cover on lessons. */
  cover?: boolean;
  /** Extra localStorage entries. */
  storage?: Record<string, string>;
}

// ---------------------------------------------------------------------------------------------------
// The director: what a shot can do. Every move is slow enough to read on video.

class Director {
  markedAt = 0;
  readonly page: Page;
  readonly startedAt: number;
  constructor(page: Page, startedAt: number) {
    this.page = page;
    this.startedAt = startedAt;
  }

  /** The useful footage starts here: everything before (loading, warm-up) is trimmed off. */
  mark() {
    this.markedAt = Date.now();
  }
  pause(ms: number) {
    return this.page.waitForTimeout(ms);
  }
  go(path: string) {
    return this.page.goto(BASE + path, { waitUntil: "networkidle" });
  }
  /** Waits for a lesson's 3D view to be drawn. */
  async in3d(timeout = 25_000) {
    await this.page.locator('[data-view="3d"]').first().waitFor({ timeout });
    await this.pause(600);
  }
  /** Glides the pointer to the element, then clicks it (Enter for 3D pick buttons a click cannot reach). */
  async tap(target: Locator, { glide = 22 } = {}) {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    const box = await target.boundingBox();
    if (box) await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: glide });
    try {
      await target.click({ timeout: 2_500 });
    } catch {
      await this.page.evaluate(() => (window as unknown as { __demoRing?: () => void }).__demoRing?.());
      await target.press("Enter");
    }
  }
  /** Types like a person. */
  async type(target: Locator, text: string, delay = 110) {
    await this.tap(target);
    await target.fill("");
    await target.pressSequentially(text, { delay });
  }
  /** Smooth wheel scroll. */
  async scroll(dy: number, ms = 1500) {
    const steps = Math.max(1, Math.round(ms / 30));
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, dy / steps);
      await this.page.waitForTimeout(30);
    }
  }
  button(name: string | RegExp) {
    return this.page.getByRole("button", { name, exact: typeof name === "string" });
  }
  async next() {
    await this.tap(this.button("Next step"));
    await this.pause(900);
  }
}

// ---------------------------------------------------------------------------------------------------
// The shots. Ids match `clip` in src/storyboard.ts; keep each take close to its scene's seconds there
// (longer takes are sped up, to at most 3x).

const L01 = "/lesson/l-0-1-blockchain-basics";
const STAGE_TOUR = [
  "l-1-1-claim-your-name",
  "l-2-1-follow-across-shards",
  "l-3-1-deploy-a-contract",
  "l-4-1-one-account-every-chain",
];
const CHECK_ANSWERS = [
  "The block's hash changes, and the next block still stores the old hash.",
  "The transaction is rejected and no balances change.",
  "It acts as a fingerprint: any change to the block gives a different hash.",
];
/** Where the app keeps the testnet practice key (src/chain/testnet/practice.ts PRACTICE_STORAGE_KEY). */
const PRACTICE_STORAGE_KEY = "bon:testnet-practice-account:v1";
/** A testnet account that holds a real badge (docs/badge-contract.md "First real claim"). */
const PROOF_ACCOUNT = process.env.PROOF_ACCOUNT ?? "bon-learner-mwe61s8i.testnet";

interface Shot {
  id: string;
  seed: Seed;
  run(d: Director): Promise<void>;
}

const SHOTS: Shot[] = [
  {
    id: "home",
    seed: { completions: [done("l-0-1-blockchain-basics")] },
    async run(d) {
      await d.go("/");
      await d.page.locator("section.stage-card").first().waitFor();
      await d.pause(500);
      d.mark();
      await d.page.mouse.move(960, 500, { steps: 10 });
      await d.pause(700);
      await d.scroll(1800, 2600);
      await d.pause(600);
      await d.scroll(-1800, 1200);
      await d.pause(500);
    },
  },
  {
    id: "book-open",
    seed: { cover: true },
    async run(d) {
      // Warm-up: load the 3D chunks once, so the take shows the pop-up, not a loading pause.
      await d.go(`${L01}?view=3d&step=2`);
      await d.in3d();
      await d.go(`${L01}?view=3d`);
      await d.page.getByTestId("book-cover").waitFor();
      await d.pause(400);
      d.mark();
      await d.pause(900);
      await d.tap(d.button("Open the book"), { glide: 30 });
      await d.in3d();
      await d.pause(2800);
    },
  },
  {
    id: "learn",
    seed: {},
    async run(d) {
      await d.go(`${L01}?view=3d`);
      await d.in3d();
      d.mark();
      await d.tap(d.button("Open Ben's notebook"), { glide: 14 });
      await d.pause(900);
      await d.next();
      const amount = d.page.getByLabel("Amount (coins)");
      await d.type(amount, "3");
      await d.tap(d.page.locator(".action-slot").getByRole("button", { name: "Send", exact: true }), {
        glide: 14,
      });
      await d.pause(1800);
      await d.next();
      await d.tap(d.button("Open block #1"), { glide: 14 });
      await d.pause(1300);
      // The same lesson state in 2D, then back to 3D.
      const views = d.page.getByRole("group", { name: "Scene view" });
      await d.tap(views.getByRole("button", { name: "2D" }), { glide: 14 });
      await d.pause(1100);
      await d.tap(views.getByRole("button", { name: "3D" }), { glide: 10 });
      await d.in3d();
      await d.pause(500);
    },
  },
  {
    id: "stages",
    seed: {},
    async run(d) {
      for (const id of STAGE_TOUR) {
        await d.go(`/lesson/${id}?view=3d`);
        await d.in3d().catch(() => undefined);
      }
      await d.go(`${L01}?view=3d`);
      await d.in3d();
      d.mark();
      for (const id of STAGE_TOUR) {
        await d.tap(d.page.getByRole("button", { name: "Contents" }), { glide: 12 });
        await d.pause(400);
        const link = d.page.getByRole("dialog", { name: "Contents" }).locator(`a[href$="/lesson/${id}"]`);
        if (await link.count()) await d.tap(link, { glide: 12 });
        else await d.go(`/lesson/${id}?view=3d`);
        await d.in3d().catch(() => undefined);
        await d.pause(700);
      }
    },
  },
  {
    id: "check",
    seed: {},
    async run(d) {
      await d.go(`${L01}?view=3d&step=8`);
      const check = d.page.getByRole("dialog", { name: "Quick check" });
      await check.waitFor();
      await d.pause(400);
      d.mark();
      const groups = check.getByRole("radiogroup");
      for (const [i, a] of CHECK_ANSWERS.entries()) {
        await d.tap(groups.nth(i).getByRole("radio", { name: a, exact: true }), { glide: 14 });
        await d.pause(250);
      }
      await d.tap(check.getByRole("button", { name: "Check answers" }));
      await d.pause(1800);
    },
  },
  {
    id: "claim",
    seed: args.testnet ? testnetSeed() : { completions: STAGE0 },
    async run(d) {
      await d.go(args.testnet ? "/?mode=testnet#stage-0-badge" : "/#stage-0-badge");
      const box = d.page.getByRole("region", { name: "Stage 0 badge" });
      await box.getByRole("button", { name: "Claim the stage 0 badge" }).waitFor({ timeout: 60_000 });
      await box.scrollIntoViewIfNeeded();
      await d.pause(500);
      d.mark();
      await d.pause(600);
      await d.tap(box.getByRole("button", { name: "Claim the stage 0 badge" }), { glide: 30 });
      await box.getByText("Stage 0 badge claimed").waitFor({ timeout: args.testnet ? 90_000 : 10_000 });
      await d.pause(1800);
      await d.tap(box.getByRole("link", { name: "My book" }));
      await d.page.getByRole("heading", { name: "Your badges" }).waitFor();
      await d.pause(800);
      await d.scroll(400, 900);
      await d.pause(1500);
    },
  },
  {
    // The app's badge checker in testnet mode: view calls straight to the real badge contract, no login.
    // (Explorers such as nearblocks put a bot check in front of headless browsers.)
    id: "proof",
    seed: { storage: { "bon:chain-mode": "testnet" } },
    async run(d) {
      await d.go("/check?mode=testnet");
      const input = d.page.getByLabel("Account");
      await input.waitFor();
      await d.pause(400);
      d.mark();
      await d.type(input, PROOF_ACCOUNT, 25);
      await d.tap(d.page.getByRole("button", { name: "Check", exact: true }));
      await d.page
        .getByRole("list", { name: `Badges of ${PROOF_ACCOUNT}` })
        .getByText("Claimed")
        .first()
        .waitFor({ timeout: 30_000 });
      await d.pause(1800);
    },
  },
];

/**
 * Testnet claim: the practice account and the progress come from files outside the repo, made by
 * really doing stage 0 on testnet (video/README.md):
 *   TESTNET_STORE     the practice key file the @testnet e2e tests use (e2e/lessons/helpers.ts)
 *   TESTNET_PROGRESS  the value of localStorage["bon:v1"] from that browser (devtools: copy(localStorage["bon:v1"]))
 */
function testnetSeed(): Seed {
  const storage: Record<string, string> = { "bon:chain-mode": "testnet" };
  const store = process.env.TESTNET_STORE;
  if (store && existsSync(store)) storage[PRACTICE_STORAGE_KEY] = readFileSync(store, "utf8");
  const progress = process.env.TESTNET_PROGRESS;
  if (!progress || !existsSync(progress)) {
    throw new Error(
      "--testnet needs TESTNET_PROGRESS (and TESTNET_STORE): see video/README.md, or use --manual claim",
    );
  }
  storage["bon:v1"] = readFileSync(progress, "utf8");
  return { storage };
}

// ---------------------------------------------------------------------------------------------------

async function newContext(browser: Browser, seed: Seed, videoDir: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    recordVideo: { dir: videoDir, size: SIZE },
  });
  const storage: Record<string, string> = {
    "bon:cover": seed.cover ? "on" : "off",
    "bon:v1": JSON.stringify({ v: 1, route: "newcomer", completions: seed.completions ?? [], evidence: {} }),
    ...seed.storage,
  };
  await ctx.addInitScript((entries) => {
    if (sessionStorage.getItem("demo-seeded")) return;
    for (const [k, v] of Object.entries(entries)) {
      if (k === "bon:cover" && v === "on") localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
    sessionStorage.setItem("demo-seeded", "1");
  }, storage);
  await ctx.addInitScript(installCursor, { ink: INK, card: CARD, accent: COLORS.orange });
  return ctx;
}

async function record(browser: Browser, shot: Shot, manifest: Record<string, unknown>) {
  const tmp = join(CLIPS, ".tmp", shot.id);
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await newContext(browser, shot.seed, tmp);
  const page = await ctx.newPage();
  const d = new Director(page, Date.now());
  const t0 = Date.now();
  process.stdout.write(`video: recording ${shot.id}… `);
  try {
    await shot.run(d);
  } catch (e) {
    await page.screenshot({ path: join(CLIPS, `${shot.id}.failed.png`) }).catch(() => undefined);
    await ctx.close();
    console.log(
      `failed (screenshot: public/clips/${shot.id}.failed.png)\n  ${(e as Error).message.split("\n")[0]}`,
    );
    return false;
  }
  const end = Date.now();
  const video = page.video();
  await ctx.close();
  const out = join(CLIPS, `${shot.id}.webm`);
  if (video) renameSync(await video.path(), out);
  rmSync(tmp, { recursive: true, force: true });
  const marked = d.markedAt || t0;
  manifest[shot.id] = {
    file: `${shot.id}.webm`,
    trimStart: Math.max(0, (marked - d.startedAt) / 1000),
    duration: (end - marked) / 1000,
  };
  console.log(`${((end - marked) / 1000).toFixed(1)} s`);
  return true;
}

/** --manual <id>: a visible window records while you do the take yourself; close the window to finish. */
async function manual(browser: Browser, id: string, manifest: Record<string, unknown>) {
  const tmp = join(CLIPS, ".tmp", id);
  const ctx = await newContext(
    browser,
    args.testnet ? { storage: { "bon:chain-mode": "testnet" } } : {},
    tmp,
  );
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(BASE + (args.testnet ? "/?mode=testnet" : "/"));
  console.log(`video: recording "${id}" by hand. Do the take, then close the browser window.`);
  await page.waitForEvent("close", { timeout: 0 });
  const video = page.video();
  await ctx.close();
  if (video) renameSync(await video.path(), join(CLIPS, `${id}.webm`));
  manifest[id] = { file: `${id}.webm`, trimStart: 0, duration: (Date.now() - t0) / 1000 };
  console.log(`video: saved public/clips/${id}.webm. Set its trimStart in public/clips/manifest.json.`);
}

async function main() {
  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    console.error(`video: nothing answers at ${BASE}. Start the app first: npm run dev (repo root).`);
    process.exit(1);
  }
  mkdirSync(CLIPS, { recursive: true });
  const manifest: Record<string, unknown> = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, "utf8"))
    : {};
  const gpu = process.platform === "darwin";
  const browser = await chromium.launch({
    headless: !(args.headed || args.manual),
    args: gpu ? ["--use-angle=metal", "--enable-unsafe-swiftshader"] : ["--enable-unsafe-swiftshader"],
  });
  let ok = true;
  try {
    if (args.manual) await manual(browser, args.manual, manifest);
    else {
      const only = args.only?.split(",").map((s) => s.trim());
      for (const shot of SHOTS.filter((s) => !only || only.includes(s.id))) {
        ok = (await record(browser, shot, manifest)) && ok;
        writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
      }
    }
  } finally {
    await browser.close();
    rmSync(join(CLIPS, ".tmp"), { recursive: true, force: true });
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(ok ? "video: done. Preview with npm run studio." : "video: some shots failed (see above).");
  process.exit(ok ? 0 : 1);
}

void main();
