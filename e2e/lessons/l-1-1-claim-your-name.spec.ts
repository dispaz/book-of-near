import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, nextStep, seedRoute } from "./helpers";

// Walks lesson 1.1 in demo mode (no wallet, no network): a hex address, the idea of a name, pick a name
// with live availability, create it through the registrar, compare it with a hex account, check, honest take.
const ID = "l-1-1-claim-your-name";
const TITLE = "Claim your name";
const STAGE = 1;
const DEMO_ACCOUNT = "cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5";
const BASE58_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

test.beforeEach(({ page }) => seedRoute(page));

const dock = (page: Page) => page.locator(".action-slot");

async function expectView(page: Page, view: "2d" | "3d") {
  await expect(page.getByTestId("name-scene")).toHaveAttribute("data-view", view);
  await expect(page.locator(".stx-3d canvas")).toHaveCount(view === "3d" ? 1 : 0);
}

/** Picks a name, creates it and compares it. Leaves the lesson on the Check step. */
async function walk(page: Page, label: string) {
  const next = page.getByRole("button", { name: "Next step" });
  const feedback = page.getByTestId("name-feedback");

  // 1. Hook: the practice account's hex id.
  await expect(page.getByTestId("hex-id")).toHaveText(DEMO_ACCOUNT);
  await nextStep(page);
  // 2. Concept: the rules and the registrar.
  await expect(page.getByTestId("rules")).toContainText("2 to 64 characters");
  await nextStep(page);

  // 3. Pick a name: live feedback, Next stays locked until the name is valid and free.
  await expect(next).toBeDisabled();
  const input = page.getByRole("textbox", { name: "Account name" });
  await input.fill("Ana");
  await expect(feedback).toHaveText("Use lowercase letters only.");
  await input.fill("book-of-near");
  await expect(feedback).toHaveText("book-of-near.testnet is taken. Try another.");
  await expect(next).toBeDisabled();
  await input.fill(label);
  await expect(feedback).toHaveText(`${label}.testnet is free.`);
  await nextStep(page);

  // 4. Create it: one transaction through the registrar.
  await expect(next).toBeDisabled();
  await dock(page)
    .getByRole("button", { name: `Create ${label}.testnet` })
    .click();
  await expect(page.getByTestId("new-account-id")).toHaveText(`${label}.testnet`, { timeout: 30_000 });
  await expect(page.getByTestId("create-tx-hash")).toHaveText(BASE58_HASH);
  await expect(page.getByTestId("new-account-balance")).toHaveText("0.1 NEAR");
  await expect(page.getByTestId("new-account-key")).toContainText("ed25519:");
  await nextStep(page);

  // 5. Compare with a hex account made from the same key.
  await expect(page.getByTestId("compare-named")).toContainText(`${label}.testnet`);
  await expect(page.getByTestId("compare-named")).toContainText("exists");
  await expect(page.getByTestId("compare-hex")).toContainText(/[0-9a-f]{64}/);
  await expect(page.getByTestId("compare-hex")).toContainText("not created");
  await nextStep(page);
}

test.describe(`lesson ${ID}`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`walks to Finish in demo mode (${view}) and the record carries the account id`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await page.goto(`/lesson/${ID}?view=${view}`);
      const label = `ana-${view}`;
      await expectView(page, view);

      await walk(page, label);
      await answerCheck(page, [
        "The address of an account: a name or a hex string.",
        "A transaction asked the testnet registrar contract to create it and fund it.",
        "ana-1.testnet",
      ]);
      await nextStep(page);
      await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
      await page.getByRole("button", { name: "Finish lesson" }).click();
      await expect(page.getByText("Lesson done")).toBeVisible();
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: { accountId: `${label}.testnet`, txHash: expect.stringMatching(BASE58_HASH) },
      });
    });
  }

  test("the learner's own name appears in later text, and survives a view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await nextStep(page);
    await page.getByRole("textbox", { name: "Account name" }).fill("zed-writes");
    await expect(page.getByTestId("name-feedback")).toHaveText("zed-writes.testnet is free.");
    await nextStep(page);
    await expect(dock(page).getByRole("button", { name: "Create zed-writes.testnet" })).toBeVisible();
    await expect(page.getByTestId("caption")).toContainText("zed-writes.testnet");
    await dock(page).getByRole("button", { name: "Create zed-writes.testnet" }).click();
    await expect(page.getByTestId("new-account-id")).toHaveText("zed-writes.testnet", { timeout: 30_000 });
    // Switch to 3D mid-lesson: the created account is still there.
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expect(page.getByTestId("new-account-id")).toHaveText("zed-writes.testnet");
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });

  test("a second create is blocked once the account exists and the scene shows the outcome", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await nextStep(page);
    await page.getByRole("textbox", { name: "Account name" }).fill("outcome-check");
    await nextStep(page);
    await dock(page).getByRole("button", { name: "Create outcome-check.testnet" }).click();
    await expect(page.getByTestId("name-scene")).toHaveAttribute("data-scene-state", /created:yes/, {
      timeout: 30_000,
    });
    await expect(dock(page).getByRole("button", { name: /Created/ })).toBeDisabled();
  });
});
