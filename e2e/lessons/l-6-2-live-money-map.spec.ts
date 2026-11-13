import { expect, test, type Page } from "@playwright/test";
import {
  answerCheck,
  completionOf,
  countDrawnFrames,
  expectFocusMarksHover,
  expectNotYetHint,
  expectPickDetail,
  expectPickPlaysAndSettles,
  expectSettled,
  LOAD_3D,
  nextStep,
  seedRoute,
  slow3d,
  slow3dUnless2d,
} from "./helpers";

// Walks lesson 6.2 in demo mode (no wallet, no network). Every figure is recorded data (13 Nov 2026),
// labelled so on the page, and the trade is worked out from recorded pool quotes: nothing is sent.
const ID = "l-6-2-live-money-map";
const TITLE = "The live money map";
const RECORDED = "Recorded on 13 Nov 2026. Not live data.";
const ANSWERS = [
  "Circle issues it on NEAR itself, so no bridge stands between you and Circle.",
  "Refuse it as too old, and wait for a fresh signed update.",
  "A stable pool's curve keeps same-value tokens near 1:1; a simple pool's price moves as a big trade drains one side.",
];

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("money-scene");
const dock = (page: Page) => page.locator(".action-slot");

async function go(page: Page, caption: string | RegExp) {
  await nextStep(page);
  await expect(page.getByTestId("caption")).toContainText(caption);
}

/** From the money map to "Lesson done", trading up to 100,000 USDC. */
async function walk(page: Page) {
  await expect(page.getByTestId("caption")).toContainText("What turns a blockchain into an economy?");
  await expect(page.getByTestId("recorded-label")).toHaveText(RECORDED);
  await expect(page.getByTestId("tvl")).toContainText("about $162 million");

  await go(page, "Two tokens are called USDC");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Compare the two USDCs" }).click();
  await expect(page.getByTestId("supplies")).toContainText("79.3 million");
  await expect(page.getByTestId("supplies")).toContainText("14.6 million");

  await go(page, "A contract cannot open a website");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Read the oracle" }).click();
  await expect(page.getByTestId("oracle")).toContainText("$1.8843");
  await expect(page.getByTestId("oracle")).toContainText("25 Aug 2026");
  await expect(page.getByTestId("oracle")).toContainText("too old");
  await expect(page.getByTestId("recorded-label")).toHaveText(RECORDED);

  await go(page, "Trade USDC in two Rhea pools");
  await dock(page).getByRole("button", { name: "Trade 100 USDC" }).click();
  await expect(page.getByTestId("trade")).toContainText("100.09 USDt");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Trade 100,000 USDC" }).click();
  await expect(page.getByTestId("trade")).toContainText("100,000 USDC → 100,010.05 USDt");
  await expect(page.getByTestId("trade")).toContainText("25,762.09 NEAR at $3.8817, 10.9% over");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /trade:100000/);

  await go(page, "NEAR Intents settle on NEAR");
  await expect(page.getByTestId("intents")).toContainText("$176 million");
  await dock(page).getByRole("button", { name: "Show the flows" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /flows:yes/);

  await go(page, "Three questions");
  await answerCheck(page, ANSWERS);
  await nextStep(page);
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest).toContainText("Oracles can go quiet");
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

const RECORD = {
  stage: 6,
  mode: "demo",
  evidence: {
    pair: "USDC/USDt",
    amountIn: "100000",
    stableOut: "100010.046253",
    simpleOutNear: "25762.090317",
    recordedOn: "2026-11-13",
    kind: "recorded",
  },
};

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test.beforeEach(() => slow3d(view === "3d"));

    test("is in the contents and walks to Finish in demo mode on recorded data", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript((v) => localStorage.setItem("bon:view", v), view);
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
      await walk(page);
      expect(await completionOf(page, ID)).toMatchObject(RECORD);
      expect(errors).toEqual([]);
    });

    test("walks with reduced motion", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
      await walk(page);
      await context.close();
    });
  });

test.describe(`lesson ${ID}`, () => {
  test("objects do the step's action, say 'not yet' too early, and show a detail after (2d)", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    const note = page.getByTestId("picked-note");
    await page.getByRole("button", { name: "The oracle booth" }).press("Enter");
    await expect(note).toHaveAttribute("data-not-yet", "yes");
    await expect(note).toContainText("Not yet: you read the oracle on step 3.");
    await page.getByRole("button", { name: "The stable pool" }).press("Enter");
    await expect(note).toContainText("Read the oracle first.");
    await page.getByRole("button", { name: "The Rhea Lend ledger" }).press("Enter");
    await expect(note).toContainText("Rhea Lend (was Burrow)");
    await go(page, "Two tokens are called USDC");
    await page.getByRole("button", { name: "The USDC mailbox" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /compared:yes/);
    await go(page, "A contract cannot open a website");
    await page.getByRole("button", { name: "The oracle booth" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /oracle:read/);
    await go(page, "Trade USDC in two Rhea pools");
    for (const size of ["100", "10000", "100000"]) {
      await page.getByRole("button", { name: "The simple pool" }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", new RegExp(`trade:${size};`));
    }
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
    await go(page, "NEAR Intents settle on NEAR");
    await page.getByRole("button", { name: "The NEAR Intents area" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /flows:yes/);
    await expect(page.getByTestId("flows")).toBeVisible();
    await page.getByRole("button", { name: "The NEAR Intents area" }).press("Enter");
    await expect(note).toContainText("$176 million");
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: /money map on the page/ })).toBeVisible();
    await expect(page.getByTestId("recorded-label")).toHaveText(RECORDED);
  });

  test("phones fit the 2d page with no sideways scroll", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=2d&step=4`);
    await page.locator(".action-slot").getByRole("button", { name: "Trade 100,000 USDC" }).click();
    await expect(page.getByTestId("trade")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await ctx.close();
  });

  test("2D to 3D keeps the trade", { tag: "@3d" }, async ({ page }) => {
    slow3d();
    await page.goto(`/lesson/${ID}?view=2d&step=4`);
    await dock(page).getByRole("button", { name: "Trade 100,000 USDC" }).click();
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await expect(scene(page)).toHaveAttribute("data-scene-state", /trade:100000/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });
});

test.describe("3D book scene", () => {
  test.beforeEach(() => slow3d());

  test("wide screens print the step on the left page; phones keep it docked", async ({ browser }) => {
    const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let page = await wide.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
    await expect(page.getByTestId("tour-caption")).toHaveText(/^Fig\. 3/);
    await wide.close();

    const phone = await browser.newContext({ viewport: { width: 390, height: 760 } });
    page = await phone.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("recorded-label")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await phone.close();
  });

  test("an idle 3d scene draws no frames, and the flows settle after they grow in", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${ID}?view=3d&step=5`);
    const stage = page.locator(".book-scene .sk-stage");
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    await expectSettled(page);
    await dock(page).getByRole("button", { name: "Show the flows" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /flows:yes/);
    await expectSettled(page);
  });

  // Rule 10a, one block per row of the script's Reactions table.
  test("3d objects react: focus marks hover, an early pick says not yet, a pick after the step shows its detail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${ID}?view=3d&step=2`);
    const stage = page.locator(".book-scene .sk-stage");
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });

    // Each pick's animation is checked before any hint or detail slip (a slip fading out draws frames).
    await expectFocusMarksHover(page, "The USDC mailbox");
    await expectPickPlaysAndSettles(page, "The USDC mailbox");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /compared:yes/);
    await expectFocusMarksHover(page, "The Rhea Lend ledger");
    await expectPickPlaysAndSettles(page, "The Rhea Lend ledger");
    await expectPickDetail(page, "The Rhea Lend ledger", /Rhea Lend \(was Burrow\)/);
    await expectPickDetail(page, "The USDC mailbox", /79\.3 million.*14\.6 million/);
    await expectNotYetHint(page, "The oracle booth", "Not yet: you read the oracle on step 3.");
    await expectNotYetHint(page, "The stable pool", "Read the oracle first.");
    await expectNotYetHint(page, "The NEAR Intents area", "Trade in the pools first.");

    await nextStep(page);
    await expectFocusMarksHover(page, "The oracle booth");
    // Earlier slips are still fading out (they draw frames), so this pick is checked by its result.
    await page.getByRole("button", { name: "The oracle booth" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /oracle:read/);
    await expectPickDetail(page, "The oracle booth", /\$1\.8843.*too old/);
    await expectNotYetHint(page, "The simple pool", "Not yet: you trade on step 4.");
  });

  test("3d pools trade on step 4 and the intents area shows the flows on step 5", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${ID}?view=3d&step=4`);
    const stage = page.locator(".book-scene .sk-stage");
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    await expectFocusMarksHover(page, "The stable pool");
    await expectPickPlaysAndSettles(page, "The stable pool");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /trade:100;/);
    await expectPickPlaysAndSettles(page, "The simple pool");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /trade:10000;/);
    await page.getByRole("button", { name: "The simple pool" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /trade:100000;/);
    await expectNotYetHint(page, "The NEAR Intents area", "Not yet: you follow the flows on step 5.");

    await nextStep(page);
    await expectFocusMarksHover(page, "The NEAR Intents area");
    await page.getByRole("button", { name: "The NEAR Intents area" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /flows:yes/);
    await expectPickDetail(page, "The NEAR Intents area", /\$176 million/);
    await expectPickDetail(page, "The simple pool", /100,000 USDC → 25,762\.09 NEAR/);
  });
});
