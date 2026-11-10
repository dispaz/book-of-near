import { expect, test, type Page } from "@playwright/test";

type Record = { lessonId: string; stage: number; route: string; mode: string; testedOut?: boolean };

const records = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __bookOfNear?: { progress?: { completions(): Record[] } } };
    return w.__bookOfNear?.progress?.completions() ?? [];
  });

async function seedRoute(page: Page, route: string) {
  await page.addInitScript((r) => {
    if (!localStorage.getItem("bon:v1")) {
      localStorage.setItem("bon:v1", JSON.stringify({ v: 1, route: r, completions: [], evidence: {} }));
    }
  }, route);
}

test.describe("@smoke opening quiz", () => {
  test("a new visitor takes the quiz and starts the newcomer path at stage 0", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Where should you start/ })).toBeVisible();
    await page.getByRole("radio", { name: "Never" }).check();
    await page.getByRole("radio", { name: "No, not yet" }).check();
    await page.getByRole("radio", { name: "I don't write code" }).check();
    await page.getByRole("button", { name: "Show my path" }).click();
    await expect(page.getByRole("heading", { name: "Newcomer path" })).toBeVisible();
    await page.getByRole("link", { name: "Start stage 0" }).click();
    await expect(page).toHaveURL(/\/lesson\/l-0-1-blockchain-basics/);
  });

  test("skipping the quiz picks the newcomer path", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Skip the quiz" }).click();
    await expect(page.getByRole("heading", { name: "Book of NEAR", level: 1 })).toBeVisible();
    await expect(page.getByText("Your path: Newcomer")).toBeVisible();
  });

  test("a developer path includes the builder stage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "Never" }).check();
    await page.getByRole("radio", { name: "No, not yet" }).check();
    await page.getByRole("radio", { name: "Yes, smart contracts too" }).check();
    await page.getByRole("button", { name: "Show my path" }).click();
    await expect(page.getByRole("heading", { name: "Developer path" })).toBeVisible();
    await page.getByRole("link", { name: "See the contents" }).click();
    const stage3 = page.getByRole("region", { name: /Wasm/ });
    await expect(stage3).not.toContainText("Optional for your path");
  });

  test("the path can be changed from the contents page", async ({ page }) => {
    await seedRoute(page, "newcomer");
    await page.goto("/");
    await expect(page.getByRole("region", { name: /Wasm/ })).toContainText("Optional for your path");
    await page.getByRole("link", { name: "Change my path" }).click();
    await expect(page.getByRole("heading", { name: /Where should you start/ })).toBeVisible();
  });
});

test.describe("contents and progress", () => {
  test("planned lessons show as locked cards with their stage", async ({ page }) => {
    await seedRoute(page, "newcomer");
    await page.goto("/");
    const stage2 = page.getByRole("region", { name: /Stage 2/ });
    const locked = stage2.locator(".lesson-chip.locked", { hasText: "A call that takes several blocks" });
    await expect(locked).toBeVisible();
    await expect(locked).toContainText("Coming soon");
    await expect(stage2.getByRole("link", { name: /A call that takes several blocks/ })).toHaveCount(0);
    for (const n of [0, 1, 2, 3, 4, 7]) {
      await expect(page.getByRole("region", { name: new RegExp(`Stage ${n}`) })).toBeVisible();
    }
  });

  test("finishing a lesson emits a completion record", async ({ page }) => {
    await seedRoute(page, "newcomer");
    await page.goto("/lesson/l-0-1-blockchain-basics?view=2d&step=9");
    await page.getByRole("button", { name: "Finish lesson" }).click();
    await expect(page.getByText("Lesson done")).toBeVisible();
    const rs = await records(page);
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({
      lessonId: "l-0-1-blockchain-basics",
      stage: 0,
      route: "newcomer",
      mode: "demo",
    });
    expect(Date.parse((rs[0] as unknown as { completedAt: string }).completedAt)).not.toBeNaN();
    await page.getByRole("link", { name: "Back to contents" }).click();
    await expect(
      page.getByRole("link", { name: /How a blockchain and a transaction work.*done/ }),
    ).toBeVisible();
  });

  test("Finish shows only on the last step", async ({ page }) => {
    await seedRoute(page, "newcomer");
    await page.goto("/lesson/l-0-1-blockchain-basics?view=2d&step=1");
    await expect(page.getByRole("button", { name: "Finish lesson" })).toHaveCount(0);
  });

  test("a returning visitor resumes where they stopped", async ({ page }) => {
    await seedRoute(page, "newcomer");
    // Not about 3D: keep the lesson in 2D (the resume link carries only the step).
    await page.addInitScript(() => localStorage.setItem("bon:view", "2d"));
    await page.goto("/lesson/l-0-1-blockchain-basics?step=2");
    await expect(page.getByTestId("caption")).toHaveText(/Send 3 coins/);
    await page.goto("/");
    await page.getByRole("link", { name: /Continue where you left off/ }).click();
    await expect(page).toHaveURL(/\/lesson\/l-0-1-blockchain-basics\?step=2/);
    await expect(page.getByTestId("caption")).toHaveText(/Send 3 coins/);
  });
});

test.describe("veteran test-out", () => {
  test("a veteran tests out of stage 0 and the records are marked tested out", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "Often" }).check();
    await page.getByRole("radio", { name: "Yes, many times" }).check();
    await page.getByRole("radio", { name: "I don't write code" }).check();
    await page.getByRole("button", { name: "Show my path" }).click();
    await expect(page.getByRole("heading", { name: "Veteran path" })).toBeVisible();
    await page.getByRole("link", { name: "Take the stage 0 test" }).click();

    const answers = [
      /next block still stores the old hash/,
      /Close the page/,
      /Verification fails/,
      /passes your signed transaction/,
      /cannot be sent again/,
    ];
    for (const a of answers) await page.getByRole("radio", { name: a }).check();
    await page.getByRole("button", { name: "Check my answers" }).click();
    await expect(page.getByRole("heading", { name: /You tested out of stage 0/ })).toBeVisible();

    const rs = await records(page);
    const stage0 = rs.filter((r) => r.stage === 0);
    expect(stage0.length).toBeGreaterThanOrEqual(3);
    expect(stage0.every((r) => r.testedOut === true && r.route === "veteran")).toBe(true);
    expect(stage0.map((r) => r.lessonId)).toContain("l-0-1-blockchain-basics");
    // Hidden developer lessons (the scene kit demo) are never marked done.
    expect(stage0.map((r) => r.lessonId)).not.toContain("scene-kit-demo");
  });

  test("a failed test keeps stage 0 open and records nothing", async ({ page }) => {
    await seedRoute(page, "veteran");
    await page.goto("/test-out");
    await page.getByRole("button", { name: "Check my answers" }).click();
    await expect(page.getByRole("heading", { name: /Start with stage 0/ })).toBeVisible();
    expect(await records(page)).toHaveLength(0);
  });
});
