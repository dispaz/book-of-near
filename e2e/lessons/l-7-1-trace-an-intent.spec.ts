import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, LOAD_3D, nextStep, seedRoute, slow3d, slow3dUnless2d } from "./helpers";

// Walks the capstone in demo mode (no wallet, no network): the learner has made no swap, so the replay
// uses the recorded intent (lesson 4.2's recorded quote). Every stage's concept links back to its lesson.
const ID = "l-7-1-trace-an-intent";
const TITLE = "Trace one intent end to end";
const ANSWERS = [
  "So that even if the app is compromised, the account's full-access key and main funds stay safe.",
  "Through receipts that carry the call to the other shard and run in a later block.",
  "A solver pays out from funds it already holds there, and the verifier contract on NEAR settles the trade.",
];

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("cap-scene");
const dock = (page: Page) => page.locator(".action-slot");
const trail = (page: Page) => page.getByTestId("trail");

async function go(page: Page, caption: string | RegExp) {
  await nextStep(page);
  await expect(page.getByTestId("caption")).toContainText(caption);
}

/** From the map to "Lesson done". Checks every stage's link back on the way. */
async function walk(page: Page) {
  await expect(page.getByTestId("intent-source")).toHaveAttribute("data-source", "recorded");
  // The map: every stage from 0 to 4, each with a link back to its lesson.
  for (const [stage, lesson] of [
    [0, "l-0-3-send-a-transaction"],
    [1, "l-1-1-claim-your-name"],
    [1, "l-1-2-function-call-key"],
    [2, "l-2-1-follow-across-shards"],
    [3, "l-3-1-deploy-a-contract"],
    [4, "l-4-2-intent-swap"],
    [4, "l-4-1-one-account-every-chain"],
  ] as const) {
    const link = trail(page).locator(`a[href$="/lesson/${lesson}"]`);
    await expect(link).toHaveCount(1);
    await expect(link.locator("xpath=..")).toContainText(`Stage ${stage}`);
  }

  await go(page, "your named account (learner.testnet) signs the intent");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Authorize intent" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /authorized:yes;spot:shardA/);
  await expect(trail(page).getByRole("link", { name: /Back to Lesson 1.2/ })).toBeVisible();

  await go(page, "Layer 3");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /spot:shardB/);
  await expect(trail(page).getByRole("link", { name: /Back to Lesson 2.1/ })).toBeVisible();

  await go(page, "Layer 4");
  await expect(page.getByTestId("gas-burned")).toHaveText("all of it");
  await expect(page.getByTestId("gas-to-contract")).toContainText("up to and including protocol version 86");
  await expect(page.getByTestId("gas-split")).not.toContainText("70%");
  await expect(trail(page).getByRole("link", { name: /Back to Lesson 3.1/ })).toBeVisible();

  await go(page, "Layer 5");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Verify foreign settlement" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /settle:done/, { timeout: 10_000 });
  await expect(page.getByTestId("settle-where")).toContainText("no trade happened");
  await expect(page.getByTestId("signers-note")).toContainText("only when a payout must leave NEAR");
  await expect(trail(page).getByRole("link", { name: /Back to Lesson 4.1/ })).toBeVisible();

  await go(page, "Three questions");
  await answerCheck(page, ANSWERS);
  await nextStep(page);
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest).toContainText("Who should care");
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

const RECORD = {
  stage: 7,
  mode: "demo",
  evidence: {
    capstoneComplete: "true",
    txHash: "recorded-demo-intent",
    intentSource: "recorded",
    mpcVerified: "false",
    stagesTraced: "0,1,2,3,4",
    ownLayers: "none",
  },
};

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test.beforeEach(() => slow3d(view === "3d"));

    test("walks to Finish in demo mode on the recorded intent and emits the completion record", async ({
      page,
    }) => {
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

    test("objects do the step's action, say 'not yet' too early, and show a detail after", async ({
      page,
    }) => {
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
      const note = page.getByTestId("picked-note");
      await page.getByRole("button", { name: "Your shard" }).press("Enter");
      await expect(note).toHaveAttribute("data-not-yet", "yes");
      await expect(note).toContainText("Authorize the intent first.");
      await go(page, "signs the intent");
      await page.getByRole("button", { name: "The function-call key" }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /authorized:yes/);
      await go(page, "Layer 3");
      await go(page, "Layer 4");
      await page.getByRole("button", { name: "Where the USDC lands" }).press("Enter");
      await expect(note).toHaveAttribute("data-not-yet", "yes");
      await expect(note).toContainText("Let the contract check the intent first.");
      await go(page, "Layer 5");
      // The signing nodes are a side note: picking them explains, and settles nothing.
      await page.getByRole("button", { name: "The signing nodes" }).press("Enter");
      await expect(note).toContainText("only when a payout must leave NEAR");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /settle:idle/);
      await page.getByRole("button", { name: "Where the USDC lands" }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /settle:done/, { timeout: 10_000 });
      await page.getByRole("button", { name: "Where the USDC lands" }).press("Enter");
      await expect(note).not.toHaveAttribute("data-not-yet", "yes");
      await expect(note).toContainText("20.27 USDC");
    });
  });

test.describe(`lesson ${ID}`, () => {
  test("replays the learner's own 4.2 swap and name when they have them (2d)", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "bon:v1",
        JSON.stringify({
          v: 1,
          route: "veteran",
          completions: [],
          position: null,
          evidence: {
            "l-1-1-claim-your-name": { accountId: "ana.testnet", txHash: "t", mode: "demo" },
            "l-4-2-intent-swap": {
              realSwapTxHash: "demo-0001",
              realSwapExecuted: "false",
              simulatedSwap: "true (demo wallet, no real money)",
            },
          },
        }),
      );
    });
    await page.goto(`/lesson/${ID}?view=2d`);
    await expect(page.getByTestId("intent-source")).toHaveAttribute("data-source", "demo-wallet");
    await expect(trail(page).locator('[data-layer="account"]')).toHaveAttribute("data-mine", "yes");
    await expect(trail(page).locator('[data-layer="account"]')).toContainText("ana.testnet");
    await go(page, "your named account (ana.testnet)");
  });

  test("a link back opens the earlier lesson (2d)", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await trail(page)
      .getByRole("link", { name: /Back to Lesson 2.1/ })
      .click();
    await expect(page).toHaveURL(/\/lesson\/l-2-1-follow-across-shards/);
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
  });

  test("2D to 3D keeps the authorized intent", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=2`);
    await dock(page).getByRole("button", { name: "Authorize intent" }).click();
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await expect(scene(page)).toHaveAttribute("data-scene-state", /authorized:yes/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });
});

test.describe("3D book scene", () => {
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
    await dock(page).getByRole("button", { name: "Authorize intent" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /authorized:yes/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 2/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 2/);
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
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
});
