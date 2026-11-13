/**
 * Records the real app for the demo video: one WebM per shot in public/clips, plus manifest.json with
 * where each shot's useful footage starts (`trimStart`), how long it runs, and its named `beats` (seconds
 * after the start) that the storyboard times notes and speed ramps to. Remotion reads both.
 *
 *   npm run capture                         every shot (claim in demo mode unless prepared, below)
 *   npm run capture -- --only learn,claim   just these shots
 *   npm run capture -- --base <url>         another server (default http://localhost:5173)
 *   npm run capture -- --headed             watch it record
 *   npm run capture -- --prep-testnet       send lesson 0.3's real testnet transfer, save the state
 *   npm run capture -- --testnet            record claim + proof on NEAR testnet from that state
 *   npm run capture -- --manual claim       record by hand: a window opens, do the take, close it
 *
 * The app must be running (`npm run dev` at the repo root; for testnet with the Worker, see README.md).
 * Each shot gets a fresh browser context with its own seeded progress, so shots never depend on each other.
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
/** Testnet state made by --prep-testnet: a throwaway practice key and progress. Gitignored. */
const TESTNET_STATE = join(here, "..", ".capture-profile", "testnet.json");
// A desktop layout (≥1100px: step copy printed on the left page) at a size that reads well in the
// video's 1680px-wide frame.
const SIZE = { width: 1600, height: 900 };

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    base: { type: "string", default: process.env.BASE_URL ?? "http://localhost:5173" },
    headed: { type: "boolean", default: false },
    testnet: { type: "boolean", default: false },
    "prep-testnet": { type: "boolean", default: false },
    manual: { type: "string" },
  },
});
const BASE = args.base!.replace(/\/$/, "");

/** Where the app keeps the testnet practice key (src/chain/testnet/practice.ts PRACTICE_STORAGE_KEY). */
const PRACTICE_KEY = "bon:testnet-practice-account:v1";

// ---------------------------------------------------------------------------------------------------
// Seeds (the shapes e2e/badges.spec.ts uses: src/progress and src/badges/rules.ts).

const done = (lessonId: string, evidence?: Record<string, string>, mode = "demo") => ({
  lessonId,
  stage: Number(lessonId.split("-")[1]),
  route: "newcomer",
  mode,
  completedAt: "2026-11-13T10:00:00.000Z",
  ...(evidence ? { evidence } : {}),
});
const STAGE0_DEMO = [
  done("l-0-1-blockchain-basics"),
  done("l-0-2-make-a-wallet"),
  done("l-0-3-send-a-transaction", { txHash: "8kQ3demo", mode: "demo" }),
];

interface Seed {
  /** Completions to put in bon:v1 (a route is always set, so "/" shows the contents). */
  completions?: unknown[];
  /** Show the closed-book cover on lessons. */
  cover?: boolean;
  /** Extra localStorage entries (win over the above). */
  storage?: Record<string, string>;
}

interface TestnetState {
  accountId: string;
  txHash: string;
  practice: string;
  evidence: Record<string, string>;
}
const testnetState = (): TestnetState | undefined =>
  existsSync(TESTNET_STATE) ? JSON.parse(readFileSync(TESTNET_STATE, "utf8")) : undefined;

/** Stage 0 finished on testnet: 0.1 and 0.2 done, 0.3 done with its real transfer as evidence. */
function testnetSeed(): Seed {
  const s = testnetState();
  if (!s) throw new Error("--testnet needs the state from --prep-testnet first (see video/README.md)");
  const completions = [
    done("l-0-1-blockchain-basics", undefined, "testnet"),
    done("l-0-2-make-a-wallet", undefined, "testnet"),
    done("l-0-3-send-a-transaction", s.evidence, "testnet"),
  ];
  return {
    storage: {
      "bon:chain-mode": "testnet",
      [PRACTICE_KEY]: s.practice,
      "bon:v1": JSON.stringify({ v: 1, route: "newcomer", completions, evidence: {} }),
    },
  };
}

// ---------------------------------------------------------------------------------------------------
// The director: what a shot can do. Every move is slow enough to read on video.

class Director {
  markedAt = 0;
  beats: Record<string, number> = {};
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
  /** A named moment in the take (seconds after mark): the storyboard times notes and ramps to it. */
  beat(name: string) {
    this.beats[name] = (Date.now() - this.markedAt) / 1000;
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
  /**
   * Brings the element into view with one eased scroll of its nearest scrolling ancestor, clamped to
   * what that ancestor can really scroll: no wheel events piling up against the end of the page, so
   * the take never jitters. Does nothing when the element is already well in view.
   */
  async reveal(target: Locator, { ms = 900, align = 0.4 } = {}) {
    const handle = await target.elementHandle();
    if (!handle) return;
    const wait = await handle.evaluate(
      (el, o) => {
        const scroller = (() => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
          }
          return document.scrollingElement as HTMLElement;
        })();
        const isRoot = scroller === document.scrollingElement;
        const view = isRoot
          ? { top: 0, height: window.innerHeight }
          : { top: scroller.getBoundingClientRect().top, height: scroller.clientHeight };
        const r = el.getBoundingClientRect();
        const margin = view.height * 0.12;
        if (r.top >= view.top + margin && r.bottom <= view.top + view.height - margin) return 0;
        const from = scroller.scrollTop;
        const max = scroller.scrollHeight - scroller.clientHeight;
        const to = Math.max(0, Math.min(max, from + (r.top - view.top) - view.height * o.align));
        if (Math.abs(to - from) < 2) return 0;
        const t0 = performance.now();
        const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / o.ms);
          scroller.scrollTop = from + (to - from) * ease(t);
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        return o.ms;
      },
      { ms, align },
    );
    if (wait) await this.pause(wait + 80);
  }
  /** Glides the pointer onto the element. */
  async hover(target: Locator, { glide = 22 } = {}) {
    await this.reveal(target);
    const box = await target.boundingBox();
    if (box) await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: glide });
  }
  /** Glides the pointer to the element, then clicks it (Enter for 3D pick buttons a click cannot reach). */
  async tap(target: Locator, { glide = 22 } = {}) {
    await this.hover(target, { glide });
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
  button(name: string | RegExp) {
    return this.page.getByRole("button", { name, exact: typeof name === "string" });
  }
  async next() {
    await this.tap(this.button("Next step"), { glide: 16 });
    await this.pause(900);
  }
}

// ---------------------------------------------------------------------------------------------------
// The shots. Ids match `clip` in src/storyboard.ts; beats named here are the ones the storyboard uses.

const L01 = "/lesson/l-0-1-blockchain-basics";
const L03 = "/lesson/l-0-3-send-a-transaction";
const RIGHT = [
  "The block's hash changes, and the next block still stores the old hash.",
  "The transaction is rejected and no balances change.",
  "It acts as a fingerprint: any change to the block gives a different hash.",
];
const WRONG = [
  "Old blocks are locked with a password.",
  "Ben gets 7 coins and the rest is skipped.",
  "It encrypts the block so nobody can read it.",
];

interface Shot {
  id: string;
  seed: () => Seed;
  run(d: Director): Promise<void>;
}

const SHOTS: Shot[] = [
  {
    // The contents is the book's first spread: run a finger down the stages, then pick lesson 0.1, and
    // the book turns its pages to it and the 3D scene grows out of the page.
    id: "contents",
    seed: () => ({}),
    async run(d) {
      // Warm-up: load the 3D chunks once, so the take shows the pop-up, not a loading pause.
      await d.go(`${L01}?view=3d&step=2`);
      await d.in3d();
      await d.page.evaluate(() => {
        const v = JSON.parse(localStorage.getItem("bon:v1") ?? "{}");
        localStorage.setItem("bon:v1", JSON.stringify({ ...v, position: null }));
      });
      await d.go("/");
      const toc = d.page.getByRole("navigation", { name: "Contents" });
      await toc.waitFor();
      await d.page.mouse.move(800, 450);
      await d.pause(500);
      d.mark();
      for (const n of [0, 1, 2, 3, 4]) {
        const heading = d.page.locator(`#stage-${n}`);
        await d.reveal(heading, { ms: 700, align: 0.3 });
        await d.hover(heading, { glide: 14 });
        d.beat(`stage-${n}`);
        await d.pause(450);
      }
      const first = toc.getByRole("link", { name: "How a blockchain and a transaction work" });
      await d.reveal(first, { ms: 1000, align: 0.35 });
      d.beat("pick");
      await d.tap(first, { glide: 18 });
      d.beat("turn");
      await d.in3d();
      await d.pause(1600);
    },
  },
  {
    // Highlights, not a walkthrough: the lesson menu, then a block opened for a close look at its
    // transaction. Step 3 already has block #1 (Ana sent Ben 3 coins in step 2).
    id: "learn",
    seed: () => ({}),
    async run(d) {
      await d.go(`${L01}?view=3d&step=3`);
      await d.in3d();
      await d.page.mouse.move(1150, 160);
      await d.pause(800);
      d.mark();
      await d.pause(400);
      d.beat("menu");
      await d.tap(d.page.getByRole("button", { name: "Contents" }), { glide: 28 });
      await d.pause(1600);
      await d.tap(d.page.getByRole("button", { name: "Contents" }), { glide: 8 });
      await d.pause(500);
      d.beat("objects");
      // A finger along the ledgers: each lifts as the pointer passes.
      for (const [x, y] of [
        [840, 320],
        [1080, 320],
        [1320, 320],
      ] as const) {
        await d.page.mouse.move(x, y, { steps: 16 });
        await d.pause(250);
      }
      await d.hover(d.button("Open block #1"), { glide: 22 });
      await d.pause(400);
      d.beat("block");
      await d.tap(d.button("Open block #1"), { glide: 4 });
      await d.pause(3600);
    },
  },
  {
    id: "check",
    seed: () => ({}),
    async run(d) {
      await d.go(`${L01}?view=3d&step=8`);
      const check = d.page.getByRole("dialog", { name: "Quick check" });
      await check.waitFor();
      await d.pause(500);
      d.mark();
      const groups = check.getByRole("radiogroup");
      const answer = async (answers: string[]) => {
        for (const [i, a] of answers.entries()) {
          await d.tap(groups.nth(i).getByRole("radio", { name: a, exact: true }), { glide: 16 });
          await d.pause(200);
        }
        await d.tap(check.getByRole("button", { name: "Check answers" }), { glide: 16 });
      };
      await answer(WRONG);
      d.beat("wrong");
      await d.pause(2600);
      d.beat("retry");
      await answer(RIGHT);
      await check
        .getByRole("status")
        .getByText(/All right/)
        .waitFor();
      d.beat("right");
      await d.pause(1200);
      await d.next();
      await d.page.getByRole("region", { name: "Honest take" }).waitFor();
      d.beat("honest");
      await d.pause(1200);
      await d.tap(d.button("Finish lesson"), { glide: 20 });
      await d.page.getByText("Lesson done").waitFor();
      d.beat("done");
      await d.pause(1400);
    },
  },
  {
    id: "claim",
    seed: () => (args.testnet ? testnetSeed() : { completions: STAGE0_DEMO }),
    async run(d) {
      await d.go(args.testnet ? "/?mode=testnet#stage-0-badge" : "/#stage-0-badge");
      const box = d.page.getByRole("region", { name: "Stage 0 badge" });
      const claim = box.getByRole("button", { name: "Claim the stage 0 badge" });
      await claim.waitFor({ timeout: 60_000 });
      await d.pause(600);
      d.mark();
      await d.hover(box.locator(".claim-title"), { glide: 24 });
      d.beat("ready");
      await d.pause(2200);
      await d.tap(claim, { glide: 24 });
      d.beat("claiming");
      await box.getByText("Stage 0 badge claimed").waitFor({ timeout: args.testnet ? 120_000 : 10_000 });
      d.beat("claimed");
      await d.pause(2200);
      const explorer = box.getByRole("link", { name: "See it on the testnet explorer" });
      if (await explorer.count()) {
        await d.hover(explorer, { glide: 20 });
        await d.pause(1000);
      }
      await d.tap(box.getByRole("link", { name: "My book" }), { glide: 20 });
      await d.page.getByRole("heading", { name: "Your badges" }).waitFor();
      d.beat("shelf");
      await d.pause(2000);
    },
  },
  {
    // The app's badge checker reading the badge contract on testnet, no login. (Explorers such as
    // nearblocks show a bot check to headless browsers.)
    id: "proof",
    seed: () => ({ storage: { "bon:chain-mode": "testnet" } }),
    async run(d) {
      const account =
        process.env.PROOF_ACCOUNT ?? testnetState()?.accountId ?? "bon-learner-mwe61s8i.testnet";
      await d.go("/check?mode=testnet");
      const input = d.page.getByLabel("Account");
      await input.waitFor();
      await d.pause(400);
      d.mark();
      await d.type(input, account, 25);
      await d.tap(d.page.getByRole("button", { name: "Check", exact: true }));
      await d.page
        .getByRole("list", { name: `Badges of ${account}` })
        .getByText(/^Claimed/)
        .first()
        .waitFor({ timeout: 30_000 });
      d.beat("found");
      await d.pause(2000);
    },
  },
];

// ---------------------------------------------------------------------------------------------------

async function newContext(browser: Browser, seed: Seed, videoDir?: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    ...(videoDir ? { recordVideo: { dir: videoDir, size: SIZE } } : {}),
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
  const ctx = await newContext(browser, shot.seed(), tmp);
  const page = await ctx.newPage();
  const d = new Director(page, Date.now());
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
  rmSync(join(CLIPS, `${shot.id}.failed.png`), { force: true });
  const marked = d.markedAt || d.startedAt;
  manifest[shot.id] = {
    file: `${shot.id}.webm`,
    trimStart: Math.max(0, (marked - d.startedAt) / 1000),
    duration: (end - marked) / 1000,
    beats: d.beats,
    ...(shot.id === "claim" || shot.id === "proof" ? { network: args.testnet ? "testnet" : "demo" } : {}),
  };
  console.log(`${((end - marked) / 1000).toFixed(1)} s ${JSON.stringify(d.beats)}`);
  return true;
}

/**
 * --prep-testnet: lesson 0.3 in testnet mode, for real: the app makes a practice account (Worker
 * faucet or NEAR's public helper), then Build, Got it, Sign, Send a real transfer. Saves the practice
 * key, the account and the transfer's evidence to .capture-profile/testnet.json (gitignored). Not filmed.
 */
async function prepTestnet(browser: Browser) {
  const ctx = await newContext(browser, { storage: { "bon:chain-mode": "testnet" } });
  const page = await ctx.newPage();
  const d = new Director(page, Date.now());
  const dock = page.locator(".action-slot");
  console.log("video: lesson 0.3 on testnet (a real transfer)…");
  await d.go(`${L03}?mode=testnet&view=2d`);
  await page.getByTestId("mode-pill").getByText("Testnet").waitFor({ timeout: 90_000 });
  await page.getByTestId("practice-balance").getByText(/NEAR$/).waitFor({ timeout: 60_000 });
  const accountId = (await page.getByTestId("account-id").textContent())!.trim();
  console.log(`  practice account ${accountId}`);
  const step = async () => {
    await d.button("Next step").click();
    await d.pause(400);
  };
  await step();
  await dock.getByRole("button", { name: "Build" }).click();
  await page.getByTestId("tx-nonce").getByText(/^\d+$/).waitFor({ timeout: 30_000 });
  await step();
  await dock.getByRole("button", { name: "Got it" }).click();
  await step();
  await dock.getByRole("button", { name: "Sign" }).click();
  const txHash = (await page.getByTestId("tx-hash").textContent())!.trim();
  await step();
  await dock.getByRole("button", { name: "Send" }).click();
  await page
    .getByTestId("pipeline")
    .locator('[data-phase="final"][data-lit="true"]')
    .waitFor({ timeout: 90_000 });
  await d.pause(1500);
  const saved = await page.evaluate(
    (k) => ({ practice: localStorage.getItem(k), v1: localStorage.getItem("bon:v1") }),
    PRACTICE_KEY,
  );
  await ctx.close();
  const pending = JSON.parse(saved.v1 ?? "{}").evidence?.["l-0-3-send-a-transaction"] ?? {
    txHash,
    mode: "testnet",
  };
  mkdirSync(dirname(TESTNET_STATE), { recursive: true });
  const state: TestnetState = { accountId, txHash, practice: saved.practice ?? "", evidence: pending };
  writeFileSync(TESTNET_STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  console.log(
    `  sent ${txHash}\nvideo: saved ${TESTNET_STATE}. Now: npm run capture -- --testnet --only claim,proof`,
  );
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
  manifest[id] = { file: `${id}.webm`, trimStart: 0, duration: (Date.now() - t0) / 1000, beats: {} };
  console.log(
    `video: saved public/clips/${id}.webm. Set its trimStart and beats in public/clips/manifest.json.`,
  );
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
    if (args["prep-testnet"]) await prepTestnet(browser);
    else if (args.manual) await manual(browser, args.manual, manifest);
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
