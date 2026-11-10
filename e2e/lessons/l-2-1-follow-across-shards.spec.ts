import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, LOAD_3D, nextStep, seedRoute, slow3d } from "./helpers";

// Walks lesson 2.1 in demo mode (no wallet, no network). It opens an earlier transaction (the learner's
// own from 0.3, or a recorded example) and follows its receipts across shards. It never sends a new one.
const ID = "l-2-1-follow-across-shards";
const TITLE = "Follow your transaction across shards";
const STAGE = 2;
const EXAMPLE = "HhRTH4KQ9n8WtsGv1VZ7S7UytSZHQxEdTCmyTCa38ULp";
const BASE58_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.getByTestId("shard-scene");
const dock = (page: Page) => page.locator(".action-slot");

async function expectView(page: Page, view: "2d" | "3d") {
  await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
}

/** The drawing exists: a WebGL canvas on the book in 3D, an SVG page in 2D. */
async function expectDrawing(page: Page) {
  const view = await scene(page).getAttribute("data-view");
  await expect(page.locator(".book-scene canvas")).toHaveCount(view === "3d" ? 1 : 0);
  await expect(page.getByTestId("shard-2d")).toHaveCount(view === "3d" ? 0 : 1);
}

/** A learner who finished 0.3 in demo mode: the evidence is in the progress store. */
async function seed03(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "bon:v1",
      JSON.stringify({
        v: 1,
        route: "newcomer",
        completions: [],
        evidence: {
          "l-0-3-send-a-transaction": {
            txHash: "4VxZmyXwXcPA6SH6cYVNKvSFxpRGTetfNY7Y1iBQTMUx",
            mode: "demo",
            includedMs: "850",
            finalMs: "3250",
          },
        },
      }),
    );
  });
}

/** Step 1: choose a transaction and load its path. */
async function load(page: Page, pick: "mine" | "example") {
  await dock(page)
    .getByRole("button", { name: pick === "mine" ? /^My 0\.3 transaction/ : /^Recorded example/ })
    .click();
  await dock(page).getByRole("button", { name: "Load transaction path" }).click();
  await expect(page.getByTestId("trace-tx")).toHaveText(pick === "example" ? EXAMPLE : BASE58_HASH);
}

/** Steps 1 to 7. `pick` says which transaction to open. */
async function walk(page: Page, pick: "mine" | "example") {
  const next = page.getByRole("button", { name: "Next step" });
  // 1. Pick a transaction.
  await expect(next).toBeDisabled();
  await load(page, pick);
  await nextStep(page);
  // 2. Shards, chunks, blocks.
  await expectDrawing(page);
  await expect(page.getByTestId("shard-count")).toHaveText(pick === "example" ? "10" : "6");
  await nextStep(page);
  // 3. Where it started.
  await expect(page.getByTestId("first-shard")).toHaveText(pick === "example" ? "9" : /^\d+$/);
  await nextStep(page);
  // 4. Follow the receipts one by one; the gate opens at the last one.
  await expect(next).toBeDisabled();
  const follow = dock(page).getByRole("button", { name: "Follow next receipt" });
  const total = Number(await page.getByTestId("hop-total").textContent());
  expect(total).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < total; i++) {
    await follow.click();
    await expect(page.getByTestId("hop-index")).toHaveText(String(i + 1));
  }
  await expect(page.getByTestId("hop-detail")).toContainText(/block \d+/);
  await nextStep(page);
  // 5. Where the time went.
  await expect(page.getByTestId("timeline")).toBeVisible();
  await expect(page.getByTestId("work-time")).toHaveText(/^\d+(\.\d+)? s$/);
  await dock(page).getByRole("button", { name: "Inspect breakdown" }).click();
  await expect(page.getByTestId("breakdown")).toBeVisible();
  await expect(page.getByTestId("breakdown").locator("[data-part]")).toHaveCount(pick === "mine" ? 3 : 1);
  await nextStep(page);
  // 6. Check.
  await answerCheck(page, [
    "The transactions and receipts one shard ran for one block.",
    "The shard that holds the signer's account.",
    "Each receipt runs in a later block, often on another shard.",
  ]);
  await nextStep(page);
  // 7. Honest take.
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest.getByText(/Extra blocks per hop/)).toBeVisible();
  await expect(honest.getByText("(unverified)")).toBeVisible();
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    // The 3D walks load WebGL and turn a page per step: give them more time than a flat walk.
    test.beforeEach(() => slow3d(view === "3d"));

    test("walks the recorded example to Finish in demo mode", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript((v) => localStorage.setItem("bon:view", v), view);
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await expectView(page, view);
      await walk(page, "example");
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: { txHash: EXAMPLE, source: "recorded", shards: "9,4,5" },
      });
      expect(errors).toEqual([]);
    });

    test("opens the learner's own 0.3 transaction", async ({ page }) => {
      await seed03(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await walk(page, "mine");
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        evidence: { txHash: expect.stringMatching(BASE58_HASH), source: "demo" },
      });
    });

    test("walks with reduced motion", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await walk(page, "example");
      await context.close();
    });

    test("walks on a phone-sized screen", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 760 } });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await walk(page, "example");
      await context.close();
    });

    test("step 4 steps back and forward through the hops; a gas refund is a coin", async ({ page }) => {
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await load(page, "example");
      for (let i = 0; i < 3; i++) await nextStep(page);
      const bar = page.getByTestId("hop-nav");
      const back = bar.getByRole("button", { name: "Previous hop" });
      const fwd = bar.getByRole("button", { name: "Next hop" });
      const at = page.getByTestId("hop-index");
      await expect(back).toBeDisabled();
      // Forward from the newest hop follows on; back only looks, it never unfollows.
      await fwd.click();
      await fwd.click();
      await fwd.click();
      await expect(at).toHaveText("4");
      await expect(page.getByTestId("refund-note")).toContainText("carries money, not work");
      await back.click();
      await back.click();
      await expect(at).toHaveText("2");
      await expect(page.getByTestId("refund-note")).toHaveCount(0);
      await fwd.click();
      await fwd.click();
      await expect(at).toHaveText("4");
      // Looking back did not lose the path: the gate is still where it was (hop 4 of 7, not done).
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await fwd.click();
      await fwd.click();
      await fwd.click();
      await expect(at).toHaveText("7");
      await expect(fwd).toBeDisabled();
      await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
      // The refunds are picks with their own name; picking one looks at it.
      await page.getByRole("button", { name: /^Chunk 4: gas refund on shard/ }).press("Enter");
      await expect(at).toHaveText("4");
    });

    test("the scene's objects are buttons: the parcel loads, the slips name their chunk", async ({
      page,
    }) => {
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      // Keyboard picks: the same buttons a screen reader reaches (in 3D they sit under the canvas).
      await page.getByRole("button", { name: "Parcel: load the transaction path" }).press("Enter");
      await expect(page.getByTestId("trace-tx")).toHaveText(EXAMPLE);
      await nextStep(page);
      await page.getByRole("button", { name: "Shard 4" }).press("Enter");
      await expect(page.getByTestId("shard-pick")).toContainText("Shard 4 made a chunk");
      await nextStep(page);
      await nextStep(page);
      // Picking the newest slip follows on, like the button. Wait for the follow step to be on screen first.
      await expect(dock(page).getByRole("button", { name: "Follow next receipt" })).toBeVisible();
      await page.getByRole("button", { name: /^Chunk 1:/ }).press("Enter");
      await expect(page.getByTestId("hop-index")).toHaveText("2");
      await page.getByRole("button", { name: /^Chunk 1:/ }).press("Enter");
      await expect(page.getByTestId("hop-index")).toHaveText("1");
      await expect(page.getByTestId("hop-detail")).toContainText(
        "2nq8jS6q1hnzNupWeUUbNmCrg3BXy7msqkd34rHUu7ga",
      );
      // Ribbons stay picks after the grid step; the signer's mailbox goes back to where it started.
      await page.getByRole("button", { name: "Shard 5" }).press("Enter");
      await expect(page.getByTestId("shard-pick")).toContainText("Shard 5 made a chunk");
      await page.getByRole("button", { name: /^Chunk 2:/ }).press("Enter");
      await expect(page.getByTestId("hop-index")).toHaveText("2");
      await page.getByRole("button", { name: /^Signer's mailbox/ }).press("Enter");
      await expect(page.getByTestId("hop-index")).toHaveText("1");
      // At the time step, picking a slip opens the breakdown, like the button.
      const follow = dock(page).getByRole("button", { name: "Follow next receipt" });
      for (let i = 2; i < 7; i++) await follow.click();
      await nextStep(page);
      await expect(dock(page).getByRole("button", { name: "Inspect breakdown" })).toBeVisible();
      await page.getByRole("button", { name: /^Chunk 1:/ }).press("Enter");
      await expect(page.getByTestId("breakdown")).toBeVisible();
    });
  });

test.describe(`lesson ${ID}: choices and views`, () => {
  test("without a 0.3 transaction the own-transaction choice is off and the example is chosen", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    const choices = dock(page).getByRole("group", { name: "Which transaction" });
    const mine = choices.getByRole("button", { name: /^My 0\.3 transaction/ });
    await expect(mine).toBeDisabled();
    // The reason sits right under the button, and is read with it.
    await expect(mine).toHaveAccessibleDescription(
      "No 0.3 transaction yet. Send one in lesson 0.3, or use the recorded example.",
    );
    await expect(mine).toHaveAttribute("aria-pressed", "false");
    const example = choices.getByRole("button", { name: "Recorded example ✓" });
    await expect(example).toBeEnabled();
    await expect(example).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chosen")).toContainText("the recorded example");
    // Only the next thing to do is solid; once done it reads as finished, not as unavailable.
    const loadPath = dock(page).getByRole("button", { name: "Load transaction path" });
    await expect(loadPath).toHaveClass(/primary/);
    await expect(example).not.toHaveClass(/primary/);
    await loadPath.click();
    const loaded = dock(page).getByRole("button", { name: "Path loaded ✓" });
    await expect(loaded).toHaveAttribute("aria-disabled", "true");
    await expect(loaded).toHaveClass(/done/);
  });

  test("the learner's choice shows in later text, and 2D to 3D keeps the followed hop", async ({ page }) => {
    slow3d();
    await page.goto(`/lesson/${ID}?view=2d`);
    await load(page, "example");
    await nextStep(page);
    await nextStep(page);
    // Step 3's caption uses the opened transaction's own first shard and block.
    await expect(page.getByTestId("caption")).toContainText("shard 9, in block #275719637");
    await nextStep(page);
    await expect(page.getByTestId("caption")).toContainText("7 steps across 3 shards and 5 blocks");
    const follow = dock(page).getByRole("button", { name: "Follow next receipt" });
    await follow.click();
    await follow.click();
    await expect(page.getByTestId("hop-index")).toHaveText("3");
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expect(page.getByTestId("hop-index")).toHaveText("3");
    await expect(page).toHaveURL(/step=4/);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "2D" }).click();
    await expectView(page, "2d");
    await expect(page.getByTestId("hop-index")).toHaveText("3");
    await expect(page.getByTestId("hop-detail")).toContainText("usdc.loca-swarm-mvwu8dfo.testnet");
  });

  test("the learner's own 0.3 time shows in step 5's caption", async ({ page }) => {
    await seed03(page);
    await page.goto(`/lesson/${ID}?view=2d`);
    await load(page, "mine");
    // The seeded hash is not in this fresh in-memory demo chain, so the app replays the transfer and says so.
    await expect(page.getByTestId("replayed")).toBeVisible();
    for (let i = 0; i < 3; i++) await nextStep(page);
    const follow = dock(page).getByRole("button", { name: "Follow next receipt" });
    const total = Number(await page.getByTestId("hop-total").textContent());
    for (let i = 1; i < total; i++) {
      await follow.click();
      await expect(page.getByTestId("hop-index")).toHaveText(String(i + 1));
    }
    await nextStep(page);
    await expect(page.getByTestId("caption")).toContainText("Remember the 3.25 s until Final in 0.3?");
  });

  test("opening a later step by its link (or a reload) opens the default transaction", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=4`);
    await expect(page.getByTestId("hop-total")).toHaveText("7");
    await expect(page.getByTestId("caption")).toContainText("7 steps across 3 shards and 5 blocks");
    await dock(page).getByRole("button", { name: "Follow next receipt" }).click();
    await expect(page.getByTestId("hop-index")).toHaveText("2");
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expectView(page, "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await expect(dock(page).getByRole("button", { name: "Load transaction path" })).toBeVisible();
  });

  test("2D never downloads three.js; 3D loads it when chosen", async ({ page }) => {
    slow3d();
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
    });
    await page.goto(`/lesson/${ID}?view=2d`);
    await expect(dock(page).getByRole("button", { name: "Load transaction path" })).toBeVisible();
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expectDrawing(page);
    await expect.poll(() => scripts.some((s) => s.includes("WebGLRenderer"))).toBe(true);
  });
});

test.describe("3D book scene", () => {
  test.beforeEach(() => slow3d());
  /** Opens the recorded example at step 1, then goes to step 3. */
  async function atStart(page: Page) {
    await page.goto(`/lesson/${ID}?view=3d`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await load(page, "example");
    await nextStep(page);
    await nextStep(page);
  }

  test("wide screens print the step on the left page; the tour moves the camera and docks the words", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await atStart(page);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
    await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 3/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 3/);
    // While the tour runs, the words go back to their docked place: still readable.
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    // A new step ends the tour and prints the words again; the printed action still works.
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 4/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
    await dock(page).getByRole("button", { name: "Follow next receipt" }).click();
    await expect(page.getByTestId("hop-index")).toHaveText("2");
    await ctx.close();
  });

  test("phones keep the step's words docked, not printed on the page", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await atStart(page);
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.locator(".book-page")).toHaveCSS("display", "contents");
    await ctx.close();
  });
});
