import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  answerCheck,
  completionOf,
  LOAD_3D,
  nextStep,
  seedPracticeAccount,
  seedRoute,
  slow3d,
  slow3dUnless2d,
} from "./helpers";

// Walks lesson 4.1 in demo mode (no wallet, no network): derive an Ethereum address from the practice
// account, pack a Sepolia transfer, ask DemoChain's signer for a signature (the same `sign` call the
// testnet signer takes, answered a few blocks later), and check who signed. Nothing is broadcast.
const ID = "l-4-1-one-account-every-chain";
const TITLE = "One account, every chain";
const STAGE = 4;
const BASE58_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-f]{64}$/;

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

/** Next, then wait until the new step is on screen (in 3D the words change after the page turn). */
async function go(page: Page, caption: string | RegExp) {
  await nextStep(page);
  await expect(page.getByTestId("caption")).toContainText(caption);
}

const scene = (page: Page) => page.getByTestId("csg-scene");
const dock = (page: Page) => page.locator(".action-slot");

async function expectView(page: Page, view: "2d" | "3d") {
  await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
}

/** The 3D canvas wrapper: its description and its labels. */
const stage = (page: Page) => page.locator(".book-scene .sk-stage");

/** `inner`'s box lies inside `outer`'s (2D: the SVG drawing, so boxes are real). Waits for transitions. */
async function expectInside(inner: Locator, outer: Locator) {
  await expect(async () => {
    const a = (await inner.boundingBox())!;
    const b = (await outer.boundingBox())!;
    expect(a.x).toBeGreaterThanOrEqual(b.x - 1);
    expect(a.y).toBeGreaterThanOrEqual(b.y - 1);
    expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 1);
    expect(a.y + a.height).toBeLessThanOrEqual(b.y + b.height + 1);
  }).toPass({ timeout: 5_000 });
}

/** The r, s and v slips stand on the parcel: SVG slips in 2D, printed labels in 3D. */
async function expectSlips(page: Page, view: "2d" | "3d") {
  if (view === "2d") {
    const slips = page.getByTestId("rsv-slips");
    await expect(slips).toBeVisible();
    await expect(slips).toContainText(/r\s*s\s*v [01]/);
  } else {
    for (const t of [/^r$/, /^s$/, /^v [01]$/])
      await expect(stage(page).locator(".sk-label", { hasText: t })).toBeVisible();
  }
}

/** Steps 1 to 7: derive, pack, sign, verify, the check, the honest take, Finish. */
async function walk(page: Page, signMs = 15_000) {
  await go(page, "Derive an Ethereum address"); // hook → derive
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Derive Ethereum address" }).click();
  await expect(page.getByTestId("eth-address")).toHaveText(ADDRESS);
  const address = (await page.getByTestId("eth-address").textContent())!;
  await expect(scene(page)).toHaveAttribute("data-scene-state", /derived:yes/);

  await go(page, "Sepolia"); // derive → prepare
  await dock(page).getByRole("button", { name: "Prepare payload" }).click();
  await expect(page.getByTestId("payload")).toHaveText(HASH32);
  await expect(page.getByTestId("eth-balance")).toContainText("0 ETH");

  await go(page, "Ask the signing network"); // prepare → sign
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await dock(page).getByRole("button", { name: "Request signature (MPC)" }).click();
  await expect(page.getByTestId("sign-status")).toContainText("Signed.", { timeout: signMs });
  await expect(page.getByTestId("mpc-tx")).toHaveText(/^[1-9A-HJ-NP-Za-km-z]{10}…/);
  // r, s (32 bytes each) and v (the recovery id) are shown when the signature returns.
  await expect(page.getByTestId("sig-r")).toHaveText(HASH32);
  await expect(page.getByTestId("sig-s")).toHaveText(HASH32);
  await expect(page.getByTestId("sig-v")).toHaveText(/^[01]$/);

  await go(page, "Attach r, s and v"); // sign → verify
  // The signed transaction carries the same r, s and v.
  await expect(page.getByTestId("tx-r")).toHaveText(HASH32);
  await expect(page.getByTestId("tx-s")).toHaveText(HASH32);
  await expect(page.getByTestId("tx-v")).toHaveText(/^[01]$/);
  await expect(page.getByTestId("derived")).toHaveText(address);
  await dock(page).getByRole("button", { name: "Verify signer" }).click();
  await expect(page.getByTestId("recovered")).toHaveText(address);
  await expect(page.getByTestId("match")).toContainText("Match");
  await expect(page.getByTestId("broadcast-note")).toContainText("0 ETH");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /match:yes/);

  await nextStep(page); // verify → check
  await answerCheck(page, [
    "Nobody holds the whole key. It exists only as shares spread across the signing nodes.",
    "Nothing. It is math done in your browser, with no transaction.",
    "No. Ethereum needs ETH for gas, so someone must fund it first, or a relayer must pay.",
  ]);
  await nextStep(page); // check → honest take
  await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
  return address;
}

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test.beforeEach(() => slow3d(view === "3d"));

    test("walks to Finish in demo mode, and the completion record carries the evidence", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript((v) => localStorage.setItem("bon:view", v), view);
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await expectView(page, view);
      const address = await walk(page);
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: {
          path: "ethereum-1",
          derivedEthAddress: address,
          signerContract: "v1.signer-prod.testnet",
          txHash: expect.stringMatching(BASE58_HASH),
          mpcTxHash: expect.stringMatching(BASE58_HASH),
          signatureReturned: "true",
          r: expect.stringMatching(HASH32),
          s: expect.stringMatching(HASH32),
          v: expect.stringMatching(/^[01]$/),
          signedTx: expect.stringMatching(/^0x02[0-9a-f]+$/),
          recoveredAddress: address,
          recoveredMatches: "true",
          broadcast: expect.stringContaining("not sent"),
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

    test("with reduced motion the signing shows each phase's end state, no finale", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}&step=4`);
      await expectView(page, view);
      await expect(scene(page)).toHaveAttribute("data-scene-state", /packed:yes/);
      await dock(page).getByRole("button", { name: "Request signature (MPC)" }).click();
      await expect(scene(page)).toHaveAttribute("data-scene-state", /sign:answered/, { timeout: 15_000 });
      // Straight to the end state: no last shares, no seal, the parcel home with r, s and v.
      await expect(scene(page)).toHaveAttribute("data-sign-anim", "done");
      await expect(scene(page)).toHaveAttribute("data-parcel", "near");
      await expect(page.getByTestId("sign-status")).toContainText("Signed.");
      await expectSlips(page, view);
      await go(page, "Attach r, s and v");
      await expect(scene(page)).toHaveAttribute("data-parcel", "ethereum");
      await context.close();
    });

    test("walks on a phone-sized screen", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 760 } });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await walk(page);
      await context.close();
    });

    test("the request pauses until the signing network answers", async ({ page }) => {
      await page.goto(`/lesson/${ID}?view=${view}&step=3`);
      await expectView(page, view);
      await dock(page).getByRole("button", { name: "Prepare payload" }).click();
      await go(page, "Ask the signing network");
      await dock(page).getByRole("button", { name: "Request signature (MPC)" }).click();
      // While it waits: the state says so, the timer runs, the button is busy, Next stays locked.
      await expect(scene(page)).toHaveAttribute("data-scene-state", /sign:waiting/);
      await expect(page.getByTestId("sign-status")).toContainText("Waiting for the signing network");
      await expect(dock(page).getByRole("button", { name: "Waiting for the nodes…" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      // Then the answer comes back, a few blocks later.
      await expect(scene(page)).toHaveAttribute("data-scene-state", /sign:answered/, { timeout: 15_000 });
      await expect(page.getByTestId("sign-status")).toContainText(/came \d+ blocks after your request/);
      await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
    });

    test("Ethereum has its own area: the address grows in it and the signed parcel is delivered into it", async ({
      page,
    }) => {
      await page.goto(`/lesson/${ID}?view=${view}&step=2`);
      await expectView(page, view);
      // The area is one pick (it explains itself), the same in both views.
      await expect(page.getByRole("button", { name: "Ethereum (Sepolia)", exact: true })).toHaveCount(1);
      await dock(page).getByRole("button", { name: "Derive Ethereum address" }).click();
      await expect(page.getByTestId("eth-address")).toHaveText(ADDRESS);
      const address = page.getByRole("button", { name: "Your derived Ethereum address" });
      if (view === "2d") await expectInside(address, page.getByTestId("chain-area"));
      else await expect(stage(page)).toContainText(/into the Ethereum area, where the Ethereum address 0x/);

      await go(page, "Sepolia");
      await dock(page).getByRole("button", { name: "Prepare payload" }).click();
      // Packed on the NEAR side, by your mailbox.
      await expect(scene(page)).toHaveAttribute("data-parcel", "near");
      await go(page, "Ask the signing network");
      await dock(page).getByRole("button", { name: "Request signature (MPC)" }).click();
      // While it waits the parcel is at the signer and the nodes work; the countdown runs alongside.
      await expect(scene(page)).toHaveAttribute("data-sign-anim", "work");
      await expect(scene(page)).toHaveAttribute("data-parcel", "signer");
      await expect(page.getByTestId("sign-status")).toContainText("Waiting for the signing network");
      // The 8 nodes and the threshold of 6 are said to be a drawing.
      await expect(page.getByTestId("illustration-note")).toContainText("are a drawing");
      if (view === "2d") await expect(page.getByTestId("sign-fx")).toBeAttached();
      // The answer: the last shares, the seal, then the parcel comes home carrying r, s and v.
      await expect(scene(page)).toHaveAttribute("data-scene-state", /sign:answered/, { timeout: 15_000 });
      await expect(scene(page)).toHaveAttribute("data-sign-anim", "done", { timeout: 5_000 });
      await expect(scene(page)).toHaveAttribute("data-parcel", "near");
      await expectSlips(page, view);

      await go(page, "Attach r, s and v");
      await expect(scene(page)).toHaveAttribute("data-parcel", "ethereum", { timeout: 10_000 });
      const parcel = page.getByRole("button", { name: "The Ethereum transaction" });
      if (view === "2d") await expectInside(parcel, page.getByTestId("chain-area"));
      await expectSlips(page, view);
      await dock(page).getByRole("button", { name: "Verify signer" }).click();
      await expect(page.getByTestId("match")).toContainText("Match");
      // The check and the "not sent" note sit in the area.
      if (view === "2d") {
        await expect(page.getByTestId("recovered-mark")).toContainText("recovered signer = this address");
        await expectInside(page.getByTestId("recovered-mark"), page.getByTestId("chain-area"));
        await expect(page.getByTestId("not-sent-mark")).toContainText("Not sent to Sepolia");
        await expectInside(page.getByTestId("not-sent-mark"), page.getByTestId("chain-area"));
      } else {
        await expect(stage(page)).toContainText("Not sent to Sepolia");
        await expect(stage(page).locator(".sk-label", { hasText: /✓$/ })).toBeVisible();
      }
    });

    test("the scene's objects are buttons that do the step's action", async ({ page }) => {
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await page.getByRole("button", { name: "Ethereum (Sepolia)", exact: true }).press("Enter");
      await expect(page.getByTestId("picked-note")).toContainText(
        "Normally you need its own wallet and private key",
      );
      await go(page, "Derive an Ethereum address");
      await page.getByRole("button", { name: "Your NEAR account" }).press("Enter");
      await expect(page.getByTestId("eth-address")).toHaveText(ADDRESS);
      await go(page, "Sepolia");
      await page.getByRole("button", { name: "The Ethereum transaction" }).press("Enter");
      await expect(page.getByTestId("payload")).toBeVisible();
      await go(page, "Ask the signing network");
      await page.getByRole("button", { name: "Signing node 1", exact: true }).press("Enter");
      await expect(scene(page)).toHaveAttribute("data-scene-state", /sign:answered/, { timeout: 15_000 });
      await go(page, "Attach r, s and v");
      await page.getByRole("button", { name: "Your derived Ethereum address" }).press("Enter");
      await expect(page.getByTestId("match")).toContainText("Match");
    });
  });

test.describe(`lesson ${ID}`, () => {
  test("the learner's own path shows in later text and gives another address", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=2`);
    const input = page.getByTestId("path-input");
    await expect(page.getByTestId("caption")).toContainText('the path "ethereum-1"');
    await dock(page).getByRole("button", { name: "Derive Ethereum address" }).click();
    const first = (await page.getByTestId("eth-address").textContent())!;
    await dock(page).getByRole("button", { name: "Try another path" }).click();
    await input.fill("eth/defi");
    await expect(page.getByTestId("caption")).toContainText('the path "eth/defi"');
    await dock(page).getByRole("button", { name: "Derive Ethereum address" }).click();
    await expect(page.getByTestId("eth-address")).toHaveText(ADDRESS);
    const second = (await page.getByTestId("eth-address").textContent())!;
    expect(second).not.toBe(first);
    await go(page, "Sepolia");
    await dock(page).getByRole("button", { name: "Prepare payload" }).click();
    await go(page, "Ask the signing network");
    await dock(page).getByRole("button", { name: "Request signature (MPC)" }).click();
    await expect(page.getByTestId("sign-status")).toContainText("Signed.", { timeout: 15_000 });
    await go(page, "Attach r, s and v");
    await expect(page.getByTestId("derived")).toHaveText(second);
  });

  test("an empty path cannot be derived", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=2`);
    await page.getByTestId("path-input").fill("   ");
    await expect(dock(page).getByRole("button", { name: "Derive Ethereum address" })).toBeDisabled();
    await expect(page.locator("#csg-path-hint")).toContainText("Type a path");
  });

  test("demo mode says the signing network is played by the app", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=2`);
    await expect(page.getByTestId("demo-note")).toContainText("one demo key");
  });

  test("opening the verify step by its link derives and packs, but never signs for the learner", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await expect(scene(page)).toHaveAttribute("data-scene-state", /derived:yes;packed:yes;sign:idle/);
    await expect(dock(page).getByRole("button", { name: "Verify signer" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expectView(page, "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
  });

  test("2D to 3D keeps the derived address and the signature", async ({ page }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=3`);
    await dock(page).getByRole("button", { name: "Prepare payload" }).click();
    await go(page, "Ask the signing network");
    await dock(page).getByRole("button", { name: "Request signature (MPC)" }).click();
    await expect(page.getByTestId("sign-status")).toContainText("Signed.", { timeout: 15_000 });
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /derived:yes;packed:yes;sign:answered/);
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
    await page.goto(`/lesson/${ID}?view=3d&step=1`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
    await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 1/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 1/);
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    await nextStep(page);
    await expect(caption).toHaveText(/^Fig\. 2/);
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "", { timeout: 10_000 });
    // The printed action still works.
    await page.getByRole("button", { name: "Derive Ethereum address" }).click();
    await expect(page.getByTestId("eth-address")).toHaveText(ADDRESS);
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
  });
});

// Opt-in: needs the real testnet. TESTNET=1 TESTNET_STORE=/path/outside/repo.json npx playwright test --grep @testnet
// Asks the real v1.signer-prod.testnet for one signature (1 yoctoNEAR). Nothing goes to Sepolia.
// Use --workers=1: tests that share one practice key must not send at the same time (nonces clash).
// The real signer usually answers in 7 to 14 s, but can take much longer, so the wait is generous.
test("@testnet signs with the real signing network and recovers the derived address", async ({ page }) => {
  test.skip(!process.env.TESTNET, "set TESTNET=1 to run against the real testnet");
  test.setTimeout(300_000);
  await seedPracticeAccount(page);
  await page.addInitScript(() => localStorage.setItem("bon:view", "2d"));
  await page.goto(`/lesson/${ID}?mode=testnet`);
  await expect(page.getByTestId("mode-pill")).toHaveText("Testnet", { timeout: 90_000 });
  // On a failure, say why: the problem the page shows and what the network answered.
  const notes: string[] = [];
  page.on("console", (m) => m.type() === "error" && notes.push(`console: ${m.text()}`));
  page.on("response", async (r) => {
    if (!r.url().includes("rpc")) return;
    const body = await r.text().catch(() => "");
    if (r.status() >= 400 || body.includes('"error"'))
      notes.push(`${r.status()} ${r.url()}: ${body.slice(0, 300)}`);
  });
  const address = await walk(page, 120_000).catch(async (e) => {
    const why = await page
      .getByTestId("problem")
      .textContent({ timeout: 1_000 })
      .catch(() => "none shown");
    throw new Error(`${(e as Error).message.split("\n")[0]} | problem: ${why} | ${notes.join(" || ")}`);
  });
  const record = await completionOf(page, ID);
  expect(record).toMatchObject({
    mode: "testnet",
    evidence: { derivedEthAddress: address, recoveredAddress: address, recoveredMatches: "true" },
  });
  console.log(`[4.1 testnet] evidence: ${JSON.stringify(record)}`);
});
