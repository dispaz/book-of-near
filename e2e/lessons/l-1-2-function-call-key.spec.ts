import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, nextStep, seedRoute } from "./helpers";

// Walks lesson 1.2 in demo mode (no wallet, no network), in both views.
const ID = "l-1-2-function-call-key";
const TITLE = "A key that can do only one thing";
const STAGE = 1;

test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.locator("[data-scene-state]").first();

/** Presses one of the app's buttons: Count, or a misuse of its key. */
async function press(page: Page, name: string) {
  await page.getByRole("button", { name, exact: false }).first().click();
}

async function count(page: Page) {
  await page.getByRole("button", { name: "Count", exact: true }).click();
}

/** Opens the lesson at its first step, past the cover, and moves to step `n` with Next. */
async function openAt(page: Page, view: "2d" | "3d", n: number) {
  await page.goto(`/lesson/${ID}?view=${view}`);
  for (let i = 0; i < n; i++) await nextStep(page);
}

async function addKey(page: Page, allowance = "0.1") {
  await page.getByLabel("Allowance").fill(allowance);
  await page.getByRole("button", { name: "Give the app a key" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /key:active/, { timeout: 15_000 });
}

test.describe(`lesson ${ID}`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`is in the contents and walks to Finish in demo mode (${view})`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await page.goto(`/lesson/${ID}?view=${view}`);

      await nextStep(page); // hook → limited key
      await nextStep(page); // → add the key
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await addKey(page);
      await nextStep(page); // → allowed call
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await count(page);
      await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
      await nextStep(page); // → the hacked app
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await press(page, "Send NEAR to the attacker");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /refused:1/, { timeout: 15_000 });
      await press(page, "Call another contract");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /refused:2/, { timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await press(page, "Add a full-access key for the attacker");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /refused:3/, { timeout: 15_000 });
      await nextStep(page); // → delete
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await page.getByRole("button", { name: "Delete the app's key" }).click();
      await expect(scene(page)).toHaveAttribute("data-scene-state", /key:revoked/, { timeout: 15_000 });
      await page.getByRole("button", { name: "Count again" }).click();
      await expect(scene(page)).toHaveAttribute("data-scene-state", /gone:shown/, { timeout: 15_000 });
      await nextStep(page); // → check
      await answerCheck(page, [
        "Send NEAR to another account.",
        "Delete the key with a transaction signed by your full-access key.",
      ]);
      await nextStep(page); // → honest take
      await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
      await page.getByRole("button", { name: "Finish lesson" }).click();
      await expect(page.getByText("Lesson done")).toBeVisible();
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: {
          txHash: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/),
          addKeyTxHash: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/),
          refusedAttacks: "3",
          deletedKeyRefused: "yes",
        },
      });
    });
  }

  test("the chain refuses each attack with its reason, and the key's limits show", async ({ page }) => {
    await openAt(page, "2d", 2);
    await addKey(page, "0.2");
    await expect(page.getByTestId("key-card")).toContainText("0.2 NEAR");
    await expect(page.getByTestId("key-card")).toContainText("this account's counter contract");
    await expect(page.getByTestId("key-count")).toContainText("2");
    await nextStep(page);
    await count(page);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
    await expect(page.getByTestId("allowance-left")).not.toHaveText("0.2 NEAR");
    await nextStep(page);
    for (const p of MISUSES) {
      await press(page, p);
      await expect(page.getByTestId("attempt-log")).toContainText(p);
    }
    const log = page.getByTestId("attempt-log");
    await expect(log).toContainText("RequiresFullAccess");
    await expect(log).toContainText("ReceiverMismatch");
    await expect(log.getByText("Refused")).toHaveCount(3);
    // The learner's own allowance shows in later text.
    await nextStep(page);
    await expect(page.getByTestId("caption")).toContainText("0.2");
  });

  test("never calls the app an agent or an AI in the scene", async ({ page }) => {
    await openAt(page, "2d", 2);
    await addKey(page);
    await expect(page.getByTestId("key-scene")).not.toContainText(/agent|\bAI\b/i);
    await expect(page.getByTestId("app-says")).toBeVisible();
  });

  test("after the delete, a Count with the old key is refused because the key is gone", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await walkToCheck(page);
    await expect(page.getByTestId("attempt-log")).toContainText("AccessKeyNotFound");
    await expect(page.getByTestId("attempt-log")).toContainText("Count (deleted key)");
    await expect(page.getByTestId("key-count")).toContainText("1");
  });
});

const MISUSES = [
  "Send NEAR to the attacker",
  "Call another contract",
  "Add a full-access key for the attacker",
];

/** Steps 1 to 6 in the page's current view: give the key, count once, three misuses refused, delete it. */
async function walkToCheck(page: Page) {
  await nextStep(page);
  await nextStep(page);
  await addKey(page);
  await nextStep(page);
  await count(page);
  await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
  await nextStep(page);
  for (const [i, p] of MISUSES.entries()) {
    await press(page, p);
    await expect(scene(page)).toHaveAttribute("data-scene-state", new RegExp(`refused:${i + 1}`), {
      timeout: 15_000,
    });
  }
  await nextStep(page);
  await page.getByRole("button", { name: "Delete the app's key" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /key:revoked/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Count again" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /gone:shown/, { timeout: 15_000 });
}

test.describe(`lesson ${ID}: motion, fallback, switching, phones`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`works with reduced motion in the ${view} view`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await walkToCheck(page);
      await ctx.close();
    });

    test(`works on a phone-sized screen in the ${view} view`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      if (view === "3d") await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
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

  test("switching 2D to 3D and back in the middle keeps the progress", async ({ page }) => {
    await openAt(page, "2d", 2);
    await addKey(page, "0.2");
    await nextStep(page);
    await count(page);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
    const views = page.getByRole("group", { name: "Scene view" });
    await views.getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: 20_000 });
    await expect(scene(page)).toHaveAttribute("data-scene-state", /key:active;counter:1/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
    await nextStep(page);
    await press(page, MISUSES[0]!);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /refused:1/, { timeout: 15_000 });
    await views.getByRole("button", { name: "2D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /key:active;counter:1;refused:1/);
    await expect(page.getByTestId("attempt-log").getByText("Refused")).toHaveCount(1);
  });

  test("the learner's allowance and what is left fill the captions of steps 4 and 6", async ({ page }) => {
    await openAt(page, "2d", 2);
    await addKey(page, "0.3");
    await nextStep(page);
    await expect(page.getByTestId("caption")).toContainText("Watch the 0.3 NEAR allowance drop");
    await count(page);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
    const left = (await page.getByTestId("allowance-left").innerText()).replace(" NEAR", "");
    expect(left).not.toBe("0.3");
    await nextStep(page);
    for (const p of MISUSES) await press(page, p);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /refused:3/, { timeout: 15_000 });
    await nextStep(page);
    const caption = page.getByTestId("caption");
    await expect(caption).toContainText(`It still had ${left} NEAR of its 0.3 NEAR allowance`);
    await expect(caption).not.toContainText("{");
  });
});
