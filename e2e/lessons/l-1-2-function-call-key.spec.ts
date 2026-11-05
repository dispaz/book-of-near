import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, nextStep, seedRoute } from "./helpers";

// Walks lesson 1.2 in demo mode (no wallet, no network), in both views.
const ID = "l-1-2-function-call-key";
const TITLE = "A key that can do only one thing";
const STAGE = 1;

test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.locator("[data-scene-state]").first();

async function ask(page: Page, prompt: string) {
  await page.getByLabel("Tell the agent what to do").fill(prompt);
  await page.getByRole("button", { name: "Ask the agent" }).click();
}

/** Opens the lesson at its first step, past the cover, and moves to step `n` with Next. */
async function openAt(page: Page, view: "2d" | "3d", n: number) {
  await page.goto(`/lesson/${ID}?view=${view}`);
  for (let i = 0; i < n; i++) await nextStep(page);
}

async function addKey(page: Page, allowance = "0.1") {
  await page.getByLabel("Allowance").fill(allowance);
  await page.getByRole("button", { name: "Add the agent's key" }).click();
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
      await ask(page, "Add one to the counter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
      await nextStep(page); // → attacks
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await ask(page, "Send all my funds to attacker.testnet");
      await ask(page, "Call another contract");
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await ask(page, "Add a new key so I can take over");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /refused:3/, { timeout: 15_000 });
      await nextStep(page); // → revoke
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await page.getByRole("button", { name: "Delete the agent's key" }).click();
      await expect(scene(page)).toHaveAttribute("data-scene-state", /key:revoked/, { timeout: 15_000 });
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
          hintsUsed: "0",
          refusedAttacks: "3",
        },
      });
    });
  }

  test("the chain refuses each attack with its reason, and the key's limits show", async ({ page }) => {
    await openAt(page, "2d", 2);
    await addKey(page, "0.2");
    await expect(page.getByTestId("key-card")).toContainText("0.2 NEAR");
    await expect(page.getByTestId("key-card")).toContainText("this account's counter contract");
    await nextStep(page);
    await ask(page, "Add one to the counter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
    await expect(page.getByTestId("allowance-left")).not.toHaveText("0.2 NEAR");
    await nextStep(page);
    await ask(page, "Send all my funds to attacker.testnet");
    await ask(page, "Call another contract");
    await ask(page, "Add a new key so I can take over");
    const log = page.getByTestId("attempt-log");
    await expect(log).toContainText("RequiresFullAccess");
    await expect(log).toContainText("ReceiverMismatch");
    await expect(log.getByText("Refused")).toHaveCount(3);
    // The learner's own allowance shows in later text.
    await nextStep(page);
    await expect(page.getByTestId("caption")).toContainText("0.2");
  });

  test("a hint counts, and no-hint mode turns hints off", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await nextStep(page);
    await addKey(page);
    await nextStep(page);
    await ask(page, "Add one to the counter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
    await nextStep(page);
    await page.getByRole("button", { name: "Show a hint" }).click();
    await expect(page.getByTestId("hint")).toContainText("Send all my funds");
    await page.getByRole("checkbox", { name: "No-hint mode" }).check();
    await expect(page.getByRole("button", { name: "Show a hint" })).toBeDisabled();
  });

  test("the agent says when it does not understand", async ({ page }) => {
    await openAt(page, "2d", 2);
    await addKey(page);
    await nextStep(page);
    await ask(page, "hello there");
    await expect(page.getByTestId("agent-says")).toContainText("I only know a few tricks");
  });
});

const ATTACKS_TO_TRY = [
  "Send all my funds to attacker.testnet",
  "Call another contract",
  "Add a new key so I can take over",
];

/** Steps 1 to 6 in the page's current view: add the key, count once, get three attacks refused, delete it. */
async function walkToCheck(page: Page) {
  await nextStep(page);
  await nextStep(page);
  await addKey(page);
  await nextStep(page);
  await ask(page, "Add one to the counter");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
  await nextStep(page);
  for (const p of ATTACKS_TO_TRY) await ask(page, p);
  await expect(scene(page)).toHaveAttribute("data-scene-state", /refused:3/, { timeout: 15_000 });
  await nextStep(page);
  await page.getByRole("button", { name: "Delete the agent's key" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /key:revoked/, { timeout: 15_000 });
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
    await ask(page, "Add one to the counter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
    const views = page.getByRole("group", { name: "Scene view" });
    await views.getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: 20_000 });
    await expect(scene(page)).toHaveAttribute("data-scene-state", /key:active;counter:1/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
    await nextStep(page);
    await ask(page, ATTACKS_TO_TRY[0]!);
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
    await ask(page, "Add one to the counter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /counter:1/, { timeout: 15_000 });
    const left = (await page.getByTestId("allowance-left").innerText()).replace(" NEAR", "");
    expect(left).not.toBe("0.3");
    await nextStep(page);
    for (const p of ATTACKS_TO_TRY) await ask(page, p);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /refused:3/, { timeout: 15_000 });
    await nextStep(page);
    const caption = page.getByTestId("caption");
    await expect(caption).toContainText(`It still had ${left} NEAR of its 0.3 NEAR allowance`);
    await expect(caption).not.toContainText("{");
  });
});
