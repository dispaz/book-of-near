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

test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.getByTestId("ledger-scene");
const action = (page: Page, name: string) =>
  page.locator(".action-slot").getByRole("button", { name, exact: true });
const hashOf = (page: Page, n: number) => page.getByTestId(`block-hash-${n}`);
const linkTo = (page: Page, n: number) => page.getByTestId(`link-${n}`);

/** Walks the whole lesson. `checkWrongFirst` answers question 1 wrong once to see the explanation. */
async function walk(page: Page, { checkWrongFirst = true } = {}) {
  const next = page.getByRole("button", { name: "Next step" });

  // 1. A shared notebook: open any copy.
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Open Ben's notebook" }).click();
  await expect(page.getByTestId("notebook-Ben")).toContainText("Ana 10");
  await expect(page.getByTestId("notebook-Ben")).toContainText("Cy 0");
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
  await page.getByRole("button", { name: "Open block #1" }).click();
  await expect(page.getByRole("region", { name: "Block #1" })).toContainText("Ana->Ben 3");
  await nextStep(page);

  // 4. A fingerprint: the hash, then a changed text gives a changed hash.
  await expect(next).toBeDisabled();
  await expect(hashOf(page, 1)).toHaveText("93fa7ab6");
  await expect(page.getByTestId("sandbox-hash")).toHaveText("93fa7ab6");
  await page.getByLabel("Change the text").fill("Ana->Ben 4");
  await expect(page.getByTestId("sandbox-hash")).not.toHaveText("93fa7ab6");
  await nextStep(page);

  // 5. Blocks link by hash: two more transactions, two more blocks.
  await expect(next).toBeDisabled();
  await action(page, "Send").click(); // pre-filled Ben -> Cy 2
  await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:3/);
  await action(page, "Send").click(); // pre-filled Cy -> Ana 1
  await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:4/);
  await expect(hashOf(page, 0)).toHaveText("48d4cf70");
  await expect(hashOf(page, 2)).toHaveText("46c2f4b1");
  await expect(hashOf(page, 3)).toHaveText("3e875716");
  await expect(page.getByTestId("block-prev-2")).toHaveText("93fa7ab6");
  for (const n of [1, 2, 3]) await expect(linkTo(page, n)).toHaveAttribute("data-link", "ok");
  await nextStep(page);

  // 6. Rewrite history: every later link breaks; repair and undo work.
  await expect(next).toBeDisabled();
  const edit = page.getByLabel("Amount in block #1");
  await edit.fill("9");
  await expect(hashOf(page, 1)).toHaveText("6c3c0e30");
  await expect(hashOf(page, 2)).toHaveText("97b846de");
  await expect(hashOf(page, 3)).toHaveText("c1495fa1");
  await expect(linkTo(page, 1)).toHaveAttribute("data-link", "ok");
  await expect(linkTo(page, 2)).toHaveAttribute("data-link", "broken");
  await expect(linkTo(page, 3)).toHaveAttribute("data-link", "broken");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /broken:2,3/);
  await expect(next).toBeEnabled();
  await page.getByRole("button", { name: "Repair next block" }).click();
  await expect(linkTo(page, 2)).toHaveAttribute("data-link", "ok");
  await expect(linkTo(page, 3)).toHaveAttribute("data-link", "broken");
  await page.getByRole("button", { name: "Undo my edit" }).click();
  await expect(hashOf(page, 1)).toHaveText("93fa7ab6");
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
    const check = page.getByRole("region", { name: "Quick check" });
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
    await walk(page);
    expect(errors).toEqual([]);
  });

  test("works with reduced motion", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}`);
    await walk(page, { checkWrongFirst: false });
    await ctx.close();
  });

  test("works on a phone-sized screen", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}`);
    await walk(page, { checkWrongFirst: false });
    await ctx.close();
  });

  test("opening a later step by URL builds the blocks it needs", async ({ page }) => {
    await page.goto(`/lesson/${ID}?step=6`);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /blocks:4/);
    await expect(hashOf(page, 3)).toHaveText("3e875716");
    await page.getByLabel("Amount in block #1").fill("9");
    await expect(linkTo(page, 3)).toHaveAttribute("data-link", "broken");
  });

  test("Read as text lists every caption", async ({ page }) => {
    await page.goto(`/lesson/${ID}`);
    await page.getByText("Read as text").click();
    await expect(page.locator(".read-as-text li")).toHaveCount(9);
    await expect(page.locator(".read-as-text")).toContainText("Pretend you are Ben");
  });
});

test("later texts use the amount the learner actually sent", async ({ page }) => {
  await page.goto(`/lesson/${ID}`);
  await page.getByRole("button", { name: "Open Ben's notebook" }).click();
  await nextStep(page);
  await page.getByLabel("Amount (coins)").fill("5");
  await action(page, "Send").click();
  await expect(page.getByTestId("balance-Ben")).toHaveText("10");
  await nextStep(page);
  await page.getByRole("button", { name: "Open block #1" }).click();
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
