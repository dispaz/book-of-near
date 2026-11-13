import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, LOAD_3D, nextStep, seedRoute, slow3d } from "./helpers";

// Walks lesson 2.2 in demo mode (no wallet, no network), in both views.
const ID = "l-2-2-call-across-blocks";
const TITLE = "A call that takes several blocks";
const STAGE = 2;
const T = { timeout: 15_000 };

// Two realtime cross-contract calls (about 3 s each in demo mode, then the hops) plus page turns.
test.describe.configure({ timeout: 90_000 });
test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.getByTestId("call-scene");
const state = (page: Page, re: RegExp) => expect(scene(page)).toHaveAttribute("data-scene-state", re, T);
const next = (page: Page) => page.getByRole("button", { name: "Next step" });

async function sendOrder(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Send cross-contract order", exact: true }).click();
  await state(page, /order:done;hops:3\/3/);
  await expect(next(page)).toBeEnabled();
}

async function inspectGas(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Inspect gas", exact: true }).click();
  await state(page, /gas:open/);
}

async function failOrder(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Simulate out-of-stock failure", exact: true }).click();
  await state(page, /fail:done/);
  await expect(next(page)).toBeEnabled();
}

/** Steps 1 to 5 in the page's current view: the order, the gas split, the failure. */
async function walkToCheck(page: Page) {
  await nextStep(page); // hook → the receipt
  await nextStep(page); // → order
  await sendOrder(page);
  await nextStep(page); // → gas
  await inspectGas(page);
  await nextStep(page); // → failure
  await failOrder(page);
  await nextStep(page); // → check
}

const ANSWERS = [
  "They stay committed. Your callback must see the failure and undo them itself.",
  "All of it is burned. No account receives it.",
  "Contracts can live on different shards and run in parallel without locking the whole network.",
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
          txHash: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/),
          receiptHops: "2",
          source: "demo",
        },
      });
    });
  }

  test("the call's receipts run in order, one block each, and all the gas is burned", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await nextStep(page);
    await sendOrder(page);
    const rows = page.getByTestId("receipt-list").locator("li");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText("transaction");
    await expect(rows.nth(1)).toContainText("order on buyer.demo.testnet");
    await expect(rows.nth(2)).toContainText("buy on shop.demo.testnet");
    await expect(rows.nth(3)).toContainText("on_order_completed");
    // Block numbers strictly increase, and the two contracts sit on different shards.
    const texts = await rows.allTextContents();
    const blocks = texts.map((t) => Number(/#([\d,]+)/.exec(t)![1]!.replace(/,/g, "")));
    for (let i = 1; i < blocks.length; i++) expect(blocks[i]).toBeGreaterThan(blocks[i - 1]!);
    const shards = texts.map((t) => /shard (\d+)/.exec(t)![1]);
    expect(shards[1]).not.toBe(shards[2]);
    // The learner's own block numbers reach the text.
    await expect(page.locator("body")).toContainText(`block #${blocks[2]!.toLocaleString("en-US")}`);

    await nextStep(page);
    await inspectGas(page);
    const gas = page.getByTestId("gas-split");
    const tg = async (id: string) => Number(((await page.getByTestId(id).textContent()) ?? "").split(" ")[0]);
    const all = await tg("gas-contracts");
    expect(all).toBeGreaterThan(0);
    // One row per contract; together they make the contracts' gas.
    const each = page.getByTestId("gas-by-contract");
    await expect(each).toHaveCount(2);
    const sum = (await each.locator("dd").allTextContents()).reduce((s, t) => s + Number(t.split(" ")[0]), 0);
    expect(Math.abs(sum - all)).toBeLessThanOrEqual(0.02);
    await expect(gas).toContainText("shop.demo.testnet");
    await expect(page.getByTestId("gas-burned")).toHaveText("all of it");
    await expect(page.getByTestId("gas-history")).toContainText("Up to and including protocol version 86");
    await expect(gas).not.toContainText("70%");
    await expect(page.getByTestId("caption")).toContainText(
      `burnt ${all.toFixed(2)} Tgas of gas, and the NEAR paid for it was destroyed`,
    );
  });

  test("a failing shop leaves the reservation; the callback undoes it", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await failOrder(page);
    const rows = page.getByTestId("receipt-list").locator("li");
    await expect(rows.nth(1)).toHaveClass(/ok/);
    await expect(rows.nth(2)).toHaveClass(/failed/);
    await expect(rows.nth(2)).toContainText("Out of stock");
    await expect(rows.nth(3)).toHaveClass(/ok/);
    await expect(rows.nth(3)).toContainText("undid the reservation");
  });

  test("objects answer picks: a hint before the order, a detail after", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=2`);
    await page.getByRole("button", { name: /^Scroll: contract B/ }).press("Enter");
    await expect(page.getByTestId("pick-hint")).toHaveText(/Not yet: send the cross-contract order first/);
    await nextStep(page);
    // Picking the shop's scroll at the order step sends the order.
    await page.getByRole("button", { name: /^Scroll: contract B/ }).press("Enter");
    await state(page, /order:done;hops:3\/3/);
    await page.getByRole("button", { name: /^Receipt 2: buy/ }).press("Enter");
    await expect(page.getByTestId("pick-hint")).toContainText("buy on shop.demo.testnet");
  });

  test("the honest take names strengths and weaknesses against Ethereum", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await walkToCheck(page);
    await answerCheck(page, ANSWERS);
    await nextStep(page);
    const honest = page.getByRole("region", { name: "Honest take" });
    await expect(honest).toContainText("Ethereum");
    await expect(honest).toContainText(/reentrancy/);
    await expect(honest).toContainText(/Callbacks can starve/);
    await expect(honest).not.toContainText("30%");
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
    await nextStep(page);
    await sendOrder(page);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await state(page, /order:done;hops:3\/3/);
    await nextStep(page);
    await page.getByRole("button", { name: /^Gas meter: inspect/ }).press("Enter");
    await state(page, /gas:open/);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "2D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await state(page, /order:done;hops:3\/3;gas:open/);
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
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 3/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
    await page.getByRole("button", { name: "Send cross-contract order", exact: true }).click();
    await state(page, /order:done;hops:3\/3/);
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

  test("in 3D, picking the shop's scroll sends the order", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await page.getByRole("button", { name: /^Scroll: contract B/ }).press("Enter");
    await state(page, /order:done;hops:3\/3/);
  });
});
