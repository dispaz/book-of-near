// Records the demo video's shots (issue #65). One clip per shot, 1920×1080, headless Chromium on the GPU (draws
// the 3D scenes; VIDEO_HEADED=1 for a window, off-screen), demo mode only. Run `npm run video` (record, then render), or this file alone:
//   node scripts/video/record.mjs            build, serve on :4246, record every shot
//   SHOTS=03,05 node scripts/video/record.mjs  only these shots (prefix match on the shot id)
//   VIDEO_BASE_URL=http://localhost:4246      use a server that is already running (no build)
// Output: video/clips/<shot>.webm and video/clips/shots.json (where each shot's action starts in its clip).
// Network guard: every request that is not to localhost is aborted and listed; the run fails if any was made.
/* global document, addEventListener -- installCursor runs in the page */
import { spawn, execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const ROOT = new URL("../../", import.meta.url).pathname;
const OUT = `${ROOT}video/clips`;
const PORT = 4246;
const W = 1920;
const H = 1080;
const narration = JSON.parse(readFileSync(new URL("./narration.json", import.meta.url), "utf8"));
const lengthOf = Object.fromEntries(narration.shots.map((s) => [s.id, s.length]));

// ---------- the app ----------

async function startServer() {
  if (process.env.VIDEO_BASE_URL) return { base: process.env.VIDEO_BASE_URL, stop() {} };
  console.log("video: building the app (demo mode, testnet-only default build)");
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) return { base, stop: () => server.kill() };
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  server.kill();
  throw new Error(`vite preview did not start on ${base}`);
}

// ---------- a visible cursor (Playwright's recording has none) ----------

function installCursor() {
  const add = () => {
    if (document.getElementById("__video-cursor")) return;
    const c = document.createElement("div");
    c.id = "__video-cursor";
    c.innerHTML =
      '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2l15 9-7 1.5L9 20z" fill="#1b1a17" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {
      position: "fixed",
      left: "-60px",
      top: "-60px",
      zIndex: "2147483647",
      pointerEvents: "none",
      transformOrigin: "4px 2px",
      transition: "transform 120ms ease-out",
      filter: "drop-shadow(1px 2px 2px rgba(20,20,20,.3))",
    });
    document.documentElement.appendChild(c);
    addEventListener(
      "mousemove",
      (e) => {
        c.style.left = `${e.clientX - 4}px`;
        c.style.top = `${e.clientY - 2}px`;
      },
      true,
    );
    addEventListener("mousedown", () => (c.style.transform = "scale(0.8)"), true);
    addEventListener("mouseup", () => (c.style.transform = ""), true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", add);
  else add();
}

// ---------- helpers for a shot ----------

const mouse = { x: W / 2, y: H / 2 };

/** Glides the cursor to the element, then clicks it. `after`: ms to wait once clicked. */
async function click(page, locator, after = 600) {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  if (!b) throw new Error(`no box for ${locator}`);
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y, { steps: 14 });
  Object.assign(mouse, { x, y });
  await page.waitForTimeout(180);
  await locator.click({ timeout: 10_000 });
  await page.waitForTimeout(after);
}

/** Moves the cursor somewhere out of the way (so it does not hide what changed). */
async function park(page, x = W - 120, y = H - 140) {
  await page.mouse.move(x, y, { steps: 10 });
  Object.assign(mouse, { x, y });
}

const nextButton = (page) => page.getByRole("button", { name: "Next step" });
const dock = (page) => page.locator(".action-slot");

/** Presses Next step and waits for the step number to go up. */
async function next(page, after = 700) {
  const dots = page.getByRole("navigation", { name: "Lesson steps" }).getByRole("list");
  const before = await dots.getAttribute("aria-label");
  await nextButton(page).waitFor({ state: "visible" });
  for (let i = 0; i < 100 && (await nextButton(page).isDisabled()); i++) await page.waitForTimeout(100);
  await click(page, nextButton(page), 0);
  for (let i = 0; i < 100 && (await dots.getAttribute("aria-label")) === before; i++)
    await page.waitForTimeout(50);
  await page.waitForTimeout(after);
}

async function waitAttr(locator, name, re, timeout = 20_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await locator.getAttribute(name).catch(() => null);
    if (v && re.test(v)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${name} ~ ${re}`);
}

/** Waits for the lesson's 3D canvas (lazy three.js and shaders), then lets the pop-up settle. */
async function waitFor3d(page, settle = 2500) {
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(settle);
}

const done = (lessonId, evidence) => ({
  lessonId,
  stage: Number(lessonId.split("-")[1]),
  route: "newcomer",
  mode: "demo",
  completedAt: "2026-11-12T10:00:00.000Z",
  ...(evidence ? { evidence } : {}),
});

// ---------- the shots ----------
// Each shot loads its page, waits until it is still, calls mark() where the cut starts, then acts.
// The render cuts `length` seconds (narration.json) from that mark.

const SHOTS = {
  async "01-title"(page, { base, mark }) {
    await page.goto(`${base}/`);
    await page.getByRole("heading", { name: "Book of NEAR", level: 1 }).waitFor();
    await page.waitForTimeout(1500);
    await park(page, 1300, 980);
    mark();
    await page.waitForTimeout(2600);
    // Glide down the contents: stages and lessons.
    await page.mouse.move(1430, 640, { steps: 20 });
    for (let i = 0; i < 18; i++) {
      await page.mouse.wheel(0, 70);
      await page.waitForTimeout(110);
    }
    await page.waitForTimeout(4000);
  },

  async "02-quiz"(page, { base, mark }) {
    await page.goto(`${base}/`);
    await page.getByRole("heading", { name: /Where should you start/ }).waitFor();
    await page.waitForTimeout(1200);
    mark();
    await page.waitForTimeout(900);
    await click(page, page.getByRole("radio", { name: "Never" }), 700);
    await click(page, page.getByRole("radio", { name: "No, not yet" }), 700);
    await click(page, page.getByRole("radio", { name: "I don't write code" }), 700);
    await click(page, page.getByRole("button", { name: "Show my path" }), 0);
    await page.getByRole("heading", { name: "Newcomer path" }).waitFor();
    await page.waitForTimeout(400);
    await park(page);
    await page.waitForTimeout(5000);
  },

  async "03-transaction"(page, { base, mark }) {
    await page.goto(`${base}/lesson/l-0-3-send-a-transaction?view=3d`);
    await waitFor3d(page, 3000);
    await park(page, 1500, 900);
    mark();
    await page.waitForTimeout(500);
    await next(page, 500); // → build
    await click(page, dock(page).getByRole("button", { name: "Build" }), 600);
    await next(page, 300); // → fee
    await click(page, dock(page).getByRole("button", { name: "Got it" }), 200);
    await next(page, 300); // → sign
    await click(page, dock(page).getByRole("button", { name: "Sign" }), 600);
    await next(page, 300); // → send
    await click(page, dock(page).getByRole("button", { name: "Send" }), 200);
    await park(page, 1500, 900);
    await waitAttr(page.getByTestId("pipeline").locator('[data-phase="final"]'), "data-lit", /true/, 30_000);
    await page.waitForTimeout(4000);
  },

  async "04-limited-key"(page, { base, mark }) {
    await page.goto(`${base}/lesson/l-1-2-function-call-key?view=3d&step=3`);
    await waitFor3d(page, 3000);
    const scene = page.locator("[data-scene-state]").first();
    mark();
    await page.waitForTimeout(400);
    await click(page, page.getByRole("button", { name: "Give the app a key" }), 0);
    await waitAttr(scene, "data-scene-state", /key:active/);
    await page.waitForTimeout(600);
    await next(page, 300);
    await click(page, page.getByRole("button", { name: "Count", exact: true }), 0);
    await waitAttr(scene, "data-scene-state", /counter:1/);
    await page.waitForTimeout(500);
    await next(page, 400);
    let n = 0;
    for (const name of [
      "Send NEAR to the attacker",
      "Call another contract",
      "Add a full-access key for the attacker",
    ]) {
      await click(page, page.getByRole("button", { name }).first(), 0);
      await waitAttr(scene, "data-scene-state", new RegExp(`refused:${++n}`));
      await page.waitForTimeout(700);
    }
    await park(page);
    await page.waitForTimeout(4000);
  },

  async "05-shards-3d"(page, { base, mark }) {
    await page.goto(`${base}/lesson/l-2-1-follow-across-shards?view=2d`);
    await page.getByTestId("shard-scene").waitFor();
    await click(page, dock(page).getByRole("button", { name: /^Recorded example/ }), 300);
    await click(page, dock(page).getByRole("button", { name: "Load transaction path" }), 600);
    await next(page, 1200); // → shards, chunks, blocks (2D)
    await park(page, 1500, 900);
    mark();
    await page.waitForTimeout(1500);
    await click(page, page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }), 0);
    await waitFor3d(page, 2600);
    await next(page, 1600); // → where it started
    await next(page, 1400); // → follow the receipts
    const total = Number(await page.getByTestId("hop-total").textContent());
    for (let i = 1; i < total; i++) {
      await click(page, dock(page).getByRole("button", { name: "Follow next receipt" }), 1250);
    }
    await park(page);
    await page.waitForTimeout(2500);
  },

  async "06-deploy"(page, { base, mark }) {
    await page.goto(`${base}/lesson/l-3-1-deploy-a-contract?view=3d&step=3`);
    await waitFor3d(page, 3000);
    const scene = page.getByTestId("deploy-scene");
    mark();
    await page.waitForTimeout(400);
    await click(page, page.getByRole("button", { name: "Deploy counter contract", exact: true }), 0);
    await waitAttr(scene, "data-scene-state", /deployed:yes/);
    await page.waitForTimeout(500);
    await next(page, 300);
    await click(page, page.getByRole("button", { name: "Increment", exact: true }), 0);
    await waitAttr(scene, "data-scene-state", /count:1;/);
    await page.waitForTimeout(600);
    await click(page, page.getByRole("button", { name: "Read the count", exact: true }), 0);
    await waitAttr(scene, "data-scene-state", /read:1;/);
    await page.waitForTimeout(500);
    await next(page, 400);
    await click(page, page.getByRole("button", { name: "Call fail with a callback", exact: true }), 0);
    await waitAttr(scene, "data-scene-state", /callback:failed/);
    await park(page);
    await page.waitForTimeout(3000);
  },

  async "07-chain-signatures"(page, { base, mark }) {
    await page.goto(`${base}/lesson/l-4-1-one-account-every-chain?view=3d&step=2`);
    await waitFor3d(page, 3000);
    mark();
    await page.waitForTimeout(500);
    await click(page, dock(page).getByRole("button", { name: "Derive Ethereum address" }), 1800);
    await next(page, 300);
    await click(page, dock(page).getByRole("button", { name: "Prepare payload" }), 1200);
    await next(page, 300);
    await click(page, dock(page).getByRole("button", { name: "Request signature (MPC)" }), 0);
    await park(page);
    for (let i = 0; i < 200; i++) {
      if (/Signed\./.test((await page.getByTestId("sign-status").textContent()) ?? "")) break;
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1500);
    await next(page, 400);
    await click(page, dock(page).getByRole("button", { name: "Verify signer" }), 0);
    await park(page);
    await page.waitForTimeout(5000);
  },

  async "08-intent-quote"(page, { base, mark }) {
    await page.goto(`${base}/lesson/l-4-2-intent-swap?view=3d&step=2`);
    await waitFor3d(page, 3000);
    mark();
    await page.waitForTimeout(400);
    await click(page, dock(page).getByRole("button", { name: "Fetch live intent quote" }), 0);
    await page.getByTestId("quote-source").waitFor();
    await page.waitForTimeout(1500);
    await next(page, 300);
    await click(page, dock(page).getByRole("button", { name: "Inspect quote breakdown" }), 0);
    await park(page);
    await page.waitForTimeout(5000);
  },

  async "09-badge"(page, { base, mark }) {
    await page.goto(`${base}/lesson/l-0-1-blockchain-basics?view=2d&step=9`);
    const honest = page.getByRole("region", { name: "Honest take" });
    await honest.waitFor();
    await page.waitForTimeout(1200);
    await park(page, 1500, 900);
    mark();
    await page.waitForTimeout(3200);
    await click(page, page.getByRole("button", { name: "Finish lesson" }), 900);
    await page.goto(`${base}/#stage-0`);
    const box = page.getByRole("region", { name: "Stage 0 badge" });
    await box.waitFor();
    await box.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await click(page, box.getByRole("button", { name: "Claim the stage 0 badge" }), 0);
    await box.getByText("Stage 0 badge claimed").waitFor();
    await page.waitForTimeout(1500);
    await click(page, box.getByRole("link", { name: "My book" }), 0);
    await page.getByRole("heading", { name: "Your badges" }).waitFor();
    await park(page);
    await page.waitForTimeout(4000);
  },
};

/** Saved progress for each shot (null: a first visit, so "/" opens the quiz). */
const SEED = {
  "02-quiz": null,
  "09-badge": {
    v: 1,
    route: "newcomer",
    completions: [
      done("l-0-2-make-a-wallet"),
      done("l-0-3-send-a-transaction", { txHash: "8kQ3demo", mode: "demo" }),
    ],
    evidence: {},
  },
};
const FRESH = { v: 1, route: "newcomer", completions: [], evidence: {} };

// ---------- run ----------

const only = (process.env.SHOTS ?? "").split(",").filter(Boolean);
const ids = Object.keys(SHOTS).filter((id) => !only.length || only.some((p) => id.startsWith(p)));
mkdirSync(OUT, { recursive: true });
const indexFile = `${OUT}/shots.json`;
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : {};

const server = await startServer();
// Headless by default, so the recording never takes window focus; new headless Chromium still draws WebGL on
// the GPU on macOS (Metal), as the e2e config does. VIDEO_HEADED=1 shows a window, parked off-screen.
const headed = process.env.VIDEO_HEADED === "1";
const browser = await chromium.launch({
  headless: !headed,
  args: [
    ...(process.platform === "darwin"
      ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
      : ["--enable-unsafe-swiftshader"]),
    ...(headed ? ["--window-position=-3000,0", `--window-size=${W},${H + 140}`] : []),
  ],
});
// One context for every shot (a headed run opens one window at most); each shot gets its own page, so its
// own video file and its own sessionStorage. Never bringToFront().
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
  recordVideo: { dir: `${OUT}/tmp`, size: { width: W, height: H } },
});
const blocked = [];
let current = "";
// Nothing leaves this machine: demo mode needs no network.
await ctx.route(
  (u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname),
  (route) => {
    blocked.push(`${current}: ${route.request().url()}`);
    return route.abort();
  },
);
await ctx.addInitScript(installCursor);
{
  // Which WebGL the 3D shots get: a GPU renderer, not SwiftShader (software drops frames).
  const probe = await ctx.newPage();
  const gl = await probe.evaluate(() => {
    const c = document.createElement("canvas").getContext("webgl2");
    const ext = c?.getExtension("WEBGL_debug_renderer_info");
    return c ? (ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)) : "none";
  });
  const video = probe.video();
  await probe.close();
  await video?.delete();
  console.log(`video: ${headed ? "headed (off-screen)" : "headless"} Chromium, WebGL: ${gl}`);
  if (/swiftshader|none/i.test(gl))
    console.warn("video: no GPU WebGL; 3D shots may stutter (try VIDEO_HEADED=1)");
}
try {
  for (const id of ids) {
    current = id;
    const seed = id in SEED ? SEED[id] : FRESH;
    const page = await ctx.newPage();
    // Runs once per page (sessionStorage is per page): wipe what earlier shots saved, then seed this one.
    await page.addInitScript(
      ({ s }) => {
        if (sessionStorage.getItem("__video-seeded")) return;
        sessionStorage.setItem("__video-seeded", "1");
        localStorage.clear();
        localStorage.setItem("bon:cover", "off");
        if (s) localStorage.setItem("bon:v1", JSON.stringify(s));
      },
      { s: seed },
    );
    const t0 = Date.now();
    let start = null;
    const mark = () => (start = (Date.now() - t0) / 1000);
    process.stdout.write(`video: recording ${id} ... `);
    await SHOTS[id](page, { base: server.base, mark });
    const end = (Date.now() - t0) / 1000;
    const video = page.video();
    await page.close();
    const file = `${OUT}/${id}.webm`;
    rmSync(file, { force: true });
    await video.saveAs(file);
    await video.delete();
    const action = end - start;
    index[id] = { file: `${id}.webm`, start: Number(start.toFixed(2)), action: Number(action.toFixed(2)) };
    writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n");
    const want = lengthOf[id];
    console.log(
      `${action.toFixed(1)} s of action (cut: ${want} s)${action <= want + 0.05 ? "" : "  (render speeds it up to fit)"}`,
    );
  }
} finally {
  await ctx.close();
  await browser.close();
  server.stop();
  rmSync(`${OUT}/tmp`, { recursive: true, force: true });
}
if (blocked.length) {
  console.error(`video: requests left localhost (blocked):\n  ${blocked.join("\n  ")}`);
  process.exit(1);
}
console.log(`video: ${ids.length} clips in ${OUT}`);
