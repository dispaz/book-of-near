import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, nextStep, seedRoute } from "./helpers";

// Lesson 0.1 in demo mode (no wallet, no network). Hashes are the fixtures from docs/lessons/stage-0/0.1.md.
const ID = "l-0-1-blockchain-basics";
const TITLE = "How a blockchain and a transaction work";
const STAGE = 0;

const RIGHT_ANSWERS = [
  "The block's hash changes, and the next block still stores the old hash.",
  "The transaction is rejected and no balances change.",
  "It acts as a fingerprint: any change to the block gives a different hash.",
];

test.beforeEach(async ({ page }, info) => {
  // 3D draws with software WebGL (SwiftShader) in headless runs: slow when many tests share the CPU.
  if (/3d|switching|contents/i.test(info.titlePath.join(" "))) test.slow();
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("ledger-scene");
const action = (page: Page, name: string) =>
  page.locator(".action-slot").getByRole("button", { name, exact: true });
const hashOf = (page: Page, n: number) => page.getByTestId(`block-hash-${n}`);
const VIEWS = ["2d", "3d"] as const;
/** The 3D view loads three.js lazily and compiles shaders in software WebGL: allow it time to appear. */
const LOAD_3D = 20_000;

/**
 * Clicks an object in the scene. In 2D it is a normal button. In 3D the object is picked through its
 * labelled pick button (the way keyboard and screen-reader users do), which sits on the 3D object.
 */
async function pick(page: Page, name: string) {
  const view = await scene(page).getAttribute("data-view");
  const button = page.getByRole("button", { name, exact: true });
  if (view === "3d") await button.press("Enter");
  else await button.click();
}
const linkTo = (page: Page, n: number) => page.getByTestId(`link-${n}`);

/** Walks the whole lesson. `checkWrongFirst` answers question 1 wrong once to see the explanation. */
async function walk(page: Page, { checkWrongFirst = true } = {}) {
  const next = page.getByRole("button", { name: "Next step" });

  // 1. A shared notebook: open any copy.
  await expect(next).toBeDisabled();
  await pick(page, "Open Ben's notebook");
  await expect(page.getByTestId("notebook-Ben")).toContainText("Ana 10");
  await expect(page.getByTestId("notebook-Ben")).toContainText("Cora 0");
  await nextStep(page);

  // 2. Move some coins: a rejected transaction first, then the real one.
  await expect(next).toBeDisabled();
  const amount = page.getByLabel("Amount (coins)");
  await amount.fill("11");
  await action(page, "Send").click();
  await expect(page.getByRole("alert")).toHaveText("Rejected: Ana only has 10");
  await expect(page.getByTestId("balance-Ana")).toHaveText("10");
  await amount.fill("3");
  await action(page, "Send").click();
  await expect(page.getByTestId("balance-Ana")).toHaveText("7");
  await expect(page.getByTestId("balance-Ben")).toHaveText("8");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:2/);
  await nextStep(page);

  // 3. Transactions go into blocks: open block #1.
  await expect(next).toBeDisabled();
  await pick(page, "Open block #1");
  await expect(page.getByRole("region", { name: "Block #1" })).toContainText("Ana->Ben 3");
  await nextStep(page);

  // 4. A fingerprint: the hash, then a changed text gives a changed hash.
  await expect(next).toBeDisabled();
  await expect(hashOf(page, 1)).toHaveText("cfb1f067");
  await expect(page.getByTestId("sandbox-hash")).toHaveText("cfb1f067");
  await page.getByLabel("Change the text").fill("Ana->Ben 4");
  await expect(page.getByTestId("sandbox-hash")).not.toHaveText("cfb1f067");
  await nextStep(page);

  // 5. Blocks link by hash: two more transactions, two more blocks.
  await expect(next).toBeDisabled();
  await action(page, "Send").click(); // pre-filled Ben -> Cora 2
  await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:3/);
  await action(page, "Send").click(); // pre-filled Cora -> Ana 1
  await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:4/);
  await expect(hashOf(page, 0)).toHaveText("ec402b30");
  await expect(hashOf(page, 2)).toHaveText("744f6e9c");
  await expect(hashOf(page, 3)).toHaveText("c9d091cb");
  await expect(page.getByTestId("block-prev-2")).toHaveText("cfb1f067");
  for (const n of [1, 2, 3]) await expect(linkTo(page, n)).toHaveAttribute("data-link", "ok");
  await nextStep(page);

  // 6. Rewrite history: every later link breaks; repair and undo work.
  await expect(next).toBeDisabled();
  const edit = page.getByLabel("Amount in block #1");
  await edit.fill("9");
  await expect(hashOf(page, 1)).toHaveText("c0fed3ed");
  await expect(hashOf(page, 2)).toHaveText("10805a80");
  await expect(hashOf(page, 3)).toHaveText("cba6509e");
  await expect(linkTo(page, 1)).toHaveAttribute("data-link", "ok");
  await expect(linkTo(page, 2)).toHaveAttribute("data-link", "broken");
  await expect(linkTo(page, 3)).toHaveAttribute("data-link", "broken");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /broken:2,3/);
  await expect(next).toBeEnabled();
  await page.getByRole("button", { name: "Repair next block" }).click();
  await expect(linkTo(page, 2)).toHaveAttribute("data-link", "ok");
  await expect(linkTo(page, 3)).toHaveAttribute("data-link", "broken");
  await page.getByRole("button", { name: "Undo my edit" }).click();
  await expect(hashOf(page, 1)).toHaveText("cfb1f067");
  for (const n of [1, 2, 3]) await expect(linkTo(page, n)).toHaveAttribute("data-link", "ok");
  await edit.fill("9");
  await expect(linkTo(page, 2)).toHaveAttribute("data-link", "broken");
  await nextStep(page);

  // 7. The others still hold the true copy.
  await expect(next).toBeDisabled();
  await expect(page.getByTestId("notebook-Ben")).toHaveAttribute("data-copy", "differs");
  await action(page, "Compare copies").click();
  await expect(page.getByTestId("compare-result")).toContainText("Ben's copy does not match");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /copies:restored/);
  await expect(page.getByTestId("notebook-Ben")).toHaveAttribute("data-copy", "matches");
  await nextStep(page);

  // 8. Check: one wrong answer first, to see the explanation.
  if (checkWrongFirst) {
    const check = page.getByRole("dialog", { name: "Quick check" });
    await check.getByRole("radio", { name: "Old blocks are locked with a password." }).check();
    await check.getByRole("button", { name: "Check answers" }).click();
    await expect(check).toContainText("There is no password");
    await expect(next).toBeDisabled();
  }
  await answerCheck(page, RIGHT_ANSWERS);
  await nextStep(page);

  // 9. Honest take and Finish.
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest).toContainText("Slower and costlier than a normal database");
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
  expect(await completionOf(page, ID)).toMatchObject({ lessonId: ID, stage: STAGE, mode: "demo" });
}

test.describe(`lesson ${ID}`, () => {
  test("is first in the contents and walks to Finish in demo mode", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
    await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
    await expect(scene(page)).toBeVisible({ timeout: LOAD_3D });
    await walk(page);
    expect(errors).toEqual([]);
  });

  for (const view of VIEWS) {
    test(`walks to Finish in the ${view} view`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
      await walk(page);
      expect(errors).toEqual([]);
    });

    test(`works with reduced motion in the ${view} view`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
      await walk(page, { checkWrongFirst: false });
      await ctx.close();
    });

    test(`works on a phone-sized screen in the ${view} view`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
      await walk(page, { checkWrongFirst: false });
      await ctx.close();
    });
  }

  for (const view of VIEWS) {
    test(`opening a later step by URL builds the blocks it needs (${view})`, async ({ page }) => {
      await page.goto(`/lesson/${ID}?step=6&view=${view}`);
      await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
      await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:4/);
      await expect(hashOf(page, 3)).toHaveText("c9d091cb");
      await page.getByLabel("Amount in block #1").fill("9");
      await expect(linkTo(page, 3)).toHaveAttribute("data-link", "broken");
    });
  }

  test("the quiz opens in the middle and minimises to show the summary page", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=8`);
    const quiz = page.getByRole("dialog", { name: "Quick check" });
    await expect(quiz).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("A ledger is a list of who owns what.");
    await quiz.getByRole("button", { name: /Minimise/ }).click();
    await expect(quiz).toHaveCount(0);
    await expect(summary.getByRole("heading", { name: /hash: a short fingerprint/ })).toBeVisible();
    await page.getByRole("button", { name: /Quick check: open it again/ }).click();
    await expect(quiz).toBeVisible();
  });

  test("Read as text lists every caption", async ({ page }) => {
    await page.goto(`/lesson/${ID}`);
    await page.getByText("Read as text").click();
    await expect(page.locator(".read-as-text li")).toHaveCount(9);
    await expect(page.locator(".read-as-text")).toContainText("Pretend you are Ben");
  });
});

for (const view of VIEWS) {
  test(`later texts use the amount the learner actually sent (${view})`, async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=${view}`);
    await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
    await pick(page, "Open Ben's notebook");
    await nextStep(page);
    await page.getByLabel("Amount (coins)").fill("5");
    await action(page, "Send").click();
    await expect(page.getByTestId("balance-Ben")).toHaveText("10");
    await nextStep(page);
    await pick(page, "Open block #1");
    await expect(page.getByRole("region", { name: "Block #1" })).toContainText("Ana->Ben 5");
    await nextStep(page);
    await page.getByLabel("Change the text").fill("Ana->Ben 6");
    await nextStep(page);
    await action(page, "Send").click();
    await action(page, "Send").click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:4/);
    await nextStep(page);

    // Step 6 talks about the 5 coins sent, not the default 3.
    await expect(page.getByTestId("caption")).toHaveText(/Ana sent you 9 coins, not 5\./);
    await expect(page.getByText("Change the 5 in block #1 to 9")).toBeVisible();
    await page.getByText("Read as text").click();
    await expect(page.locator(".read-as-text li").nth(5)).toContainText("not 5");
  });
}

test.describe(`lesson ${ID}: switching views`, () => {
  const viewButton = (page: Page, name: "2D" | "3D") =>
    page.getByRole("group", { name: "Scene view" }).getByRole("button", { name, exact: true });

  test("switching 2D to 3D and back keeps progress, values and open gates", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await pick(page, "Open Ben's notebook");
    await nextStep(page);
    await page.getByLabel("Amount (coins)").fill("5");
    await action(page, "Send").click();
    await expect(page.getByTestId("balance-Ben")).toHaveText("10");
    await nextStep(page);
    await pick(page, "Open block #1");
    const next = page.getByRole("button", { name: "Next step" });
    await expect(next).toBeEnabled();

    // 2D -> 3D after a gate: same step, gate still open, same block open, same balances.
    await viewButton(page, "3D").click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await expect(page.getByText("Step 3 of 9")).toBeVisible();
    await expect(next).toBeEnabled();
    await expect(page.getByRole("region", { name: "Block #1" })).toContainText("Ana->Ben 5");
    await expect(page.getByTestId("balance-Ana")).toHaveText("5");
    await expect(page.getByTestId("balance-Ben")).toHaveText("10");

    // Carry on in 3D: the hash step and two more blocks.
    await nextStep(page);
    await page.getByLabel("Change the text").fill("Ana->Ben 6");
    await nextStep(page);
    await action(page, "Send").click();
    await action(page, "Send").click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:4/);
    await nextStep(page);
    await expect(page.getByTestId("caption")).toHaveText(/Ana sent you 9 coins, not 5\./);
    await page.getByLabel("Amount in block #1").fill("9");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /broken:2,3/);
    const hash1 = await hashOf(page, 1).textContent();

    // 3D -> 2D: Ben's edit, the broken links and the open gate are all still there.
    await viewButton(page, "2D").click();
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /step:5;blocks:4;broken:2,3/);
    await expect(page.getByLabel("Amount in block #1")).toHaveValue("9");
    await expect(hashOf(page, 1)).toHaveText(hash1!);
    await expect(linkTo(page, 2)).toHaveAttribute("data-link", "broken");
    await expect(page.getByTestId("scene-status")).toContainText("#1's hash changed");
    await expect(next).toBeEnabled();
    await nextStep(page);
    await action(page, "Compare copies").click();
    await expect(page.getByTestId("compare-result")).toContainText("Ben's copy does not match");
  });

  test("without WebGL the lesson runs in 2D and shows no switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await pick(page, "Open Ben's notebook");
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });

  test("the 2D view never downloads three.js; 3D loads it on demand", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
    });
    await page.goto(`/lesson/${ID}?view=2d`);
    await pick(page, "Open Ben's notebook");
    await nextStep(page);
    await action(page, "Send").click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:2/);
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);

    await viewButton(page, "3D").click();
    await expect(page.locator(".sk-stage canvas")).toBeVisible();
    await expect.poll(() => scripts.some((s) => s.includes("WebGLRenderer"))).toBe(true);
  });
});
