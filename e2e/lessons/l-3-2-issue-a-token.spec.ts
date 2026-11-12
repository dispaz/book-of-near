import { expect, test, type Page } from "@playwright/test";
import { LOAD_3D, answerCheck, completionOf, nextStep, seedRoute, slow3d } from "./helpers";

// Walks lesson 3.2 in demo mode (no wallet, no network), in both views.
const ID = "l-3-2-issue-a-token";
const TITLE = "Issue your own token";
const STAGE = 3;
const T = { timeout: 15_000 };

// Four realtime transactions (each about 3 s in demo mode) plus page turns.
test.describe.configure({ timeout: 90_000 });
test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.getByTestId("token-scene");
const state = (page: Page, re: RegExp) => expect(scene(page)).toHaveAttribute("data-scene-state", re, T);
const next = (page: Page) => page.getByRole("button", { name: "Next step" });

async function mint(page: Page, symbol = "BOOK") {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: `Mint ${symbol} tokens`, exact: true }).click();
  await state(page, /minted:yes/);
}

async function sendRefused(page: Page, symbol = "BOOK") {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: `Send 50 ${symbol} to friend.testnet`, exact: true }).click();
  await state(page, /refused:yes/);
}

async function register(page: Page) {
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Pay storage deposit for friend", exact: true }).click();
  await state(page, /registered:yes/);
}

async function gasless(page: Page, n = 1) {
  await page.getByRole("button", { name: /^(Sign gasless transfer|Send another gasless transfer)$/ }).click();
  await state(page, new RegExp(`relayed:${n};`));
}

async function walkToCheck(page: Page) {
  await nextStep(page); // hook → mint
  await mint(page);
  await nextStep(page); // → the storage trap
  await sendRefused(page);
  await nextStep(page); // → register
  await register(page);
  await nextStep(page); // → gasless
  await expect(next(page)).toBeDisabled();
  await gasless(page);
  await nextStep(page); // → check
}

const ANSWERS = [
  "The receiver has no storage deposit to pay for its balance record in the token contract.",
  "They can send tokens without holding NEAR for gas first.",
  "It is refunded to the account.",
];

test.describe(`lesson ${ID}`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`is in the contents and walks to Finish in demo mode (${view})`, async ({ page }) => {
      slow3d(view === "3d");
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await page.goto(`/lesson/${ID}?view=${view}`);
      if (view === "3d")
        await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
      await walkToCheck(page);
      await answerCheck(page, ANSWERS);
      await nextStep(page); // → honest take
      const honest = page.getByRole("region", { name: "Honest take" });
      await expect(honest).toContainText("ERC-4337");
      await page.getByRole("button", { name: "Finish lesson" }).click();
      await expect(page.getByText("Lesson done")).toBeVisible();
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: {
          tokenSymbol: "BOOK",
          totalSupply: "1000",
          relayerPaidGas: "true",
          txHash: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/),
          tokenContract: expect.stringMatching(/^token\.bon-[a-z0-9]{8}\.testnet$/),
        },
      });
    });
  }

  test("a token is created, a transfer is refused until storage is paid, then the relayer delivers until its cap", async ({
    browser,
  }) => {
    // Reduced motion: instant pace, so four relays stay quick.
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=2d`);
    await nextStep(page);
    // The learner's own values carry into later text.
    const form = page.getByRole("form", { name: "Your token" });
    await form.getByLabel("Symbol").fill("ink");
    await expect(form.getByLabel("Symbol")).toHaveValue("INK");
    await form.getByLabel("Supply").fill("12");
    await expect(page.getByTestId("mint-problem")).toBeVisible();
    await form.getByLabel("Supply").fill("2000");
    await mint(page, "INK");
    await expect(page.getByTestId("my-balance")).toHaveText("2,000 INK");

    await nextStep(page);
    await expect(page.getByTestId("caption")).toContainText("50 INK");
    await sendRefused(page, "INK");
    await expect(page.getByTestId("refusal")).toContainText("not registered");
    await expect(page.getByTestId("my-balance")).toHaveText("2,000 INK");

    await nextStep(page);
    await register(page);
    // The storage registration is explained in the scene.
    await expect(page.getByTestId("registered")).toContainText("0.00125 NEAR");
    await expect(page.getByTestId("token-facts")).toContainText("bytes in the token contract");

    await nextStep(page);
    // The relayer is a pick target too: not yet before a signed parcel, then what it paid for.
    const relayer = page.getByRole("button", { name: /^Mailbox: the relayer/ });
    await relayer.press("Enter");
    await expect(page.getByTestId("pick-note")).toHaveText(
      "The relayer only carries signed transfers. Sign the parcel first.",
    );
    await gasless(page, 1);
    await relayer.press("Enter");
    await expect(page.getByTestId("pick-note")).toHaveText(
      "The relayer paid the gas for 1 transfer. It pays for up to 3 per visit: 2 left.",
    );
    await expect(page.getByTestId("friend-balance")).toHaveText("50 INK");
    await expect(page.getByTestId("my-near")).toContainText("unchanged");
    await expect(page.getByTestId("relay-left")).toHaveText("2 of 3 left this visit");
    await gasless(page, 2);
    await gasless(page, 3);
    await expect(page.getByTestId("friend-balance")).toHaveText("150 INK");
    await page.getByRole("button", { name: "Send another gasless transfer", exact: true }).click();
    await state(page, /capped:yes/);
    await expect(page.getByTestId("relay-refused")).toContainText("cap");
    await expect(page.getByTestId("friend-balance")).toHaveText("150 INK");
    await expect(page.getByRole("button", { name: "Relayer cap reached" })).toBeDisabled();
    await expect(next(page)).toBeEnabled();
    await ctx.close();
  });
});

test.describe(`lesson ${ID}: motion, fallback, switching, phones`, () => {
  for (const view of ["2d", "3d"] as const) {
    test(`works with reduced motion in the ${view} view`, async ({ browser }) => {
      slow3d(view === "3d");
      const ctx = await browser.newContext({ reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await walkToCheck(page);
      await ctx.close();
    });
  }

  test("works on a phone-sized screen in the 3d view", async ({ browser }) => {
    slow3d();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d`);
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: LOAD_3D });
    await walkToCheck(page);
    await ctx.close();
  });

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

  test("in 3D, objects run the step's action, say not yet, and show details; switching views keeps progress", async ({
    page,
  }) => {
    slow3d();
    await page.goto(`/lesson/${ID}?view=3d`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    // Too early: the stamp says what to do first.
    await page.getByRole("button", { name: /^Minting stamp/ }).press("Enter");
    await expect(page.getByTestId("pick-note")).toHaveText("Mint your tokens at step 2.");
    await nextStep(page);
    await page.getByRole("button", { name: /^Minting stamp: mint/ }).press("Enter");
    await state(page, /minted:yes/);
    await page.getByRole("button", { name: /^Minting stamp: token details/ }).press("Enter");
    await expect(page.getByTestId("pick-note")).toContainText("NEP-141");
    await nextStep(page);
    await page.getByRole("button", { name: "Mailbox: friend.testnet", exact: true }).press("Enter");
    await expect(page.getByTestId("pick-note")).toContainText("not registered");
    await page.getByRole("button", { name: /^Padlock: send/ }).press("Enter");
    await state(page, /refused:yes/);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "2D" }).click();
    await expect(scene(page)).toHaveAttribute("data-view", "2d");
    await state(page, /minted:yes;refused:yes;/);
    await expect(next(page)).toBeEnabled();
  });
});
