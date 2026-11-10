import { expect, test } from "@playwright/test";
import { LOAD_3D, slow3d } from "./lessons/helpers";

const LESSON = "/lesson/l-0-1-blockchain-basics";

// These tests start with the cover on (the config turns it off for every other test).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("the lesson book", () => {
  test("a lesson starts as a closed book; opening it shows the first page", async ({ page }) => {
    await page.goto(`${LESSON}?view=2d`);
    const cover = page.getByTestId("book-cover");
    await expect(cover).toBeVisible();
    await expect(
      cover.getByRole("heading", { name: "How a blockchain and a transaction work" }),
    ).toBeVisible();
    await expect(cover).toContainText("Lesson 0.1");
    // The page behind is inert while the book is closed.
    await expect(page.getByRole("navigation", { name: "Lesson steps", includeHidden: true })).toHaveAttribute(
      "inert",
      "",
    );
    await page.getByRole("button", { name: "Open the book" }).click();
    await expect(cover).toHaveCount(0);
    await expect(page.getByTestId("caption")).toHaveText(/^Ana, Ben and Cora keep one notebook/);
    await expect(page.getByRole("button", { name: "Open Ben's notebook" })).toBeVisible();
  });

  test("in 3D the page shows in 2D first, then the 3D scene grows out of it", async ({ page }) => {
    slow3d();
    await page.goto(`${LESSON}?view=3d`);
    await page.getByRole("button", { name: "Open the book" }).click();
    const scene = page.getByTestId("ledger-scene");
    await expect(scene).toHaveAttribute("data-view", "2d");
    await expect(scene).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
  });

  test("opening a later step by URL skips the cover", async ({ page }) => {
    await page.goto(`${LESSON}?view=2d&step=3`);
    await expect(page.getByTestId("book-cover")).toHaveCount(0);
    await expect(page.getByTestId("caption")).toHaveText(/^Transactions are packed into a block/);
  });

  test("with reduced motion the cover still opens", async ({ browser }) => {
    const ctx = await browser.newContext({
      reducedMotion: "reduce",
      storageState: { cookies: [], origins: [] },
    });
    const page = await ctx.newPage();
    await page.goto(`${LESSON}?view=2d`);
    await page.getByRole("button", { name: "Open the book" }).press("Enter");
    await expect(page.getByTestId("book-cover")).toHaveCount(0);
    await ctx.close();
  });
});
