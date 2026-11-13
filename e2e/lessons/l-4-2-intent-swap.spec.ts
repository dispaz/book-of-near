import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, LOAD_3D, nextStep, seedRoute, slow3d, slow3dUnless2d } from "./helpers";

// Walks lesson 4.2 in demo mode (no wallet, no network): ask for an intent quote (the recorded 1Click
// quote: 5 NEAR → 20.27 USDC in 27 s), open it, watch the solver fill it, then finish on the dry-run
// quote or the optional tiny swap (the demo wallet simulates it, so it never counts as real).
const ID = "l-4-2-intent-swap";
const TITLE = "Swap across chains with an intent";
const STAGE = 4;
const ANSWERS = [
  "An intent states the result you want; solvers find and carry out the best route.",
  "They pay out from money they already hold on the destination chain.",
  "No. The solver pays the destination gas as part of the quote.",
];

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("ixs-scene");
const dock = (page: Page) => page.locator(".action-slot");

async function expectView(page: Page, view: "2d" | "3d") {
  await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
}

/** Next, then wait until the new step is on screen (in 3D the words change after the page turn). */
async function go(page: Page, caption: string | RegExp) {
  await nextStep(page);
  await expect(page.getByTestId("caption")).toContainText(caption);
}

/**
 * The default build is testnet only (VITE_ENABLE_MAINNET off): step 5 says so, and offers no way to
 * the learner's own mainnet wallet or a real swap. `VITE_ENABLE_MAINNET=true npm run e2e` builds with it on.
 */
const MAINNET = process.env.VITE_ENABLE_MAINNET === "true";

async function expectTestnetOnly(page: Page) {
  await expect(page.getByTestId("testnet-only")).toHaveText(
    "This build is testnet only: the real swap is switched off. Optional: simulate a 0.1 NEAR swap with the demo wallet.",
  );
  await expect(page.getByRole("button", { name: "Use my own wallet" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /mainnet|for real/i })).toHaveCount(0);
  await expect(page.getByTestId("finish-panel")).not.toContainText(/mainnet/i);
}

/** From the hook to "Lesson done", finishing on the dry-run quote. */
async function walk(page: Page) {
  await go(page, "Choose your trade");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Fetch live intent quote" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);
  await expect(page.getByTestId("quote-source")).toContainText("Recorded quote");

  // The learner's numbers reach the caption.
  await go(page, "20.27 USDC delivered in under 27 seconds");
  await dock(page).getByRole("button", { name: "Inspect quote breakdown" }).click();
  await expect(page.getByTestId("min-out")).toContainText("20.0673 USDC");
  await expect(page.getByTestId("time-estimate")).toContainText("27 seconds");
  await expect(page.getByTestId("quote-signature")).toContainText("ed25519:");
  await expect(page.getByTestId("solvers-note")).toContainText("only the winning quote");

  await go(page, "Watch the solver fill the order");
  await dock(page).getByRole("button", { name: "Simulate solver execution" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /fill:done/, { timeout: 10_000 });
  await expect(page.getByTestId("fill-status")).toContainText("Done.");

  await go(page, "Finish safely on the dry-run quote");
  await expect(page.getByTestId("swap-offer")).toHaveAttribute("data-offer", "not-offered");
  if (!MAINNET) await expectTestnetOnly(page);
  await dock(page).getByRole("button", { name: "Finish on verified quote" }).click();

  await go(page, "Three questions");
  await answerCheck(page, ANSWERS);
  await nextStep(page); // check → honest take
  await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test.beforeEach(() => slow3d(view === "3d"));

    test("walks to Finish in demo mode on the recorded quote, with no real swap", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript((v) => localStorage.setItem("bon:view", v), view);
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await expectView(page, view);
      await walk(page);
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: {
          originAsset: "NEAR",
          destinationAsset: "USDC (Arbitrum)",
          amountIn: "5",
          amountOut: "20.27",
          estimatedSeconds: "27",
          quoteSource: "recorded",
          dryQuoteVerified: "true",
          realSwapExecuted: "false",
          finishedOn: "dry-run quote",
        },
      });
      expect(errors).toEqual([]);
    });

    test("walks with reduced motion", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await walk(page);
      await context.close();
    });

    test("objects do the step's action, say 'not yet' too early, and show a detail after", async ({
      page,
    }) => {
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      const note = page.getByTestId("picked-note");
      await page.getByRole("button", { name: "Your intent" }).press("Enter");
      await expect(note).toHaveAttribute("data-not-yet", "yes");
      await expect(note).toContainText("Declare your intent first.");
      await go(page, "Choose your trade");
      await page.getByRole("button", { name: "Your intent" }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);
      await go(page, "Inspect the winning solver quote");
      await page.getByRole("button", { name: "Your Arbitrum address" }).press("Enter");
      await expect(note).toContainText("Simulate the solver first.");
      await page.getByRole("button", { name: "Your intent" }).press("Enter");
      await expect(page.getByTestId("min-out")).toBeVisible();
      await go(page, "Watch the solver fill the order");
      await page.getByRole("button", { name: "The winning solver" }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /fill:done/, { timeout: 10_000 });
      await page.getByRole("button", { name: "Your Arbitrum address" }).press("Enter");
      await expect(note).not.toHaveAttribute("data-not-yet", "yes");
      await expect(note).toContainText("20.27 USDC arrived");
    });
  });

test.describe(`lesson ${ID}`, () => {
  test("the tiny swap is offered only with a funded wallet; the demo wallet's swap is not counted as real", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /fill:done/);
    const offer = page.getByTestId("swap-offer");
    // No wallet: not offered, so the lesson finishes on the dry-run quote.
    await expect(offer).toHaveAttribute("data-offer", "not-offered");
    await expect(page.getByTestId("swap-real")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
    // The demo wallet has 25 simulated NEAR: offered.
    await dock(page).getByRole("button", { name: "Connect the demo wallet" }).click();
    await expect(offer).toHaveAttribute("data-offer", "offered");
    // Before the button: the real swap's USDC stays in NEAR Intents, not on Arbitrum.
    await expect(page.getByTestId("swap-where")).toHaveText(
      "The USDC stays in your NEAR Intents account (intents.near), not on Arbitrum. You withdraw it separately.",
    );
    await page.getByTestId("swap-real").click();
    // The wallet seam shows the amount and waits for Confirm.
    const dialog = page.getByRole("dialog", { name: "Please check this before you continue" });
    await expect(page.getByTestId("signing-amount")).toContainText("wrap.near");
    await expect(dialog).toContainText("kept in your NEAR Intents account (not sent to Arbitrum)");
    await dialog.getByRole("button", { name: "Confirm and open my wallet" }).click();
    await expect(page.getByTestId("swap-outcome")).toHaveAttribute("data-outcome", "done");
    await expect(page.getByTestId("swap-outcome")).toContainText("No real money moved");
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /finish:real;real:no/);
    await go(page, "Three questions");
    await answerCheck(page, ANSWERS);
    await nextStep(page);
    await page.getByRole("button", { name: "Finish lesson" }).click();
    expect(await completionOf(page, ID)).toMatchObject({
      evidence: {
        realSwapExecuted: "false",
        finishedOn: "tiny swap",
        realSwapTxHash: "demo-0001",
        simulatedSwap: expect.stringContaining("demo wallet"),
      },
    });
  });

  test("cancelling the tiny swap sends nothing and keeps the dry-run finish open", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await dock(page).getByRole("button", { name: "Connect the demo wallet" }).click();
    await page.getByTestId("swap-real").click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("swap-outcome")).toHaveAttribute("data-outcome", "declined");
    await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
    await dock(page).getByRole("button", { name: "Finish on verified quote" }).click();
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });

  test("on a short desktop screen the note docks instead of covering the swap controls", async ({ page }) => {
    // The swap outcome makes the dock taller, so the margin above it gets too short for the note: it must
    // move into the dock, not stay where it was, over the buttons (CI's fonts hit this at 720 px).
    await page.setViewportSize({ width: 1280, height: 660 });
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await dock(page).getByRole("button", { name: "Connect the demo wallet" }).click();
    await page.getByTestId("swap-real").click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("swap-outcome")).toHaveAttribute("data-outcome", "declined");
    await expect(page.locator(".lesson-dock").getByTestId("explain")).toBeVisible();
    await expect(page.locator(".note.floating")).toBeHidden();
    await dock(page).getByRole("button", { name: "Finish on verified quote" }).click({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });

  test("opening a later step by its link fills in the free steps but never swaps", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await expect(scene(page)).toHaveAttribute(
      "data-scene-state",
      "quote:recorded;inspected:yes;fill:done;finish:none;real:no",
    );
    await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  /** Testnet mode with every outside host blocked except a stubbed 1Click (this build has no Worker URL). */
  async function testnetWith1Click(page: Page, reply: { status: number; body: unknown }) {
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) =>
      /1click\.chaindefuser\.com\/v0\/quote$/.test(route.request().url())
        ? route.fulfill({
            status: reply.status,
            contentType: "application/json",
            body: JSON.stringify(reply.body),
          })
        : route.abort(),
    );
    await page.goto(`/lesson/${ID}?view=2d&step=2&mode=testnet`);
  }

  test("testnet mode shows a live dry-run quote from 1Click", async ({ page }) => {
    // The shape of a real dry quote (12 Nov 2026): 5 NEAR → 17.09 USDC on Arbitrum, about 21 s.
    await testnetWith1Click(page, {
      status: 201,
      body: {
        quote: {
          amountIn: "5000000000000000000000000",
          amountInFormatted: "5.0",
          amountInUsd: "17.15",
          amountOut: "17094638",
          amountOutFormatted: "17.094638",
          amountOutUsd: "17.08",
          minAmountOut: "16923691",
          timeEstimate: 21,
          refundFee: "0",
          withdrawFee: "5300",
        },
        quoteRequest: {
          dry: true,
          deadline: "2026-11-12T21:35:58.000Z",
          appFees: [{ recipient: "x", fee: 20 }],
        },
        signature: "ed25519:2GntPbJmcASW8d1UV2bL6ShDuKyC7YXupKyDraqAfdMW",
        correlationId: "599b1a3d",
      },
    });
    await dock(page).getByRole("button", { name: "Fetch live intent quote" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:direct/);
    await expect(page.getByTestId("quote-status")).toHaveText("17.094638 USDC, about 21 s");
    await expect(page.getByTestId("quote-source")).toContainText("Live dry-run quote from 1Click");
    await go(page, "17.094638 USDC delivered in under 21 seconds");
  });

  test("if 1Click fails, testnet mode says why and carries on with the recorded quote", async ({ page }) => {
    await testnetWith1Click(page, {
      status: 500,
      body: { message: "Failed to receive response within timeout" },
    });
    await dock(page).getByRole("button", { name: "Fetch live intent quote" }).click();
    await expect(page.getByTestId("quote-notice")).toContainText("Failed to receive response within timeout");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expectView(page, "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
  });

  test("2D to 3D keeps the quote and the fill", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=4`);
    await dock(page).getByRole("button", { name: "Simulate solver execution" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /fill:done/, { timeout: 10_000 });
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded;inspected:yes;fill:done/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  });
});

test.describe("3D book scene", () => {
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
    // The printed action still works.
    await dock(page).getByRole("button", { name: "Fetch live intent quote" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 2/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 2/);
    // While the tour runs, the words go back to their docked place: still readable.
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    // A new step ends the tour and prints the words again.
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 3/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
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
