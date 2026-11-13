import { execFileSync } from "node:child_process";
import os from "node:os";
import { defineConfig, devices } from "@playwright/test";

/**
 * A port for `vite preview`. E2E_PORT wins (each worktree may pin its own, so parallel agents never test
 * each other's build; if it is taken, Playwright stops with "is already used"). Without it: 4173 if free,
 * else any free port. The probe binds "localhost", as vite preview does. The choice is written back to
 * the environment so the workers agree on it. Not used with BASE_URL (no server is started).
 * The port is freed again between the probe and vite's bind, so another process may grab it first: then
 * the run stops with "is already used"; run it again or pin E2E_PORT.
 */
function previewPort(): number {
  if (process.env.E2E_PORT) return Number(process.env.E2E_PORT);
  const probe = `const s=require("net").createServer();s.once("error",()=>s.listen(0,"localhost"));s.listen(4173,"localhost",()=>{process.stdout.write(String(s.address().port));s.close()})`;
  const port = Number(execFileSync(process.execPath, ["-e", probe]).toString());
  if (port !== 4173) console.log(`e2e: port 4173 is busy, using ${port}`);
  process.env.E2E_PORT = String(port);
  return port;
}

/**
 * WebGL for the 3D scenes. Headless Chromium draws WebGL in software (SwiftShader) unless told to use the
 * GPU. Scenes render on demand (#44), so an idle 3D page costs nothing, but every glide, pop-up and page
 * turn is drawn on the CPU in software (before #44 an idle page kept 2 to 7 cores busy, issue #36). On macOS, ANGLE's Metal
 * backend uses the real GPU: about 0.3 of a core and 60 fps for the same page. E2E_GL=swiftshader forces
 * software WebGL (what CI without a GPU gets) to reproduce a CI run on a Mac.
 */
const gpu = process.platform === "darwin" && process.env.E2E_GL !== "swiftshader";
// Software WebGL: about one worker per four cores, so the 3D pages get the CPU they need. With a GPU the
// default (half the cores) is fine. E2E_WORKERS overrides both.
// Playwright wants a number or a "50%" string, so a plain "2" from the environment becomes 2.
const envWorkers = process.env.E2E_WORKERS;
const workers =
  envWorkers === undefined
    ? gpu
      ? undefined
      : Math.max(1, Math.floor(os.availableParallelism() / 4))
    : /^\d+$/.test(envWorkers)
      ? Number(envWorkers)
      : envWorkers;

// E2E_NO_3D=1: WebGL is switched off, so lessons fall back to 2D, and the tests that need the 3D scene are
// left out. The blocking release CI e2e runs this way; the full suite in software WebGL runs in the
// non-blocking `e2e-3d-software` job until it has a few clean runs (#44). The full suite, 3D included,
// stays the local gate on a machine with a GPU.
const no3d = process.env.E2E_NO_3D === "1";

const port = process.env.BASE_URL ? undefined : previewPort();
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  ...(no3d ? { grepInvert: /\b3d\b|@3d/i, testIgnore: ["**/book-camera.spec.ts"] } : {}),
  fullyParallel: true,
  workers,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  // Lessons open straight onto their first page; e2e/book.spec.ts tests the closed-book cover itself.
  use: {
    baseURL,
    // Recording a trace screencasts every frame of the animated 3D canvas: real CPU for every test. Record
    // only on a retry (CI); locally, run `npx playwright test --trace on <spec>` to debug a failure.
    trace: "on-first-retry",
    storageState: {
      cookies: [],
      origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "bon:cover", value: "off" }] }],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The GPU where we can (macOS, Metal); otherwise software WebGL, which headless Chromium only
        // falls back to with this flag (machines without a GPU, CI).
        launchOptions: {
          args: no3d
            ? ["--disable-3d-apis"]
            : gpu
              ? ["--use-angle=metal", "--enable-unsafe-swiftshader"]
              : ["--enable-unsafe-swiftshader"],
        },
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${port} --strictPort`,
        // Test-only hooks (e.g. __bookOfNear.badges.replayLastClaim) are built in only with this flag.
        env: { VITE_E2E: "1" },
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
