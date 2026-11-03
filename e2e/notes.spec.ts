import { expect, test, type Page } from "@playwright/test";
import { seedRoute } from "./lessons/helpers";

// Step notes (StepNote): on wide screens a note sits in the left margin with an arrow to the thing it
// explains (the step's explainAt); on phones, or when the scene has no room beside it, it stays docked.
test.beforeEach(({ page }) => seedRoute(page));

const floating = (page: Page) => page.locator(".note.floating:not(.folded)");
const docked = (page: Page) => page.locator(".note.docked");

async function open(page: Page, lesson: string, view: "2d" | "3d", step = 1) {
  await page.goto(`/lesson/${lesson}?view=${view}&step=${step}`);
  if (view === "3d") await expect(page.locator(".sk-stage canvas").first()).toBeVisible();
}

const dock = (page: Page) => page.locator(".action-slot");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).first();

/** Each step's action in demo mode, so the next step opens (null: nothing to do). */
const LESSONS = {
  "l-0-2-make-a-wallet": [
    (p: Page) => p.getByRole("checkbox", { name: /these keys are for practice only/ }).check(),
    (p: Page) => button(p, "Generate").click(),
    (p: Page) => button(p, "Rebuild from words").click(),
    async (p: Page) => {
      await button(p, "Turn it into an address").click();
      await expect(p.getByTestId("implicit-account")).toBeVisible({ timeout: 10_000 });
    },
    async (p: Page) => {
      for (let i = 0; i < 3; i++)
        await p
          .getByRole("button", { name: /^Show the .* rule$/ })
          .first()
          .click();
    },
    (p: Page) => button(p, "Sign").click(),
    async (p: Page) => {
      await button(p, "Verify").click();
      await p.getByRole("textbox", { name: "Message to check" }).fill("Hellp from Book of NEAR");
      await button(p, "Verify").click();
    },
    (p: Page) => button(p, "Throw the keys away").click(),
  ],
  "l-0-3-send-a-transaction": [
    (p: Page) => expect(p.getByTestId("practice-balance")).toHaveText("5 NEAR"),
    (p: Page) => dock(p).getByRole("button", { name: "Build" }).click(),
    (p: Page) => dock(p).getByRole("button", { name: "Got it" }).click(),
    (p: Page) => dock(p).getByRole("button", { name: "Sign" }).click(),
    async (p: Page) => {
      await dock(p).getByRole("button", { name: "Send" }).click();
      await expect(p.getByTestId("pipeline").locator('[data-phase="final"]')).toHaveAttribute(
        "data-lit",
        "true",
        { timeout: 30_000 },
      );
    },
    null,
    null,
    (p: Page) => dock(p).getByRole("button", { name: "Open the demo explorer" }).click(),
  ],
} satisfies Record<string, (((page: Page) => Promise<unknown>) | null)[]>;

for (const view of ["2d", "3d"] as const) {
  for (const [lesson, steps] of Object.entries(LESSONS))
    test(`${lesson} (${view}): every step's note floats in the margin with an arrow`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, lesson, view);
      for (const [i, act] of steps.entries()) {
        // After the step's action, its note still points at its element (a missing target would dock).
        if (act) await act(page);
        await expect(floating(page), `step ${i + 1}`).toBeVisible();
        await expect(page.locator(".note-arrow"), `step ${i + 1}`).toBeVisible();
        await page.getByRole("button", { name: "Next step" }).click();
      }
    });

  test(`0.2 (${view}): the warning note points at the warning sign on wide screens`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "l-0-2-make-a-wallet", view);
    await expect(floating(page)).toBeVisible();
    await expect(floating(page)).toContainText("A seed phrase is a list of words");
    await expect(page.locator(".note-arrow")).toBeVisible();
    // The note stays in the left margin, clear of the picture.
    const box = (await floating(page).boundingBox())!;
    expect(box.x + box.width).toBeLessThan(440);
  });

  test(`0.3 (${view}): the first note points at your practice account`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "l-0-3-send-a-transaction", view);
    await expect(floating(page)).toContainText("Testnet is a copy of NEAR");
    await expect(page.locator(".note-arrow")).toBeVisible();
  });

  test(`0.2 (${view}): on a tablet the note stays docked, the picture has no room beside it`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, "l-0-2-make-a-wallet", view);
    await expect(docked(page)).toContainText("A seed phrase is a list of words");
    await expect(page.locator(".note-arrow")).toHaveCount(0);
  });

  test(`0.3 (${view}): on a phone the note stays docked`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "l-0-3-send-a-transaction", view);
    await expect(docked(page)).toContainText("Testnet is a copy of NEAR");
    await expect(page.locator(".note-arrow")).toHaveCount(0);
  });
}
