import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { LOAD_3D, answerCheck, completionOf, nextStep, seedRoute, slow3d } from "./helpers";

// Walks lesson 3.1 in demo mode (no wallet, no network), in both views.
const ID = "l-3-1-deploy-a-contract";
const TITLE = "Deploy a contract in one click";
const STAGE = 3;
const T = { timeout: 15_000 };

// Five realtime transactions (each about 3 s in demo mode) plus page turns: give each walk room.
// This is transaction time, not 3D load; 3D tests also use the shared LOAD_3D / slow3d().
test.describe.configure({ timeout: 90_000 });
test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.getByTestId("deploy-scene");
const state = (page: Page, re: RegExp) => expect(scene(page)).toHaveAttribute("data-scene-state", re, T);
const next = (page: Page) => page.getByRole("button", { name: "Next step" });

async function deploy(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Deploy counter contract", exact: true }).click();
  await state(page, /deployed:yes/);
}

async function incrementAndRead(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Increment", exact: true }).click();
  await state(page, /count:1;/);
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Read the count", exact: true }).click();
  await state(page, /read:1;/);
}

async function failWithCallback(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Call fail with a callback", exact: true }).click();
  await state(page, /callback:failed/);
}

async function clearState(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Reset and clear state", exact: true }).click();
  await state(page, /cleared:yes/);
}

/** Steps 1 to 6 in the page's current view: deploy, count, the failing callback, the reset. */
async function walkToCheck(page: Page) {
  await nextStep(page); // hook → the Wasm
  await nextStep(page); // → deploy
  await deploy(page);
  await nextStep(page); // → call and read
  await incrementAndRead(page);
  await nextStep(page); // → the failing callback
  await failWithCallback(page);
  await nextStep(page); // → clear
  await clearState(page);
  await nextStep(page); // → check
}

const ANSWERS = [
  "By locking a refundable deposit of 1 NEAR per 100 KB of data stored.",
  "It is unlocked and returned to your available balance.",
  "Standard WebAssembly (Wasm).",
];

test.describe(`lesson ${ID}`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`is in the contents and walks to Finish in demo mode (${view})`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await page.goto(`/lesson/${ID}?view=${view}`);
      await walkToCheck(page);
      await answerCheck(page, ANSWERS);
      await nextStep(page); // → honest take
      await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
      await page.getByRole("button", { name: "Finish lesson" }).click();
      await expect(page.getByText("Lesson done")).toBeVisible();
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: {
          txHash: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/),
          contractId: expect.stringMatching(/^counter\.bon-[a-z0-9]{8}\.testnet$/),
        },
      });
    });
  }

  test("the real Wasm is inspected, deployed, called, read, failed through a callback and cleared", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    const facts = page.getByTestId("contract-facts");
    await expect(facts).toContainText("00 61 73 6d 01 00 00 00");
    await expect(facts).toContainText(/2,\d{3} bytes/);
    await expect(facts).toContainText("increment");
    await expect(page.getByTestId("caption")).toContainText(/counter\.bon-[a-z0-9]{8}\.testnet/);

    await nextStep(page);
    await deploy(page);
    // The storage deposit comes from the chain: about 0.02 NEAR for ~2.3 KB.
    await expect(page.getByTestId("storage-locked")).toContainText(/^0\.02\d* NEAR/);
    await expect(page.getByTestId("caption")).toContainText(/0\.02\d* NEAR lock/);
    const lockedAtDeploy = await page.getByTestId("storage-bytes").textContent();

    await nextStep(page);
    await incrementAndRead(page);
    await expect(page.getByTestId("count-read")).toHaveText("1");
    // The new record made storage grow.
    await expect(page.getByTestId("storage-bytes")).not.toHaveText(lockedAtDeploy!);

    await nextStep(page);
    await failWithCallback(page);
    const receipts = page.getByTestId("callback-receipts");
    await expect(receipts).toContainText("call_other");
    await expect(receipts).toContainText("This method always fails");
    await expect(receipts).toContainText("on_other_done");
    // The failed call still burnt gas.
    await expect(receipts.locator("li.failed")).toContainText(/[0-9.]+ Tgas burnt/);
    await expect(page.getByTestId("last-result")).toHaveText("failed");
    // The failed call changed nothing: the count is still 1.
    await expect(page.getByTestId("count-read")).toHaveText("1");
    await state(page, /count:1;/);

    await nextStep(page);
    await clearState(page);
    await expect(page.getByTestId("count-read")).toHaveText("0");
    await expect(page.getByTestId("storage-bytes")).toHaveText(lockedAtDeploy!);
    await expect(page.getByTestId("refund")).toContainText(/0\.00\d+ NEAR/);
    await expect(page.getByTestId("caption")).toContainText(/0\.00\d+ NEAR is available again/);
  });

  test("the honest take names strengths and weaknesses against Ethereum", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await walkToCheck(page);
    await answerCheck(page, ANSWERS);
    await nextStep(page);
    const honest = page.getByRole("region", { name: "Honest take" });
    await expect(honest).toContainText("Ethereum");
    await expect(honest).toContainText(/proxy/);
    await expect(honest).toContainText(/2 NEAR/);
  });
});

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
      if (view === "3d") await expect(page.locator("canvas").first()).toBeVisible({ timeout: LOAD_3D });
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
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    await nextStep(page);
    await deploy(page);
    await nextStep(page);
    await page.getByRole("button", { name: "Increment", exact: true }).click();
    await state(page, /count:1;/);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
    await state(page, /deployed:yes;count:1;/);
    await page.getByRole("button", { name: "Read the count", exact: true }).click();
    await state(page, /read:1;/);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "2D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await state(page, /deployed:yes;count:1;read:1;/);
    await expect(next(page)).toBeEnabled();
  });

  // Pick buttons follow their 3D object; keyboard picking (Enter) is what screen readers and tests use.
  test("in 3D, picking the objects runs the step's actions", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=3d`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await nextStep(page);
    await nextStep(page);
    await page.getByRole("button", { name: /^Sub-mailbox: deploy/ }).press("Enter");
    await state(page, /deployed:yes/);
    await nextStep(page);
    await page.getByRole("button", { name: /^Scroll: increment/ }).press("Enter");
    await state(page, /count:1;/);
    await page.getByRole("button", { name: /^Balance gauge: read/ }).press("Enter");
    await state(page, /read:1;/);
  });
});

test.describe(`lesson ${ID}: 3D book scene`, () => {
  test.beforeEach(() => slow3d());

  test("wide screens print the step on the left page; the tour moves the camera and docks the words", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=2`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
    await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 2/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 2/);
    // While the tour runs, the words go back to their docked place: still readable.
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    // A new step ends the tour and prints the words again; the printed action still works.
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 3/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
    await page.getByRole("button", { name: "Deploy counter contract", exact: true }).click();
    await state(page, /deployed:yes/);
    await ctx.close();
  });

  test("phones keep the step's words docked, not printed on the page", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=2`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.locator(".book-page")).toHaveCSS("display", "contents");
    await ctx.close();
  });
});

// Opt-in: needs the real testnet. TESTNET=1 TESTNET_STORE=/path/outside/repo.json npx playwright test --grep @testnet
// TESTNET_STORE holds a saved throwaway practice key (see src/chain/testnet/testnet.test.ts). A named practice
// account keeps its counter between runs, so a second run finds it deployed and walks on from there.
// Use --workers=1: tests that share one practice key must not send at the same time (nonces clash).
test("@testnet deploys the real counter, fails with a callback and resets", async ({ page }) => {
  test.skip(!process.env.TESTNET, "set TESTNET=1 to run against the real testnet");
  test.setTimeout(300_000);
  const L = { timeout: 90_000 };
  const live = (re: RegExp) => expect(scene(page)).toHaveAttribute("data-scene-state", re, L);
  const storePath = process.env.TESTNET_STORE;
  if (storePath && existsSync(storePath)) {
    const saved = readFileSync(storePath, "utf8");
    await page.addInitScript((v) => localStorage.setItem("bon:testnet-practice-account:v1", v), saved);
  }
  await page.goto(`/lesson/${ID}?mode=testnet&view=2d`);
  await expect(page.getByTestId("mode-pill")).toHaveText("Testnet", L);
  await live(/network:testnet/);
  await nextStep(page);
  await nextStep(page); // → deploy
  if (!/deployed:yes/.test((await scene(page).getAttribute("data-scene-state")) ?? "")) {
    await page.getByRole("button", { name: "Deploy counter contract", exact: true }).click();
    await live(/deployed:yes/);
  }
  await expect(page.getByTestId("storage-bytes")).toHaveText(/^\d{1,3}(,\d{3})* bytes$/, L);
  console.log(`[3.1 testnet] at deploy: ${await page.getByTestId("storage-bytes").textContent()}`);
  await nextStep(page); // → call and read
  await page.getByRole("button", { name: "Increment", exact: true }).click();
  await live(/busy:no/);
  await page.getByRole("button", { name: "Read the count", exact: true }).click();
  await expect(next(page)).toBeEnabled(L);
  await nextStep(page); // → the failing callback
  await page.getByRole("button", { name: "Call fail with a callback", exact: true }).click();
  await live(/callback:failed/);
  const receipts = page.getByTestId("callback-receipts").locator("li");
  await expect(receipts).toHaveCount(3);
  await expect(receipts.nth(0)).toContainText("call_other");
  await expect(receipts.nth(1)).toContainText("fail");
  await expect(receipts.nth(2)).toContainText("on_other_done");
  await expect(page.getByTestId("last-result")).toHaveText("failed");
  await nextStep(page); // → clear
  await page.getByRole("button", { name: "Reset and clear state", exact: true }).click();
  await live(/cleared:yes/);
  await expect(page.getByTestId("refund")).toContainText("NEAR");
  console.log(`[3.1 testnet] refund: ${await page.getByTestId("refund").textContent()}`);
  await expect(page.getByTestId("count-read")).toHaveText("0");
  await nextStep(page); // → check
  await answerCheck(page, ANSWERS);
  await nextStep(page); // → honest take
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
  const record = await completionOf(page, ID);
  expect(record).toMatchObject({
    mode: "testnet",
    evidence: {
      contractId: expect.stringMatching(/^counter\.[a-z0-9-]+\.testnet$/),
      callbackTxHash: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/),
    },
  });
  console.log(`[3.1 testnet] evidence: ${JSON.stringify(record)}`);
});
