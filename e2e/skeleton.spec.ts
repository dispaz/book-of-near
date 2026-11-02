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

test.describe("@smoke walking skeleton", () => {
  test("contents lists stage 0 and hides the developer placeholders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Book of NEAR", level: 1 })).toBeVisible();
    const contents = page.getByRole("navigation", { name: "Contents" });
    await expect(
      contents.getByRole("link", { name: /How a blockchain and a transaction work/ }),
    ).toBeVisible();
    await expect(contents.getByRole("link", { name: /Hello, ledger/ })).toHaveCount(0);
    await expect(contents.getByRole("link", { name: /Add a line/ })).toHaveCount(0);
  });

  test("stage bar walks through the placeholder lesson", async ({ page }) => {
    await page.goto("/lesson/placeholder-hello");
    const caption = page.getByTestId("caption");
    await expect(caption).toHaveText("A ledger is a list of who owns what.");
    await expect(page.getByRole("button", { name: "Previous step" })).toBeDisabled();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(caption).toHaveText(/Each new line/);
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(caption).toHaveText(/blockchain at heart/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
    await page.keyboard.press("ArrowLeft");
    await expect(caption).toHaveText(/Each new line/);
  });

  test("the bar holds only contents, the two arrows and the caption", async ({ page }) => {
    await page.goto("/lesson/placeholder-hello");
    const bar = page.getByRole("navigation", { name: "Lesson steps" });
    await expect(bar.getByRole("button")).toHaveCount(3);
    await expect(bar.getByRole("button", { name: "Contents" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Previous step" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Next step" })).toBeVisible();
    await expect(bar.getByTestId("caption")).toHaveText(/A ledger is a list/);
  });

  test("the step lives in the URL", async ({ page }) => {
    await page.goto("/lesson/placeholder-hello?step=2");
    await expect(page.getByTestId("caption")).toHaveText(/Each new line/);
  });

  test("menu opens and moves to another lesson", async ({ page }) => {
    await page.goto("/lesson/placeholder-hello");
    await page.getByRole("button", { name: "Contents" }).click();
    const menu = page.getByRole("dialog", { name: "Contents" });
    await expect(menu.getByRole("link", { name: "Add a line" })).toHaveCount(0);
    await menu.getByRole("link", { name: "How a blockchain and a transaction work" }).click();
    await expect(
      page.getByRole("heading", { name: "How a blockchain and a transaction work", level: 1 }),
    ).toBeVisible();
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

  test("reduced motion keeps the arrows working and the text version present", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/lesson/placeholder-hello");
    await page.getByText("Read as text").click();
    await expect(page.locator(".read-as-text li")).toHaveCount(3);
    await page.getByRole("button", { name: "Next step" }).click();
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
