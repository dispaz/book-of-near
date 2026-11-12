import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, LOAD_3D, nextStep, seedRoute, slow3d, slow3dUnless2d } from "./helpers";

// Walks lesson 4.3 in demo mode (no wallet, no network): play the old bridge and the intent side by side
// (bridge figures are labelled estimates, the intent's time and fee come from the recorded 1Click quote:
// 27 s, $0.09 spread + fees), inspect the wrapped token, simulate the vault exploit, close the shield.
const ID = "l-4-3-old-bridge-vs-near";
const TITLE = "Old bridge vs the NEAR way";
const STAGE = 4;
const ANSWERS = [
  "They keep big pools of user coins in vault contracts run by a few signers or a multi-sig.",
  "They lose their backing and their value falls towards zero.",
  "You receive native coins directly; the solvers carry the cross-chain inventory risk themselves.",
];

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("blc-scene");
const dock = (page: Page) => page.locator(".action-slot");

async function expectView(page: Page, view: "2d" | "3d") {
  await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
}

/** Next, then wait until the new step is on screen (in 3D the words change after the page turn). */
async function go(page: Page, caption: string | RegExp) {
  await nextStep(page);
  await expect(page.getByTestId("caption")).toContainText(caption);
}

/** From the hook to "Lesson done". */
async function walk(page: Page) {
  await go(page, "Count the steps");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Compare workflow steps" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /played:6/, { timeout: 10_000 });
  const bridge = page.getByTestId("timeline-bridge");
  const intent = page.getByTestId("timeline-intent");
  await expect(bridge.locator("li[data-lit=yes]")).toHaveCount(6);
  await expect(intent.locator("li[data-lit=yes]")).toHaveCount(2);
  // Every bridge figure is an estimate and says so; the intent's delivery figures come from the quote.
  await expect(bridge.locator(".blc-fig")).toHaveCount(14);
  await expect(bridge.locator('.blc-fig[data-source="estimate"] .blc-tag')).toHaveText(
    Array(14).fill("est."),
  );
  await expect(page.getByTestId("timeline-bridge-total")).toContainText("about 20 min");
  await expect(page.getByTestId("timeline-intent-total")).toContainText("about 27 s recorded quote");
  await expect(page.getByTestId("timeline-intent-total")).toContainText("about $0.09 spread + fees");
  await expect(page.getByTestId("quote-source")).toContainText("recorded 1Click quote");
  // The learner's number reaches the caption.
  await expect(page.getByTestId("caption")).toContainText("2 for an intent (about 27 s, recorded quote)");

  await go(page, "what a wrapped token really is");
  await dock(page).getByRole("button", { name: "Inspect asset backing" }).click();
  await expect(page.getByTestId("backing")).toContainText("an IOU");

  await go(page, "An attacker finds a bug");
  await dock(page).getByRole("button", { name: "Trigger simulated vault exploit" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /exploit:done/, { timeout: 10_000 });
  await expect(page.getByTestId("wusdc-value")).toContainText("$0.00");
  await expect(page.getByTestId("usdc-value")).toContainText("$1.00");

  await go(page, "Confidential intents");
  await dock(page).getByRole("button", { name: "Inspect confidential shield" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /shield:on/);

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

    test("walks to Finish in demo mode on recorded data", async ({ page }) => {
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
          bridgeSteps: "6",
          intentSteps: "2",
          intentTime: "about 27 s",
          intentFee: "about $0.09 spread + fees",
          quoteSource: "recorded",
          exploitSimulated: "true",
          protectedByNativeDelivery: "true",
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
      await page.getByRole("button", { name: "The wrapped token, wUSDC" }).press("Enter");
      await expect(note).toHaveAttribute("data-not-yet", "yes");
      await expect(note).toContainText("Inspect asset backing first.");
      await go(page, "Count the steps");
      await page.getByRole("button", { name: "The bridge vault" }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /played:6/, { timeout: 10_000 });
      await go(page, "what a wrapped token really is");
      await page.getByRole("button", { name: "The wrapped token, wUSDC" }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /inspected:yes/);
      await go(page, "An attacker finds a bug");
      await page.getByRole("button", { name: "The confidential shield" }).press("Enter");
      await expect(note).toContainText("Trigger the simulated vault exploit first.");
      await page.getByRole("button", { name: "The bridge vault" }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /exploit:done/, { timeout: 10_000 });
      await page.getByRole("button", { name: "The native USDC coin" }).press("Enter");
      await expect(note).not.toHaveAttribute("data-not-yet", "yes");
      await expect(note).toContainText("Native USDC");
    });
  });

test.describe(`lesson ${ID}`, () => {
  test("without WebGL the 3D view falls back and the timelines still play", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=3d&webgl=0&step=2`);
    await dock(page).getByRole("button", { name: "Compare workflow steps" }).click();
    await expect(page.locator("[data-scene-state]").first()).toHaveAttribute("data-scene-state", /played:6/, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("timeline-intent")).toContainText("recorded quote");
  });

  test.describe("3D book scene", () => {
    test.beforeEach(() => slow3d());

    test("wide screens print the step on the left page; the tour moves the camera and docks the words", async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=3d&step=3`);
      await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
      await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
      await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);

      const caption = page.getByTestId("tour-caption");
      await expect(caption).toHaveText(/^Fig\. 3/);
      await page.getByRole("button", { name: "Play the tour" }).click();
      await expect(caption).not.toHaveText(/^Fig\. 3/);
      // While the tour runs, the words go back to their docked place: still readable.
      await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
      await expect(page.getByTestId("caption")).toBeVisible();
      // A new step ends the tour and prints the words again.
      await dock(page).getByRole("button", { name: "Inspect asset backing" }).click();
      await nextStep(page);
      await expect(caption).toHaveText(/^Fig\. 4/);
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
});
