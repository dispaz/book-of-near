import { expect, test, type Page } from "@playwright/test";

// The contents is the book's first spread; picking a lesson turns the pages to it. The cover is left on
// (the config turns it off for other tests) to show that a page turn opens the lesson at its first page.
test.use({ storageState: { cookies: [], origins: [] } });

const NEWCOMER = { v: 1, route: "newcomer", completions: [], evidence: {} };

async function openContents(page: Page, state: object = NEWCOMER) {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("bon:v1")) localStorage.setItem("bon:v1", JSON.stringify(s));
  }, state);
  await page.goto("/");
}

test.describe("the contents book", () => {
  test("shows the title page and the contents as a spread", async ({ page }) => {
    await openContents(page);
    const book = page.locator("main.contents-book");
    await expect(book.getByRole("heading", { name: "Book of NEAR", level: 1 })).toBeVisible();
    const contents = page.getByRole("navigation", { name: "Contents" });
    await expect(contents.getByRole("heading", { name: "Contents" })).toBeVisible();
    await expect(
      contents.getByRole("link", { name: /How a blockchain and a transaction work.*pages/ }),
    ).toBeVisible();
    // Wide screens: the title page and the contents sit side by side.
    const left = await book.locator(".book-leaf.left").boundingBox();
    const right = await book.locator(".book-leaf.right").boundingBox();
    expect(right!.x).toBeGreaterThan(left!.x + left!.width - 2);
  });

  test("picking a lesson turns the pages and opens its first page, past the cover", async ({ page }) => {
    await openContents(page);
    await page
      .getByRole("navigation", { name: "Contents" })
      .getByRole("link", { name: /Make a wallet/ })
      .click();
    const turn = page.getByTestId("page-turn");
    await expect(turn).toBeVisible();
    await expect(turn).toContainText("Lesson 0.2");
    await expect(page).toHaveURL(/\/lesson\/l-0-2-make-a-wallet/);
    await expect(page.getByTestId("book-cover")).toHaveCount(0);
    await expect(page.getByText(/Step 1 of/)).toBeVisible();
  });

  test("picking a stage opens its first unread lesson", async ({ page }) => {
    const read = {
      lessonId: "l-1-1-claim-your-name",
      stage: 1,
      route: "newcomer",
      mode: "demo",
      completedAt: "2026-11-13T00:00:00.000Z",
    };
    await openContents(page, { ...NEWCOMER, completions: [read] });
    await page.getByRole("link", { name: "Named: First steps on NEAR" }).click();
    await expect(page).toHaveURL(/\/lesson\/l-1-2-function-call-key/);
    await expect(page.getByTestId("book-cover")).toHaveCount(0);
  });

  test("with reduced motion the lesson opens without the page turn", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openContents(page);
    await page
      .getByRole("navigation", { name: "Contents" })
      .getByRole("link", { name: /Make a wallet/ })
      .click();
    await expect(page).toHaveURL(/\/lesson\/l-0-2-make-a-wallet/);
    await expect(page.getByTestId("page-turn")).toHaveCount(0);
    await expect(page.getByTestId("book-cover")).toHaveCount(0);
  });

  test("a lesson opened by its address still starts closed", async ({ page }) => {
    await page.goto("/lesson/l-0-2-make-a-wallet");
    await expect(page.getByTestId("book-cover")).toBeVisible();
  });

  test("on a phone the contents is one page that scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openContents(page);
    const stage7 = page.getByRole("link", { name: /Trace one intent end to end/ });
    await stage7.scrollIntoViewIfNeeded();
    await expect(stage7).toBeInViewport();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
});
