import { expect, test, type Page } from "@playwright/test";
import {
  answerCheck,
  completionOf,
  countDrawnFrames,
  drawnFrames,
  expectFocusMarksHover,
  expectNotYetHint,
  expectPickDetail,
  expectPickPlaysAndSettles,
  expectSettled,
  LOAD_3D,
  nextStep,
  pickButton,
  seedRoute,
  slow3d,
  slow3dUnless2d,
} from "./helpers";

// Walks the honest scoreboard in demo mode (no wallet, no network). The board is recorded data from
// the topic's sources, labelled with the day it was recorded; nothing on it is live.
const ID = "l-7-2-honest-scoreboard";
const TITLE = "The honest scoreboard";
const ANSWERS = [
  "Calls between contracts are asynchronous: they take several blocks and do not roll back as one.",
  "Money locked in DeFi (TVL), institutional capital and developer attention.",
  "Every validator runs one large shared state, with no shards to split the work.",
];

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("hsb-scene");
const dock = (page: Page) => page.locator(".action-slot");
const board = (page: Page) => page.getByTestId("board");
const row = (page: Page, chain: string) => board(page).locator(`tr[data-chain="${chain}"]`);

async function go(page: Page, caption: string | RegExp) {
  await nextStep(page);
  await expect(page.getByTestId("caption")).toContainText(caption);
}

/** Opens the step's card from the dock and checks the board it fills in. */
async function openCard(page: Page, title: string, dim: string) {
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await expect(page.getByTestId("board-status")).toContainText(`Open the ${title} card`);
  await dock(page)
    .getByRole("button", { name: `Open the ${title} card` })
    .click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", new RegExp(`dim:${dim};`));
  await expect(board(page)).toHaveAttribute("data-dim", dim);
  await expect(page.getByTestId("recorded-label")).toContainText("Recorded on 13 Nov 2026");
  await expect(page.getByTestId("recorded-label")).toContainText("Not live data");
}

/** From the first page to "Lesson done". */
async function walk(page: Page) {
  await expect(page.getByTestId("designs")).toContainText("Trade-off");
  await expect(scene(page)).toHaveAttribute("data-scene-state", "dim:none;explored:");

  await go(page, "Dimension 1: accounts");
  await openCard(page, "Accounts", "accounts");
  await expect(row(page, "near")).toHaveAttribute("data-verdict", "leads");

  await go(page, "Dimension 2: scalability");
  await openCard(page, "Scalability", "scaling");
  await expect(row(page, "ethereum")).toContainText("danksharding");

  await go(page, "Dimension 3: speed");
  await openCard(page, "Speed", "execution");
  await expect(row(page, "solana")).toHaveAttribute("data-verdict", "leads");
  await expect(row(page, "solana")).toContainText("(unverified)");
  await expect(row(page, "near")).toHaveAttribute("data-verdict", "trade-off");

  await go(page, "Dimension 4: liquidity");
  await openCard(page, "Liquidity", "liquidity");
  await expect(row(page, "ethereum")).toHaveAttribute("data-verdict", "leads");
  await expect(row(page, "ethereum")).toContainText("$39.4 billion");
  await expect(row(page, "near")).toHaveAttribute("data-verdict", "trails");
  await expect(row(page, "cosmos")).toHaveAttribute("data-verdict", "not compared");

  await go(page, "Three questions");
  await answerCheck(page, ANSWERS);
  await nextStep(page);
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest).toContainText("Compared with Ethereum, Solana, and Cosmos");
  await expect(honest).toContainText("on 13 Nov 2026 DefiLlama counted");
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

const RECORD = {
  stage: 7,
  mode: "demo",
  evidence: { scoreboardReviewed: "true", favoriteTradeoff: "chain-abstraction", recordedOn: "13 Nov 2026" },
};

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test.beforeEach(() => slow3d(view === "3d"));

    test("walks to Finish in demo mode and emits the completion record", async ({ page }) => {
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

    test("cards open the step's dimension, say 'not yet' too early, and pillars show their note", async ({
      page,
    }) => {
      await page.goto(`/lesson/${ID}?view=${view}&step=3`);
      await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
      const note = page.getByTestId("picked-note");
      // Opened at step 3: the card before it counts as explored.
      await expect(scene(page)).toHaveAttribute("data-scene-state", "dim:none;explored:accounts");
      // Too early: 2D notes it under the board; 3D shakes the object and shows the hint in a slip.
      const early = async (name: string, hint: string) => {
        const button = page.getByRole("button", { name, exact: true });
        await button.press("Enter");
        if (view === "3d") await expect(button).toHaveAttribute("data-hint", hint);
        else {
          await expect(note).toHaveAttribute("data-not-yet", "yes");
          await expect(note).toContainText(hint);
        }
      };
      await early("The Liquidity card", "Not yet: this card opens at step 5.");
      await early("The NEAR pillar", "Open the Scalability card first.");
      await expect(scene(page)).toHaveAttribute("data-scene-state", "dim:none;explored:accounts");
      await page.getByRole("button", { name: "The Scalability card", exact: true }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", "dim:scaling;explored:accounts,scaling");
      await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
      await page.getByRole("button", { name: "The NEAR pillar", exact: true }).press("Enter");
      await expect(note).not.toHaveAttribute("data-not-yet", "yes");
      await expect(note).toContainText("NEAR, scalability: Sharded");
      // An explored card opens again, to compare.
      await page.getByRole("button", { name: "The Accounts card", exact: true }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /^dim:accounts;/);
      await expect(note).toContainText("Accounts: NEAR leads.");
    });
  });

test.describe(`lesson ${ID}`, () => {
  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await go(page, "Dimension 1");
    await openCard(page, "Accounts", "accounts");
  });

  test("2D to 3D keeps the open cards", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=2`);
    await dock(page).getByRole("button", { name: "Open the Accounts card" }).click();
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await expect(scene(page)).toHaveAttribute("data-scene-state", "dim:accounts;explored:accounts");
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });

  test("on a phone the 2D board fits the width with no sideways scroll", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await dock(page).getByRole("button", { name: "Open the Liquidity card" }).click();
    await expect(board(page)).toBeVisible();
    const box = await scene(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await ctx.close();
  });
});

test.describe("3D book scene", () => {
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
    // The printed action still works.
    await dock(page).getByRole("button", { name: "Open the Accounts card" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dim:accounts/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 2/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 2/);
    // While the tour runs, the words go back to their docked place: still readable.
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    // A new step ends the tour and prints the words again.
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 3/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
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

  // Rule 10a, one check per row of the script's "Reactions" table: the pillars and the cards.
  test.describe("3d reactions", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(countDrawnFrames);
      await page.goto(`/lesson/${ID}?view=3d&step=3`);
      const stage = page.locator(".book-scene .sk-stage");
      await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    });

    test("focus marks hover, and an early pick says not yet", async ({ page }) => {
      await expectFocusMarksHover(page, "The NEAR pillar");
      await expectFocusMarksHover(page, "The Scalability card");
      await expectNotYetHint(page, "The NEAR pillar", "Open the Scalability card first.");
      await expectNotYetHint(page, "The Liquidity card", "Not yet: this card opens at step 5.");
      await expect(scene(page)).toHaveAttribute("data-scene-state", "dim:none;explored:accounts");
    });

    test("the step's card plays its slide, the pillars move to the board, and the canvas rests", async ({
      page,
    }) => {
      await expectPickPlaysAndSettles(page, "The Scalability card");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /explored:accounts,scaling/);
    });

    test("after the step, every pillar and card shows its detail", async ({ page }) => {
      await pickButton(page, "The Scalability card").press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /explored:accounts,scaling/);
      await expectPickDetail(page, "The NEAR pillar", /^NEAR, scalability: Sharded/);
      await expectPickDetail(page, "The Ethereum pillar", /^Ethereum, scalability: Scales with rollups/);
      await expectPickDetail(page, "The Solana pillar", /^Solana, scalability:/);
      await expectPickDetail(page, "The Cosmos pillar", /^Cosmos, scalability:/);
      await expectPickDetail(page, "The Accounts card", "Accounts: NEAR leads.");
    });

    test("a pillar's pick plays its bounce, then the canvas rests", async ({ page }) => {
      await pickButton(page, "The Scalability card").press("Enter");
      await expectSettled(page);
      const button = pickButton(page, "The Solana pillar");
      const before = await drawnFrames(page);
      await button.press("Enter");
      await expect(button).toHaveAttribute("data-detail", /^Solana, scalability:/);
      await expect.poll(async () => (await drawnFrames(page)) - before).toBeGreaterThan(5);
      // Its detail slip closes after a few seconds; then nothing draws.
      await expect(button).not.toHaveAttribute("data-detail", /./, { timeout: 10_000 });
      await expectSettled(page);
    });
  });
});
