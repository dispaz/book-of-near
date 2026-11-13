import { expect, test, type Page } from "@playwright/test";
import {
  answerCheck,
  completionOf,
  countDrawnFrames,
  expectFocusMarksHover,
  expectNotYetHint,
  expectPickDetail,
  expectPickPlaysAndSettles,
  expectSettled,
  LOAD_3D,
  nextStep,
  pickButton,
  seedRoute,
  slow3d,
  slow3dUnless2d,
} from "./helpers";

// Walks lesson 5.1 in demo mode (no wallet, no network): root reads both memories, ask the tutor (a
// pre-written answer), fetch NEAR AI Cloud's attestation quote (recorded on 13 Nov 2026), and verify it
// for real in the browser: signatures up to Intel's root, the report data and the measurements.
const ID = "l-5-1-private-ai";
const TITLE = "Ask a private AI and verify it";
const STAGE = 5;
const ANSWERS = [
  "The processor encrypts its memory in hardware, so even root admins cannot read it.",
  "A report signed by the chip that proves which code runs inside a genuine enclave.",
  "Encrypted noise.",
];

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("pai-scene");
const dock = (page: Page) => page.locator(".action-slot");
const next = (page: Page) => page.getByRole("button", { name: "Next step" });

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
  await go(page, "seals memory inside the chip");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Read the memory as root" }).click();
  await expect(page.getByTestId("ram-dump")).toContainText("use sharding?");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /dump:yes/);

  await go(page, "Ask the Book of NEAR tutor");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "What is a named account?" }).click();
  await dock(page).getByRole("button", { name: "Send prompt" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /asked:1;answered:yes/, { timeout: 15_000 });
  await expect(page.getByTestId("tutor-answer")).toContainText("alice.near");
  await expect(page.getByTestId("answer-source")).toContainText("Pre-written answer, not generated live");

  await go(page, "Ask the chip for proof");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Fetch attestation quote" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);
  await expect(page.getByTestId("quote-tee")).toHaveText("Intel TDX quote, 5006 bytes");
  await expect(page.getByTestId("quote-certs")).toHaveText(
    "Intel SGX PCK Certificate → Intel SGX PCK Platform CA → Intel SGX Root CA",
  );
  await expect(page.getByTestId("quote-source")).toContainText("Recorded on 13 Nov 2026");

  await go(page, "Verify the quote yourself");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Verify in my browser" }).click();
  await expect(page.getByTestId("verdict")).toHaveText(
    "Verified: a genuine Intel TDX enclave, checked in your browser.",
  );
  await expect(page.getByTestId("verify-checks").locator('li[data-ok="yes"]')).toHaveCount(7);
  // Change one byte: the same checks now fail.
  await dock(page).getByRole("button", { name: "Change one byte and verify again" }).click();
  await expect(page.getByTestId("tamper-result")).toContainText(
    "The report is signed by the quote's attestation key.",
  );
  await expect(scene(page)).toHaveAttribute("data-scene-state", /verify:ok;tamper:failed/);

  await go(page, "Three questions");
  await answerCheck(page, ANSWERS);
  await nextStep(page); // check → honest take
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest).toContainText("You still trust the chipmaker");
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test.beforeEach(() => slow3d(view === "3d"));

    test("walks to Finish in demo mode and verifies the recorded quote", async ({ page }) => {
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
          attestationHash: expect.stringMatching(/^[0-9a-f]{64}$/),
          verified: "true",
          tee: "Intel TDX",
          model: "Qwen/Qwen3.8-27B",
          quoteSource: "recorded",
          recordedOn: "2026-11-13",
          checksPassed: "7",
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
  });

test.describe(`lesson ${ID}`, () => {
  test("2D objects do the step's action, say 'not yet' too early, and show a detail after", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await expectView(page, "2d");
    const note = page.getByTestId("picked-note");
    await page.getByRole("button", { name: "Root access" }).press("Enter");
    await expect(note).toHaveAttribute("data-not-yet", "yes");
    await expect(note).toContainText("Not yet: you try root access on step 2.");
    await page.getByRole("button", { name: "The attestation quote" }).press("Enter");
    await expect(note).toContainText("Send a prompt first.");
    await go(page, "seals memory inside the chip");
    await page.getByRole("button", { name: "Root access" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dump:yes/);
    await page.getByRole("button", { name: "Root access" }).press("Enter");
    await expect(note).not.toHaveAttribute("data-not-yet", "yes");
    await expect(note).toContainText("The enclave's memory was noise.");
    await go(page, "Ask the Book of NEAR tutor");
    await page.getByRole("button", { name: "Your terminal" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /asked:0;answered:yes/, {
      timeout: 15_000,
    });
    await go(page, "Ask the chip for proof");
    await page.getByRole("button", { name: "Intel's root certificate" }).press("Enter");
    await expect(note).toContainText("Fetch the quote first (step 4).");
    await page.getByRole("button", { name: "The attestation quote" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);
    await go(page, "Verify the quote yourself");
    await page.getByRole("button", { name: "Intel's root certificate" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /verify:ok/);
    await page.getByRole("button", { name: "Intel's root certificate" }).press("Enter");
    await expect(note).toContainText("Intel SGX Root CA, fingerprint 44a0196b…fab674d3");
  });

  test("opening a later step by its link fills in the free steps but leaves the check to the learner", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await expect(scene(page)).toHaveAttribute(
      "data-scene-state",
      "dump:yes;asked:0;answered:yes;quote:recorded;verify:idle;tamper:none",
    );
    await expect(next(page)).toBeDisabled();
  });

  test("testnet mode fetches a fresh quote with its own nonce; on failure it says why and uses the recorded one", async ({
    page,
  }) => {
    let nonce = "";
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => {
      const url = new URL(route.request().url());
      if (url.host !== "cloud-api.near.ai") return route.abort();
      nonce = url.searchParams.get("nonce") ?? "";
      return route.fulfill({ status: 503, body: "" });
    });
    await page.goto(`/lesson/${ID}?view=2d&step=4&mode=testnet`);
    await dock(page).getByRole("button", { name: "Fetch attestation quote" }).click();
    await expect(page.getByTestId("quote-notice")).toContainText("NEAR AI Cloud answered 503.");
    await expect(page.getByTestId("quote-notice")).toContainText("recorded on 13 Nov 2026");
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);
    await expect(next(page)).toBeEnabled();
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expectView(page, "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await go(page, "seals memory inside the chip");
    await dock(page).getByRole("button", { name: "Read the memory as root" }).click();
    await expect(page.getByTestId("ram-dump")).toBeVisible();
  });

  test("phone layout: the 2D page and its facts fit the screen", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=2d&step=4`);
    await dock(page).getByRole("button", { name: "Fetch attestation quote" }).click();
    await expect(page.getByTestId("quote-facts")).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    await ctx.close();
  });

  test("2D to 3D keeps the quote and the verification", async ({ page }) => {
    slow3d();
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await dock(page).getByRole("button", { name: "Verify in my browser" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /verify:ok/);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded;verify:ok/);
    await expect(next(page)).toBeEnabled();
  });
});

test.describe("3D book scene", () => {
  test.beforeEach(() => slow3d());

  test("wide screens print the step on the left page; the tour moves the camera and docks the words", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=4`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
    await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);
    // The printed action still works.
    await dock(page).getByRole("button", { name: "Fetch attestation quote" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 4/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 4/);
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 5/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
    await ctx.close();
  });

  test("phones keep the step's words docked, not printed on the page", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.locator(".book-page")).toHaveCSS("display", "contents");
    await ctx.close();
  });

  test("an idle 3d scene draws no frames (render on demand)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${ID}?view=3d`);
    const stage = page.locator(".sk-stage").first();
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    await expect(stage).not.toHaveAttribute("data-pop", /./, { timeout: LOAD_3D });
    await expectSettled(page);
  });

  // Rule 10a: every clickable object reacts (docs/lessons/stage-5/5.1.md, "Reactions").
  const open3d = async (page: Page, step = 1) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/lesson/${ID}?view=3d&step=${step}`);
    await expect(page.locator(".book-scene .sk-stage")).toHaveAttribute("data-camera", "still", {
      timeout: LOAD_3D,
    });
  };

  test("3d reactions: focus marks every object hovered", async ({ page }) => {
    await open3d(page);
    for (const name of [
      "Your terminal",
      "An ordinary cloud server",
      "The hardware enclave",
      "Root access",
      "The attestation quote",
      "Intel's root certificate",
    ])
      await expectFocusMarksHover(page, name);
  });

  test("3d reactions: early picks say 'not yet' and change nothing", async ({ page }) => {
    await open3d(page);
    await expectNotYetHint(page, "Root access", "Not yet: you try root access on step 2.");
    await expectNotYetHint(page, "The attestation quote", "Send a prompt first.");
    await expectNotYetHint(page, "Intel's root certificate", "Fetch the quote first (step 4).");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dump:no;asked:none/);
  });

  test("3d reactions: a pick does the step's action with its own animation, then the canvas settles; a detail after", async ({
    page,
  }) => {
    await page.addInitScript(countDrawnFrames);
    await open3d(page, 2);
    await expectPickPlaysAndSettles(page, "Root access");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dump:yes/);
    await expectPickDetail(
      page,
      "Root access",
      "As root you read the server's memory in plain text. The enclave's memory was noise.",
    );
    await expectPickDetail(page, "An ordinary cloud server", /plain text/);
    await expectPickPlaysAndSettles(page, "The hardware enclave");
    await expect(pickButton(page, "The hardware enclave")).toHaveAttribute(
      "data-detail",
      /root is locked out/,
    );
  });

  test("3d reactions: the quote and the seal fetch and verify, then show their details", async ({ page }) => {
    await open3d(page, 4);
    await pickButton(page, "The attestation quote").press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /quote:recorded/);
    await expectNotYetHint(page, "Intel's root certificate", "Not yet: you verify on step 5.");
    await expectPickDetail(page, "The attestation quote", /^Intel TDX quote, 5006 bytes/);
    await go(page, "Verify the quote yourself");
    await pickButton(page, "Intel's root certificate").press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /verify:ok/);
    await expectPickDetail(
      page,
      "Intel's root certificate",
      "Intel SGX Root CA, fingerprint 44a0196b…fab674d3: the root Intel publishes.",
    );
    await expectPickDetail(page, "The attestation quote", /^Signed by the chip and chained to Intel's root/);
  });

  test("3d reactions under reduced motion: hover still marks, a pick shows its detail with no motion", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=2`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expectFocusMarksHover(page, "The hardware enclave");
    await pickButton(page, "Root access").press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dump:yes/);
    await expect(pickButton(page, "Root access")).toHaveAttribute("data-pick", "idle");
    await expectPickDetail(page, "The hardware enclave", /root is locked out/);
    await ctx.close();
  });
});
