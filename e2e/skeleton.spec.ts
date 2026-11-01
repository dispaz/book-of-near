import { expect, test } from "@playwright/test";

test.describe("@smoke walking skeleton", () => {
  test("contents lists stage 0 and both placeholder lessons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Book of NEAR", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Hello, ledger/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Add a line/ })).toBeVisible();
  });

  test("stage bar walks through the placeholder lesson", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Hello, ledger/ }).click();
    const caption = page.getByTestId("caption");
    await expect(caption).toHaveText("A ledger is a list of who owns what.");
    await expect(page.getByRole("button", { name: "Previous step" })).toBeDisabled();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(caption).toHaveText(/Each new line/);
    await page.getByRole("button", { name: "Step 3" }).click();
    await expect(caption).toHaveText(/blockchain at heart/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
    await page.keyboard.press("ArrowLeft");
    await expect(caption).toHaveText(/Each new line/);
  });

  test("play advances on its own and stops at the end", async ({ page }) => {
    await page.clock.install();
    await page.goto("/lesson/placeholder-hello");
    await page.getByRole("button", { name: "Play" }).click();
    await page.clock.runFor(2300);
    await expect(page.getByTestId("caption")).toHaveText(/Each new line/);
    await page.clock.runFor(2300);
    await expect(page.getByTestId("caption")).toHaveText(/blockchain at heart/);
    await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
  });

  test("the step lives in the URL", async ({ page }) => {
    await page.goto("/lesson/placeholder-hello?step=2");
    await expect(page.getByTestId("caption")).toHaveText(/Each new line/);
  });

  test("menu opens and moves to another lesson", async ({ page }) => {
    await page.goto("/lesson/placeholder-hello");
    await page.getByRole("button", { name: "Lessons menu" }).click();
    await page.getByRole("dialog", { name: "Lessons" }).getByRole("link", { name: "Add a line" }).click();
    await expect(page.getByRole("heading", { name: "Add a line", level: 1 })).toBeVisible();
  });
});

test.describe("scene contract", () => {
  test("a gated step holds Next until the learner acts", async ({ page }) => {
    await page.goto("/lesson/placeholder-blocks?step=2");
    const next = page.getByRole("button", { name: "Next step" });
    await expect(next).toBeDisabled();
    await page.locator(".action-slot").getByRole("button", { name: "Add a line" }).click();
    await expect(page.locator("[data-scene-state]")).toHaveAttribute("data-scene-state", "lines:1");
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByTestId("caption")).toHaveText(/Well done/);
  });

  test("a scene error shows the text fallback with the captions", async ({ page }) => {
    await page.goto("/lesson/placeholder-blocks?scene-error=1");
    const fb = page.getByTestId("text-fallback");
    await expect(fb).toBeVisible();
    await expect(fb).toContainText("Here is an empty page of the ledger.");
    await expect(page.getByTestId("caption")).toHaveText(/empty page/);
  });

  test("reduced motion keeps play working and the text version present", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.clock.install();
    await page.goto("/lesson/placeholder-hello");
    await page.getByText("Read as text").click();
    await expect(page.locator(".read-as-text li")).toHaveCount(3);
    await page.getByRole("button", { name: "Play" }).click();
    await page.clock.runFor(2300);
    await expect(page.getByTestId("caption")).toHaveText(/Each new line/);
    await ctx.close();
  });

  test("no 3D code loads on the contents page or a 2D lesson", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
    });
    await page.goto("/");
    await page.goto("/lesson/placeholder-hello");
    await expect(page.getByTestId("caption")).toBeVisible();
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
  });
});
