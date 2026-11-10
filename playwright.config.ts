import { execFileSync } from "node:child_process";
import os from "node:os";
import { defineConfig, devices } from "@playwright/test";

/**
 * A port for `vite preview`. E2E_PORT wins (each worktree may pin its own, so parallel agents never test
 * each other's build; if it is taken, Playwright stops with "is already used"). Without it: 4173 if free,
 * else any free port. The choice is written back to the environment so the workers agree on it.
 */
function previewPort(): number {
  if (process.env.E2E_PORT) return Number(process.env.E2E_PORT);
  const probe = `const s=require("net").createServer();s.once("error",()=>s.listen(0));s.listen(4173,()=>{process.stdout.write(String(s.address().port));s.close()})`;
  const port = Number(execFileSync(process.execPath, ["-e", probe]).toString());
  if (port !== 4173) console.log(`e2e: port 4173 is busy, using ${port}`);
  process.env.E2E_PORT = String(port);
  return port;
}

/**
 * WebGL for the 3D scenes. Headless Chromium draws WebGL in software (SwiftShader) unless told to use the
 * GPU. In software, an idle 3D lesson page keeps 2 to 6 CPU cores busy (the scene redraws every frame), so
 * a few parallel 3D tests starve the machine and their waits time out (issue #36). On macOS, ANGLE's Metal
 * backend uses the real GPU: about 0.3 of a core and 60 fps for the same page. E2E_GL=swiftshader forces
 * software WebGL (what CI without a GPU gets) to reproduce a CI run on a Mac.
 */
const gpu = process.platform === "darwin" && process.env.E2E_GL !== "swiftshader";
// Software WebGL: about one worker per four cores, so the 3D pages get the CPU they need. With a GPU the
// default (half the cores) is fine. E2E_WORKERS overrides both.
const workers =
  process.env.E2E_WORKERS ?? (gpu ? undefined : Math.max(1, Math.floor(os.availableParallelism() / 4)));

const port = previewPort();
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
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
          args: gpu ? ["--use-angle=metal", "--enable-unsafe-swiftshader"] : ["--enable-unsafe-swiftshader"],
        },
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
