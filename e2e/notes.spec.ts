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

for (const view of ["2d", "3d"] as const) {
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
