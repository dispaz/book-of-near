import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, nextStep, seedRoute } from "./helpers";

// Walks lesson 1.3 in demo mode (no wallet, no network), in both views.
const ID = "l-1-3-inside-a-transaction";
const TITLE = "Inside a NEAR transaction";
const STAGE = 1;
const HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.locator("[data-scene-state]").first();
const next = (page: Page) => page.getByRole("button", { name: "Next step" });

/** Step 2: make the workshop account and wait until the chain has it. */
async function makeWorkshop(page: Page) {
  await page.getByRole("button", { name: "Make the workshop account" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /parent:yes/, { timeout: 15_000 });
}

/** Step 3: name the account, set the amount, add the three actions in order and send them. */
async function buildBatch(page: Page, label = "shop", amount = "0.02") {
  await page.getByLabel("New account name").fill(label);
  await page.getByLabel("Amount to send").fill(amount);
  await page.getByRole("button", { name: "Add: Create account" }).click();
  await page.getByRole("button", { name: "Add: Send NEAR" }).click();
  await page.getByRole("button", { name: "Add: Add a key" }).click();
  await page.getByRole("button", { name: "Send the batch" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /batch:ok/, { timeout: 15_000 });
}

/** Step 4: the builder is prefilled with a batch that adds the same key twice. */
async function breakBatch(page: Page) {
  await page.getByRole("button", { name: "Send the batch" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /failed:yes;rolledback:yes/, {
    timeout: 15_000,
  });
}

async function replay(page: Page) {
  await page.getByRole("button", { name: "Re-send the batch that worked" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /replayed:1/, { timeout: 15_000 });
}

/** Steps 1 to 5 in the page's current view. */
async function walkToCheck(page: Page) {
  await nextStep(page);
  await expect(next(page)).toBeDisabled();
  await makeWorkshop(page);
  await nextStep(page);
  await expect(next(page)).toBeDisabled();
  await buildBatch(page);
  await nextStep(page);
  await expect(next(page)).toBeDisabled();
  await breakBatch(page);
  await nextStep(page);
  await expect(next(page)).toBeDisabled();
  await replay(page);
  await nextStep(page);
}

const ANSWERS = [
  "No new account. The NEAR came back; only the fee is spent.",
  "Its nonce was already used by that key.",
  "No. All its actions go to its one receiver.",
];

test.describe(`lesson ${ID}`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`is in the contents and walks to Finish in demo mode (${view})`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await page.goto(`/lesson/${ID}?view=${view}`);
      if (view === "3d") await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });

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
          txHash: expect.stringMatching(HASH),
          failedTxHash: expect.stringMatching(HASH),
          replayRefused: "InvalidNonce",
        },
      });
    });
  }

  test("the transaction's parts show, with the nonce and block hash explained", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await makeWorkshop(page);
    const fields = page.getByTestId("tx-fields");
    for (const part of ["Signer", "Receiver", "Actions", "Nonce", "Block hash", "Transaction id"])
      await expect(fields).toContainText(part);
    await expect(fields).toContainText("one higher each time");
    await expect(fields).toContainText("too old");
    await expect(fields).toContainText("create_account");
  });

  test("actions can be ordered, and a wrong order fails and rolls back", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await makeWorkshop(page);
    await nextStep(page);
    await page.getByLabel("New account name").fill("cafe");
    await page.getByRole("button", { name: "Add: Send NEAR" }).click();
    await page.getByRole("button", { name: "Add: Create account" }).click();
    await page.getByRole("button", { name: "Add: Add a key" }).click();
    const rows = page.getByRole("list", { name: "Actions in this transaction" }).getByRole("listitem");
    await expect(rows.first()).toContainText("Send");
    // Sending NEAR to an account that does not exist yet fails, and nothing is left behind.
    await page.getByRole("button", { name: "Send the batch" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /failed:yes;rolledback:yes/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("tx-result")).toContainText("does not exist");
    await expect(next(page)).toBeDisabled();
    // Fix the order: move "Create account" up to the top, and send again.
    await page.getByRole("button", { name: "Move action 2 up" }).click();
    await expect(rows.first()).toContainText("Create");
    await page.getByRole("button", { name: "Send the batch" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /batch:ok/, { timeout: 15_000 });
    await expect(page.getByTestId("tx-result")).toContainText("cafe.");
    await expect(next(page)).toBeEnabled();
  });

  test("a forced failure undoes every action, and only the fee is paid", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await makeWorkshop(page);
    await nextStep(page);
    await buildBatch(page);
    await nextStep(page);
    const rows = page.getByRole("list", { name: "Actions in this transaction" }).getByRole("listitem");
    await expect(rows).toHaveCount(4);
    await expect(rows.last()).toContainText("same key again");
    await breakBatch(page);
    const result = page.getByTestId("tx-result");
    await expect(result).toContainText("Failed");
    await expect(result.getByText("Ran, then undone")).toHaveCount(3);
    await expect(result).toContainText("was not created");
    await expect(result).toContainText("Only the fee");
  });

  test("re-sending an old signed transaction is refused with InvalidNonce", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await makeWorkshop(page);
    await nextStep(page);
    await buildBatch(page);
    await nextStep(page);
    await breakBatch(page);
    await nextStep(page);
    await page.getByRole("button", { name: "Re-send the batch that failed" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /replayed:1/, { timeout: 15_000 });
    await replay2(page);
    const log = page.getByTestId("replay-log");
    await expect(log.getByText("Refused")).toHaveCount(2);
    await expect(log).toContainText("InvalidNonce");
  });
});

async function replay2(page: Page) {
  await page.getByRole("button", { name: "Re-send the batch that worked" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /replayed:2/, { timeout: 15_000 });
}

test.describe(`lesson ${ID}: motion, fallback, switching, phones, own values`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`works with reduced motion in the ${view} view`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await walkToCheck(page);
      await ctx.close();
    });

    test(`works on a phone-sized screen in the ${view} view`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      if (view === "3d") await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
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

  test("switching 2D to 3D and back in the middle keeps the progress", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await makeWorkshop(page);
    await nextStep(page);
    await buildBatch(page);
    const views = page.getByRole("group", { name: "Scene view" });
    await views.getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: 20_000 });
    await expect(scene(page)).toHaveAttribute("data-scene-state", /parent:yes;batch:ok/);
    await expect(next(page)).toBeEnabled();
    await nextStep(page);
    await breakBatch(page);
    await views.getByRole("button", { name: "2D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /batch:ok;failed:yes;rolledback:yes/);
    await expect(page.getByTestId("tx-result")).toContainText("Ran, then undone");
    await expect(next(page)).toBeEnabled();
  });

  test("the learner's name and amount fill the later captions", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await makeWorkshop(page);
    await nextStep(page);
    await buildBatch(page, "cafe", "0.03");
    const caption = page.getByTestId("caption");
    await nextStep(page);
    await expect(caption).toContainText("cafe2.");
    const explain = page.getByText(/the 0\.03 NEAR comes back/);
    await expect(explain.first()).toBeAttached();
    await breakBatch(page);
    await nextStep(page);
    await expect(caption).toContainText(/Your first batch had nonce \d+/);
    await expect(caption).not.toContainText("{");
  });
});
