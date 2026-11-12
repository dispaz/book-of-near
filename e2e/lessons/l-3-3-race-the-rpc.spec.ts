import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, LOAD_3D, nextStep, seedRoute, slow3d } from "./helpers";

// Walks lesson 3.3 in demo mode (no wallet, no network), in both views. Demo mode answers after the
// round trips recorded on 12 Nov 2026 (src/chain/rpcEndpoints.ts): FastNEAR 77 ms, NEAR Foundation
// 3,079 ms, FastNEAR's 2nd address 81 ms.
const ID = "l-3-3-race-the-rpc";
const TITLE = "Race the RPC nodes";
const STAGE = 3;
const T = { timeout: 15_000 };

// The race and the failover each wait about 3 s in demo mode (NEAR Foundation's recorded round trip).
test.describe.configure({ timeout: 90_000 });
test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.getByTestId("rpc-scene");
const state = (page: Page, re: RegExp) => expect(scene(page)).toHaveAttribute("data-scene-state", re, T);
const next = (page: Page) => page.getByRole("button", { name: "Next step" });

async function raceNodes(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Race the nodes", exact: true }).click();
  await state(page, /race:done;fastest:fastnear/);
  await expect(next(page)).toBeEnabled();
}

async function disableFastnear(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Disable FastNEAR", exact: true }).click();
  await state(page, /blocked:fastnear/);
  await expect(next(page)).toBeEnabled();
}

async function sendFailover(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Send query via failover", exact: true }).click();
  await state(page, /failover:near-org/);
  await expect(next(page)).toBeEnabled();
}

async function queryHistory(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Query historical block", exact: true }).click();
  await state(page, /archive:done/);
  await expect(next(page)).toBeEnabled();
}

/** Steps 1 to 5 in the page's current view. */
async function walkToCheck(page: Page) {
  await nextStep(page); // hook → race
  await raceNodes(page);
  await nextStep(page); // → outage
  await disableFastnear(page);
  await nextStep(page); // → failover
  await sendFailover(page);
  await nextStep(page); // → archive
  await queryHistory(page);
  await nextStep(page); // → check
}

const ANSWERS = [
  "If that one provider has an outage, the whole dApp goes dark for its users.",
  "A regular node keeps only the last 5 epochs of history; an archival node keeps every block since the first one.",
  "It tries the request again on the next provider in its fallback list.",
];

test.describe(`lesson ${ID}`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`is in the contents and walks to Finish in demo mode (${view})`, async ({ page }) => {
      slow3d(view === "3d");
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await page.goto(`/lesson/${ID}?view=${view}`);
      await walkToCheck(page);
      await answerCheck(page, ANSWERS);
      await nextStep(page); // → honest take
      await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
      await page.getByRole("button", { name: "Finish lesson" }).click();
      await expect(page.getByText("Lesson done")).toBeVisible();
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: {
          fastestRpc: "FastNEAR",
          latencyMs: "77",
          failoverRpc: "NEAR Foundation",
          failoverMs: "3079",
          source: "recorded",
        },
      });
    });
  }

  test("demo mode shows the recorded latencies, one bar per provider", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await raceNodes(page);
    await expect(page.getByTestId("rpc-row-fastnear")).toContainText("77 ms");
    await expect(page.getByTestId("rpc-row-fastnear")).toContainText("first");
    await expect(page.getByTestId("rpc-row-near-org")).toContainText("3,079 ms");
    await expect(page.getByTestId("rpc-row-fastnear-2")).toContainText("81 ms");
    for (const id of ["fastnear", "near-org", "fastnear-2"])
      await expect(page.getByTestId(`bar-${id}`)).toBeVisible();
    // The tallest bar is the slowest provider.
    const h = async (id: string) =>
      Number(await page.getByTestId(`bar-${id}`).locator("rect").getAttribute("height"));
    expect(await h("near-org")).toBeGreaterThan(await h("fastnear"));
    await expect(page.getByTestId("rpc-source")).toContainText("recorded once, on 12 Nov 2026");
    // The learner's own numbers reach the next step's words.
    await nextStep(page);
    await expect(page.getByTestId("caption")).toContainText("FastNEAR answered first, in 77 ms");
  });

  test("blocking FastNEAR triggers a visible failover to the next provider", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=3`);
    await state(page, /race:done/);
    await disableFastnear(page);
    await expect(page.getByTestId("rpc-row-fastnear")).toContainText("offline (simulated)");
    await expect(page.locator('[data-window="down"]')).toHaveCount(1);
    await nextStep(page);
    await sendFailover(page);
    const tries = page.getByTestId("failover-attempts").locator("li");
    await expect(tries.nth(0)).toContainText("FastNEAR");
    await expect(tries.nth(0)).toContainText("503 Service Unavailable (simulated outage)");
    await expect(tries.nth(0)).toHaveClass(/failed/);
    await expect(tries.nth(1)).toContainText("NEAR Foundation");
    await expect(tries.nth(1)).toHaveClass(/ok/);
    await expect(page.getByTestId("failover-total")).toContainText("Your app stayed online");
    await expect(page.locator('[data-window="lit"]')).toHaveCount(1);
  });

  test("an old block: the regular node does not have it, the archival node does", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await queryHistory(page);
    const res = page.getByTestId("history-result");
    await expect(res).toContainText("not found (UNKNOWN_BLOCK)");
    await expect(res).toContainText("block #100,000,000, made 2022-09-12");
    await expect(page.locator('[data-window="shut"]')).toHaveCount(1);
  });

  test("objects answer picks: a hint before the race, the action at its step, a detail after", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await page.getByRole("button", { name: "Counter window: FastNEAR RPC node" }).press("Enter");
    await expect(page.getByTestId("pick-hint")).toContainText("Not yet: race the nodes");
    await nextStep(page);
    // Picking a window at the race step starts the race.
    await page.getByRole("button", { name: "Counter window: NEAR Foundation RPC node" }).press("Enter");
    await state(page, /race:done/);
    await page.getByRole("button", { name: "Counter window: NEAR Foundation RPC node" }).press("Enter");
    await expect(page.getByTestId("pick-hint")).toContainText("3,079 ms round trip");
    await page.getByRole("button", { name: /^Mailbox: your app/ }).press("Enter");
    await expect(page.getByTestId("pick-hint")).toContainText(
      "fallback list, in order: rpc.testnet.fastnear.com",
    );
    // At the outage step, picking FastNEAR's window switches it off.
    await nextStep(page);
    await page.getByRole("button", { name: "Counter window: FastNEAR RPC node" }).press("Enter");
    await state(page, /blocked:fastnear/);
  });

  test("the honest take names strengths and weaknesses against Ethereum", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await walkToCheck(page);
    await answerCheck(page, ANSWERS);
    await nextStep(page);
    const honest = page.getByRole("region", { name: "Honest take" });
    await expect(honest).toContainText("Ethereum");
    await expect(honest).toContainText(/fallbackRpcUrls/);
    await expect(honest).toContainText(/Lava/);
  });
});

test.describe(`lesson ${ID}: motion, fallback, switching, phones`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`works with reduced motion in the ${view} view`, async ({ browser }) => {
      slow3d(view === "3d");
      const ctx = await browser.newContext({ reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await walkToCheck(page);
      await ctx.close();
    });

    test(`works on a phone-sized screen in the ${view} view`, async ({ browser }) => {
      slow3d(view === "3d");
      const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      if (view === "3d") await expect(page.locator("canvas").first()).toBeVisible({ timeout: LOAD_3D });
      await walkToCheck(page);
      await ctx.close();
    });
  }

  test("without WebGL the lesson runs in 2D with no switch, and three.js is never loaded", async ({
    page,
  }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
    });
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
    await walkToCheck(page);
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
  });

  test("switching 2D to 3D and back in the middle keeps the progress", { tag: "@3d" }, async ({ page }) => {
    slow3d();
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await raceNodes(page);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await state(page, /race:done;fastest:fastnear/);
    await nextStep(page);
    await page.getByRole("button", { name: "Counter window: FastNEAR RPC node" }).press("Enter");
    await state(page, /blocked:fastnear/);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "2D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await state(page, /race:done;fastest:fastnear;blocked:fastnear/);
    await expect(next(page)).toBeEnabled();
  });
});

test.describe(`lesson ${ID}: 3D book scene`, () => {
  test.beforeEach(() => slow3d());

  test("wide screens print the step on the left page; the tour moves the camera and docks the words", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=2`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
    await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 2/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 2/);
    // While the tour runs, the words go back to their docked place: still readable.
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    // A new step ends the tour and prints the words again; the printed action still works.
    await page.getByRole("button", { name: "Race the nodes", exact: true }).click();
    await state(page, /race:done/);
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 3/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
    await page.getByRole("button", { name: "Disable FastNEAR", exact: true }).click();
    await state(page, /blocked:fastnear/);
    await ctx.close();
  });

  test("phones keep the step's words docked, not printed on the page", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=2`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.locator(".book-page")).toHaveCSS("display", "contents");
    await ctx.close();
  });

  test("in 3D, picking the archival window asks for the old block", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=3d&step=5`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await page.getByRole("button", { name: "Counter window: Archival node RPC node" }).press("Enter");
    await state(page, /archive:done/);
    await page.getByRole("button", { name: "Counter window: Archival node RPC node" }).press("Enter");
    await expect(page.getByTestId("pick-hint")).toContainText("block #100,000,000 found");
  });
});
