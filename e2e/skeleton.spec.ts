import { expect, test } from "@playwright/test";

// A returning visitor with a route sees the contents at "/" (new visitors get the opening quiz).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("bon:v1")) {
      localStorage.setItem(
        "bon:v1",
        JSON.stringify({ v: 1, route: "newcomer", completions: [], evidence: {} }),
      );
    }
  });
});

const LESSON = "/lesson/l-0-1-blockchain-basics";
const FIRST = /^Ana, Ben and Cora keep one notebook/;
const SECOND = /^Send 3 coins from Ana to Ben/;

test.describe("@smoke walking skeleton", () => {
  test("contents lists the stage 0 lessons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Book of NEAR", level: 1 })).toBeVisible();
    const contents = page.getByRole("navigation", { name: "Contents" });
    for (const title of [
      "How a blockchain and a transaction work",
      "Make a wallet",
      "Send a transaction and watch it",
    ])
      await expect(contents.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await expect(contents.getByRole("link", { name: /Scene kit demo/ })).toHaveCount(0);
  });

  test("the stage bar walks a lesson: gate, next, back, keyboard, last step", async ({ page }) => {
    await page.goto(`${LESSON}?view=2d`);
    const caption = page.getByTestId("caption");
    const next = page.getByRole("button", { name: "Next step" });
    await expect(caption).toHaveText(FIRST);
    await expect(page.getByRole("button", { name: "Previous step" })).toBeDisabled();
    await expect(next).toBeDisabled();
    await page.getByRole("button", { name: "Open Ben's notebook" }).click();
    await next.click();
    await expect(caption).toHaveText(SECOND);
    await page.keyboard.press("ArrowLeft");
    await expect(caption).toHaveText(FIRST);
    await page.goto(`${LESSON}?view=2d&step=9`);
    await expect(caption).toHaveText(/^Honest take/);
    await expect(next).toBeDisabled();
  });

  test("the bar holds only contents, the two arrows and the caption", async ({ page }) => {
    await page.goto(`${LESSON}?view=2d`);
    const bar = page.getByRole("navigation", { name: "Lesson steps" });
    await expect(bar.getByRole("button")).toHaveCount(3);
    await expect(bar.getByRole("button", { name: "Contents" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Previous step" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Next step" })).toBeVisible();
    await expect(bar.getByTestId("caption")).toHaveText(FIRST);
  });

  test("the step lives in the URL", async ({ page }) => {
    await page.goto(`${LESSON}?view=2d&step=2`);
    await expect(page.getByTestId("caption")).toHaveText(SECOND);
  });

  test("menu opens and moves to another lesson", async ({ page }) => {
    await page.goto(`${LESSON}?view=2d`);
    await page.getByRole("button", { name: "Contents" }).click();
    const menu = page.getByRole("dialog", { name: "Contents" });
    await menu.getByRole("link", { name: "Make a wallet" }).click();
    await expect(page.getByRole("heading", { name: "Make a wallet", level: 1 })).toBeVisible();
  });
});

test.describe("scene contract", () => {
  test("a scene that fails to load shows the text version with the captions", async ({ page }) => {
    // Break the lazy scene chunks: the lesson must still teach, as text.
    await page.route(/\/assets\/Scene[^/]*\.js$/, (r) => r.abort());
    await page.goto(`${LESSON}?view=2d`);
    const fb = page.getByTestId("text-fallback");
    await expect(fb).toBeVisible();
    await expect(fb).toContainText("Ana, Ben and Cora keep one notebook");
    await expect(page.getByTestId("caption")).toHaveText(FIRST);
  });

  test("reduced motion keeps the arrows working and the text version present", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${LESSON}?view=2d&step=2`);
    await page.getByText("Read as text").click();
    await expect(page.locator(".read-as-text li")).toHaveCount(9);
    await page.getByRole("button", { name: "Previous step" }).click();
    await expect(page.getByTestId("caption")).toHaveText(FIRST);
    await ctx.close();
  });

  test("no 3D code loads on the contents page or a lesson in 2D", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
    });
    await page.goto("/");
    await page.goto(`${LESSON}?view=2d`);
    await expect(page.getByTestId("caption")).toBeVisible();
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
  });
});
