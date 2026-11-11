import { expect, test, type Page } from "@playwright/test";
import { LOAD_3D, seedRoute, slow3d } from "./lessons/helpers";

/**
 * Render on demand (#44): once a 3D lesson's scene has settled, the canvas draws nothing until something
 * moves. Counts the animation-frame callbacks that issued WebGL draw calls.
 */
const LESSONS = [
  "l-0-1-blockchain-basics",
  "l-0-2-make-a-wallet",
  "l-0-3-send-a-transaction",
  "l-1-1-claim-your-name",
  "l-1-2-function-call-key",
  "l-1-3-inside-a-transaction",
  "l-2-1-follow-across-shards",
  "l-3-1-deploy-a-contract",
  "l-4-1-one-account-every-chain",
];

test.beforeEach(() => slow3d());

/** Before any script: counts rAF callbacks that drew with WebGL (window.__drawnFrames). */
function countDrawnFrames() {
  const w = window as unknown as { __drawnFrames: number };
  w.__drawnFrames = 0;
  let draws = 0;
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    const proto = C.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const orig = proto[name];
      if (!orig) continue;
      proto[name] = function (this: unknown, ...args: unknown[]) {
        draws++;
        return orig.apply(this, args);
      };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      const before = draws;
      cb(t);
      if (draws > before) w.__drawnFrames++;
    });
}

const drawn = (page: Page) => page.evaluate(() => (window as unknown as { __drawnFrames: number }).__drawnFrames);

for (const id of LESSONS) {
  test(`an idle 3d scene draws no frames: ${id}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedRoute(page);
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${id}?view=3d`);
    const stage = page.locator(".sk-stage").first();
    await expect(stage).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    await expect(stage).not.toHaveAttribute("data-pop", /./, { timeout: LOAD_3D });
    // Settled: wait until a whole second passes without a drawn frame (attention cues rest after a few
    // seconds), then check that the next two stay empty too.
    await expect
      .poll(
        async () => {
          const a = await drawn(page);
          await page.waitForTimeout(1000);
          return (await drawn(page)) - a;
        },
        { timeout: 15_000, intervals: [0] },
      )
      .toBe(0);
    const a = await drawn(page);
    await page.waitForTimeout(2000);
    expect((await drawn(page)) - a).toBe(0);
  });
}
