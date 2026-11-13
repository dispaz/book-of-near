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

// Walks lesson 6.1 in demo mode (no wallet, no network). The proposal is an example made up for the
// lesson (labelled so on the page) and the vote is a practice vote: nothing is sent to a chain.
const ID = "l-6-1-vote-on-a-proposal";
const TITLE = "Read and vote on a proposal";
const ANSWERS = [
  "To give more voting power to people who keep their NEAR locked longer.",
  "After an unbonding period of 4 epochs, a little over a day.",
  "Locked NEAR takes 45 days to unlock, so they cannot get it back out to repay a 10-minute loan.",
];

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("gov-scene");
const dock = (page: Page) => page.locator(".action-slot");

async function go(page: Page, caption: string | RegExp) {
  await nextStep(page);
  await expect(page.getByTestId("caption")).toContainText(caption);
}

/** From the town hall to "Lesson done", voting YES with 100 NEAR locked for 4 years. */
async function walk(page: Page) {
  await expect(page.getByTestId("caption")).toContainText("Who decides how NEAR changes?");
  await go(page, "Delegate your NEAR to a validator");
  await expect(page.getByTestId("staking")).toContainText("4 epochs, a little over a day");

  await go(page, "long-term believers");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await expect(page.getByTestId("ve-power")).toHaveText("100 veNEAR");
  await page.getByRole("slider", { name: /Time locked/ }).fill("48");
  await expect(page.getByTestId("ve-power")).toHaveText("100 veNEAR + 200 extra = 300 veNEAR");
  await expect(page.getByTestId("lock-months")).toHaveText("4 years");
  await expect(page.getByTestId("unlock-cost")).toHaveText(
    "Unlock now: the 200 extra veNEAR is gone, your 100 NEAR stops counting and waits 45 days before you can take it out.",
  );
  await expect(scene(page)).toHaveAttribute("data-scene-state", /months:48;locked:yes/);

  await go(page, "Read Proposal #42");
  await expect(page.getByTestId("example-label")).toContainText("made up for this lesson");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Review proposal" }).click();
  await expect(page.getByTestId("proposal-details")).toContainText("50,000 NEAR");
  await expect(page.getByTestId("tally")).toContainText("62% yes");

  await go(page, "Cast your weighted vote");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Vote YES" }).click();
  await expect(page.getByTestId("vote-status")).toHaveText(
    "Practice vote: +300 veNEAR YES. Nothing was sent to a chain.",
  );
  await expect(page.getByTestId("tally")).toContainText("300,300 veNEAR voted, 300 of it yours");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /vote:yes/);

  await go(page, "Three questions");
  await answerCheck(page, ANSWERS);
  await nextStep(page);
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest).toContainText("Few voters");
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

const RECORD = {
  stage: 6,
  mode: "demo",
  evidence: { proposalId: "42", voteCast: "true", choice: "yes", power: "300", kind: "practice" },
};

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test.beforeEach(() => slow3d(view === "3d"));

    test("is in the contents and walks to Finish in demo mode with a practice vote", async ({ page }) => {
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
    await page.getByRole("button", { name: "The YES stamp" }).press("Enter");
    await expect(note).toHaveAttribute("data-not-yet", "yes");
    await expect(note).toContainText("Inspect the proposal first.");
    await page.getByRole("button", { name: "The staking pool" }).press("Enter");
    await expect(note).toContainText("4 epochs, a little over a day");
    await go(page, "Delegate");
    await go(page, "long-term believers");
    await page.getByRole("button", { name: "The veNEAR gauge" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /months:12;locked:yes/);
    await go(page, "Read Proposal #42");
    await page.getByRole("button", { name: "Proposal #42" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /reviewed:yes/);
    await go(page, "Cast your weighted vote");
    await page.getByRole("button", { name: "The NO stamp" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /vote:no/);
    await expect(page.getByTestId("vote-status")).toContainText("+150 veNEAR NO");
    await page.getByRole("button", { name: "The YES stamp" }).press("Enter");
    await expect(note).toContainText("You voted NO.");
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: /town hall/ })).toBeVisible();
  });

  test("phones fit the 2d page with no sideways scroll", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=2d&step=3`);
    await expect(page.getByTestId("ve-power")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await ctx.close();
  });

  test("2D to 3D keeps the lock and the vote", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=3`);
    await page.getByRole("slider", { name: /Time locked/ }).fill("24");
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await expect(scene(page)).toHaveAttribute("data-scene-state", /months:24;locked:yes/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
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
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
    await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);
    // The slider still works with the words printed.
    await page.getByRole("slider", { name: /Time locked/ }).fill("36");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /months:36/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 3/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 3/);
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 4/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
    await ctx.close();
  });

  test("phones keep the step's words docked, not printed on the page", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.locator(".book-page")).toHaveCSS("display", "contents");
    await expect(page.getByTestId("ve-power")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await ctx.close();
  });

  test("an idle 3d scene draws no frames, and the gauge settles after the slider moves", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    const stage = page.locator(".book-scene .sk-stage");
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    await expectSettled(page);
    await page.getByRole("slider", { name: /Time locked/ }).fill("48");
    await expectSettled(page);
  });

  // Rule 10a, one block per row of the script's Reactions table.
  test("3d objects react: focus marks hover, an early pick says not yet, a pick after the step shows its detail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    const stage = page.locator(".book-scene .sk-stage");
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });

    // Each pick's animation is checked before any hint or detail slip: a slip fading out (after 3 or
    // 6 s) draws a frame of its own. The gauge sets a lock on step 3 (its stretch plays, the column grows).
    await expectFocusMarksHover(page, "The veNEAR gauge");
    await expectPickPlaysAndSettles(page, "The veNEAR gauge");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /months:12;locked:yes/);
    // Staking mailbox: always a detail.
    await expectFocusMarksHover(page, "The staking pool");
    await expectPickPlaysAndSettles(page, "The staking pool");
    await expectPickDetail(page, "The staking pool", /4 epochs, a little over a day/);
    // Proposal scroll and ballot stamps: not yet on step 3.
    await expectNotYetHint(page, "Proposal #42", "Not yet: you read the proposal on step 4.");
    await expectNotYetHint(page, "The YES stamp", "Inspect the proposal first.");

    await nextStep(page);
    await expectFocusMarksHover(page, "Proposal #42");
    await page.getByRole("button", { name: "Proposal #42" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /reviewed:yes/);
    await expectPickDetail(page, "Proposal #42", /62% yes, 38% no/);
    await expectPickDetail(
      page,
      "The veNEAR gauge",
      "100 NEAR locked for 1 year: 100 veNEAR + 50 extra = 150 veNEAR. Unlocking loses the extra.",
    );
    await expectNotYetHint(page, "The NO stamp", "Not yet: you vote on step 5.");
  });

  test("3d ballot stamps react on step 5: a pick stamps the vote, then shows it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${ID}?view=3d&step=5`);
    const stage = page.locator(".book-scene .sk-stage");
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    await expectFocusMarksHover(page, "The YES stamp");
    await expectPickPlaysAndSettles(page, "The YES stamp");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /vote:yes/);
    await expectPickDetail(page, "The YES stamp", /\+100 veNEAR YES/);
    await expectPickDetail(page, "The NO stamp", "You voted YES. One vote per voter.");
    await expectPickDetail(page, "Proposal #42", /62% yes, 38% no/);
  });
});
