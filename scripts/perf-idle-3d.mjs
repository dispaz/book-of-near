#!/usr/bin/env node
/**
 * Idle cost of the 3D lesson scenes (issue #44): opens each lesson's 3D view in headless Chromium, waits
 * for the scene to settle, then for a few seconds counts the frames the page draws and the CPU the
 * browser uses.
 *
 *   npm run build && npx vite preview --port 4189 --strictPort &
 *   node scripts/perf-idle-3d.mjs                        # software WebGL (SwiftShader), like CI
 *   E2E_GL=gpu node scripts/perf-idle-3d.mjs             # macOS: the GPU (ANGLE Metal)
 *   BASE_URL=http://localhost:4189 MEASURE_S=5 node scripts/perf-idle-3d.mjs l-0-1-blockchain-basics
 *
 * Columns: rAF/s = requestAnimationFrame callbacks a second; frames/s = callbacks that drew with WebGL;
 * ms/frame = wall time per drawn frame (empty when none); JS ms = the mean main-thread time of a drawing
 * callback; CPU cores = CPU time of every browser process (the GPU process runs SwiftShader) over wall
 * time.
 */
/* global window */
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:4189";
const SECONDS = Number(process.env.MEASURE_S ?? 5);
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 3000);
const software = process.env.E2E_GL !== "gpu";
const lessons = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "l-0-1-blockchain-basics",
      "l-2-1-follow-across-shards",
      "l-3-1-deploy-a-contract",
      "l-4-1-one-account-every-chain",
    ];

/** Seconds of CPU used so far by the process `root` and all its descendants (ps, macOS and Linux). */
function cpuSeconds(root) {
  const rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,time="])
    .toString()
    .trim()
    .split("\n")
    .map((l) => l.trim().split(/\s+/));
  const kids = new Map();
  const time = new Map();
  for (const [pid, ppid, t] of rows) {
    if (!kids.has(ppid)) kids.set(ppid, []);
    kids.get(ppid).push(pid);
    // [[dd-]hh:]mm:ss[.ss]
    const [d, rest] = t.includes("-") ? t.split("-") : ["0", t];
    const secs = rest.split(":").reduce((a, p) => a * 60 + Number(p), 0) + Number(d) * 86400;
    time.set(pid, secs);
  }
  let sum = 0;
  const todo = [String(root)];
  while (todo.length) {
    const p = todo.pop();
    sum += time.get(p) ?? 0;
    todo.push(...(kids.get(p) ?? []));
  }
  return sum;
}

/** In the page, before any script: count rAF callbacks, WebGL draws and the time of drawing callbacks. */
function instrument() {
  const s = { raf: 0, frames: 0, ms: 0, draws: 0 };
  window.__perf = s;
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const orig = C.prototype[name];
      if (!orig) continue;
      C.prototype[name] = function (...args) {
        s.draws++;
        return orig.apply(this, args);
      };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      s.raf++;
      const before = s.draws;
      const t0 = performance.now();
      cb(t);
      if (s.draws > before) {
        s.frames++;
        s.ms += performance.now() - t0;
      }
    });
}

const server = await chromium.launchServer({
  args: software ? ["--enable-unsafe-swiftshader"] : ["--use-angle=metal", "--enable-unsafe-swiftshader"],
});
const pid = server.process().pid;
const browser = await chromium.connect(server.wsEndpoint());
console.log(`${software ? "SwiftShader" : "GPU"}, 1440x900, settle ${SETTLE_MS} ms, measure ${SECONDS} s`);
console.log("lesson                          rAF/s  frames/s  ms/frame  JS ms  CPU cores");
for (const id of lessons) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(BASE).origin,
          localStorage: [
            { name: "bon:cover", value: "off" },
            {
              name: "bon:v1",
              value: JSON.stringify({ v: 1, route: "newcomer", completions: [], evidence: {} }),
            },
          ],
        },
      ],
    },
  });
  const page = await context.newPage();
  await page.addInitScript(instrument);
  await page.goto(`${BASE}/lesson/${id}?view=3d`);
  await page.locator('.sk-stage[data-view="3d"] canvas').first().waitFor({ timeout: 60_000 });
  await page
    .locator('.sk-stage[data-camera="still"]')
    .first()
    .waitFor({ timeout: 60_000 })
    .catch(() => console.log(`  ${id}: camera never still`));
  await page.waitForTimeout(SETTLE_MS);
  const a = await page.evaluate(() => ({ ...window.__perf }));
  const cpu0 = cpuSeconds(pid);
  const t0 = Date.now();
  await page.waitForTimeout(SECONDS * 1000);
  const cpu1 = cpuSeconds(pid);
  const wall = (Date.now() - t0) / 1000;
  const b = await page.evaluate(() => ({ ...window.__perf }));
  const frames = b.frames - a.frames;
  const row = [
    id.padEnd(30),
    ((b.raf - a.raf) / wall).toFixed(1).padStart(6),
    (frames / wall).toFixed(1).padStart(9),
    (frames ? ((wall * 1000) / frames).toFixed(0) : "-").padStart(9),
    (frames ? (b.ms - a.ms) / frames : 0).toFixed(1).padStart(6),
    ((cpu1 - cpu0) / wall).toFixed(2).padStart(10),
  ];
  console.log(row.join(" "));
  await context.close();
}
await browser.close();
await server.close();
