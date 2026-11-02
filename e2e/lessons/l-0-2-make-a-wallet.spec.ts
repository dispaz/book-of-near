import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, nextStep, seedRoute } from "./helpers";

// Walks lesson 0.2 in demo mode (no wallet, no network). Demo mode uses the public example key from
// docs.near.org, so the values below are public and stable.
const ID = "l-0-2-make-a-wallet";
const TITLE = "Make a wallet";
const STAGE = 0;
const DEMO_WORDS = "kit creek invite deputy fetch resource marble sweet camp thumb mushroom swift"; // secret-scan:allow public demo key from docs.near.org
const DEMO_PUBLIC = "ed25519:Ex4stLtTe43ynFmxGweGzMWLvRmRSUP6EjU6nvAdY2vg";
const DEMO_SECRET_PREFIX = "ed25519:5uJtH8hd"; // start of the public demo secret key
const DEMO_IMPLICIT = "cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5";

test.beforeEach(({ page }) => seedRoute(page));

const scene = (page: Page) => page.locator("[data-scene-state]").first();
const panel = (page: Page) => page.getByRole("region", { name: "Practice wallet" });

/** Walks from step 1 to the Honest take. Checks every gate on the way. */
async function walk(page: Page) {
  const next = page.getByRole("button", { name: "Next step" });

  // 1. Warning first: no key exists, Next is locked until the box is ticked.
  await expect(page.getByRole("heading", { name: /Never type a real seed phrase/ })).toBeVisible();
  await expect(scene(page)).toHaveAttribute("data-scene-state", "warning");
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: /these keys are for practice only/ }).check();
  await nextStep(page);

  // 2. Generate. The secret key is masked until "Show" is pressed.
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", "keys");
  await expect(panel(page).getByText("Throwaway practice key")).toBeVisible();
  await expect(panel(page).getByTestId("public-key")).toHaveText(DEMO_PUBLIC);
  await expect(panel(page).getByTestId("secret-key")).not.toContainText(DEMO_SECRET_PREFIX);
  await panel(page).getByRole("button", { name: "Show private key" }).click();
  await expect(panel(page).getByTestId("secret-key")).toContainText(DEMO_SECRET_PREFIX);
  await panel(page).getByRole("button", { name: "Hide private key" }).click();
  await expect(panel(page).getByTestId("secret-key")).not.toContainText(DEMO_SECRET_PREFIX);
  await expect(panel(page).getByTestId("network-count")).toHaveText("0");
  await nextStep(page);

  // 3. Seed phrase → rebuild the same key.
  await expect(panel(page).getByTestId("seed-words")).toHaveText(
    new RegExp(DEMO_WORDS.split(" ").join(".*")),
  );
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Rebuild from words" }).click();
  await expect(panel(page).getByTestId("rebuilt-key")).toHaveText(DEMO_PUBLIC);
  await nextStep(page);

  // 4. Public key → implicit account (hex).
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Turn it into an address" }).click();
  await expect(panel(page).getByTestId("implicit-account")).toHaveText(DEMO_IMPLICIT, { timeout: 10_000 });
  await nextStep(page);

  // 5. Compare address styles: flip all three cards.
  await expect(next).toBeDisabled();
  await expect(panel(page).getByTestId("eth-address")).toHaveText(/^0x[0-9a-fA-F]{40}$/);
  await expect(panel(page).getByTestId("implicit-front")).toHaveText(DEMO_IMPLICIT);
  await expect(panel(page).getByTestId("named-front")).toHaveText("ana.testnet");
  const show = panel(page).getByRole("button", { name: /^Show the .* rule$/ });
  await expect(show).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(next).toBeDisabled();
    await show.first().click();
  }
  await expect(panel(page).getByText(/last 20 bytes/)).toBeVisible();
  await nextStep(page);

  // 6. Sign.
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("Hello from Book of NEAR");
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(panel(page).getByTestId("signature")).toHaveText(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/);
  await expect(scene(page)).toHaveAttribute("data-scene-state", "signed");
  await nextStep(page);

  // 7. Verify passes, then one changed letter makes it fail.
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(panel(page).getByRole("status")).toHaveText(/Signature matches this message/);
  await expect(next).toBeDisabled();
  await page.getByRole("textbox", { name: "Message to check" }).fill("Hellp from Book of NEAR");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(panel(page).getByRole("status")).toHaveText(/Signature does not match this message/);
  await expect(scene(page)).toHaveAttribute("data-scene-state", "tamper-caught");
  await nextStep(page);

  // 8. Throw the keys away.
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Throw the keys away" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", "cleared");
  await expect(page.getByText(DEMO_PUBLIC)).toHaveCount(0);
  await nextStep(page);

  // 9. Check: one wrong answer first, to see the explanation.
  const check = page.getByRole("region", { name: "Quick check" });
  await check
    .getByRole("radiogroup")
    .nth(0)
    .getByRole("radio", { name: /Paste it; the site only reads it/ })
    .check();
  await check.getByRole("button", { name: "Check answers" }).click();
  await expect(check.getByText(/whoever sees the phrase can rebuild your keys/i)).toBeVisible();
  await expect(next).toBeDisabled();
  await answerCheck(page, [
    "Close the page. Real wallets never need your seed phrase on a website.",
    "Verification fails, because the signature no longer matches the message.",
    "The 32-byte ed25519 public key written as 64 hex characters.",
  ]);
  await nextStep(page);

  // 10. Honest take, then Finish.
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest.getByText(/Implicit addresses are long/)).toBeVisible();
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

/** No key, seed word or address may ever reach storage or the completion record. */
async function expectNoSecretsStored(page: Page) {
  const stored = await page.evaluate(
    () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
  );
  for (const s of [DEMO_WORDS, "mushroom", DEMO_PUBLIC, DEMO_SECRET_PREFIX, DEMO_IMPLICIT]) {
    expect(stored).not.toContain(s);
  }
}

const VIEWS = ["2d", "3d"] as const;
type View = (typeof VIEWS)[number];

/** Opens the lesson in one view. In 3D, waits until the lazy 3D chunk has drawn the canvas. */
async function open(page: Page, view: View, query = "") {
  await page.goto(`/lesson/${ID}?view=${view}${query ? `&${query}` : ""}`);
  await expectView(page, view);
}

async function expectView(page: Page, view: View) {
  await expect(
    page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: view.toUpperCase() }),
  ).toHaveAttribute("aria-pressed", "true");
  if (view === "3d") await expect(page.locator(".sk-stage canvas")).toBeVisible();
  else {
    await expect(page.locator(".sk-stage")).toHaveCount(0);
    await expect(page.locator(".wallet-scene")).toHaveClass(/view-2d/);
  }
}

/** Collects the JavaScript the page downloads, to check where three.js loads. */
function collectScripts(page: Page) {
  const scripts: string[] = [];
  page.on("response", async (r) => {
    if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
  });
  return scripts;
}

test.describe(`lesson ${ID}`, () => {
  test("is in the contents and walks to Finish in demo mode", async ({ page }) => {
    test.slow(); // wide screens open in 3D by default
    await page.goto("/");
    await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
    await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
    await walk(page);
    const record = await completionOf(page, ID);
    expect(record).toMatchObject({ stage: STAGE, mode: "demo" });
    expect(JSON.stringify(record)).not.toMatch(/ed25519|mushroom|cf4342/);
    await expectNoSecretsStored(page);
  });

  for (const view of VIEWS) {
    test.describe(`in ${view}`, () => {
      // Headless Chromium draws WebGL in software (SwiftShader): a full 3D walk needs more time.
      test.beforeEach(() => test.slow(view === "3d", "software WebGL"));
      test("walks to Finish without storing a secret", async ({ page }) => {
        await open(page, view);
        await walk(page);
        expect(await completionOf(page, ID)).toMatchObject({ stage: STAGE, mode: "demo" });
        await expectNoSecretsStored(page);
      });

      test("works offline and sends no network request after the lesson loads", async ({ page, context }) => {
        // The 3D view is a lazy chunk from this site: it loads with the lesson, before going offline.
        await open(page, view);
        await expect(scene(page)).toHaveAttribute("data-scene-state", "warning");
        await page.waitForLoadState("networkidle");
        const requests: { method: string; url: string; body: string | null }[] = [];
        page.on("request", (r) => requests.push({ method: r.method(), url: r.url(), body: r.postData() }));
        await context.setOffline(true);
        await walk(page);
        // The browser may still fetch a font file it had not needed yet (for example the italic in the
        // Honest take). That is a static file from this site and sends nothing. Anything else fails.
        const origin = new URL(page.url()).origin;
        const lazyFont = (r: (typeof requests)[number]) =>
          r.method === "GET" && r.url.startsWith(`${origin}/assets/`) && /\.woff2?$/.test(r.url);
        expect(requests.filter((r) => !lazyFont(r))).toEqual([]);
        expect(requests.every((r) => r.body === null)).toBe(true);
        await expectNoSecretsStored(page);
      });

      test("walks with reduced motion", async ({ browser }) => {
        const context = await browser.newContext({ reducedMotion: "reduce" });
        const page = await context.newPage();
        await seedRoute(page);
        await open(page, view);
        await walk(page);
        expect(await completionOf(page, ID)).toMatchObject({ stage: STAGE });
        await context.close();
      });

      test("walks on a phone-sized screen", async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 760 } });
        const page = await context.newPage();
        await seedRoute(page);
        await open(page, view);
        await walk(page);
        expect(await completionOf(page, ID)).toMatchObject({ stage: STAGE });
        await context.close();
      });
    });
  }

  test("Generate stays locked until the warning is acknowledged", async ({ page }) => {
    await page.goto(`/lesson/${ID}?step=2`);
    await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeDisabled();
    await expect(scene(page)).toHaveAttribute("data-scene-state", "warning");
    await panel(page).getByRole("button", { name: "Go to the warning" }).click();
    await page.getByRole("checkbox", { name: /these keys are for practice only/ }).check();
    await nextStep(page);
    await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeEnabled();
  });

  test("makes a fresh random phrase that rebuilds the same key", async ({ page }) => {
    await page.goto(`/lesson/${ID}`);
    await page.getByRole("checkbox", { name: /these keys are for practice only/ }).check();
    await nextStep(page);
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await panel(page).getByRole("button", { name: "Make a random key instead" }).click();
    const pub = panel(page).getByTestId("public-key");
    await expect(pub).not.toHaveText(DEMO_PUBLIC);
    await expect(pub).toHaveText(/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/);
    const fresh = await pub.textContent();
    await nextStep(page);
    await expect(panel(page).getByTestId("seed-words").getByRole("listitem")).toHaveCount(12);
    await expect(panel(page).getByTestId("seed-words")).not.toHaveText(
      new RegExp(DEMO_WORDS.split(" ").join(".*")),
    );
    await page.getByRole("button", { name: "Rebuild from words" }).click();
    await expect(panel(page).getByTestId("rebuilt-key")).toHaveText(fresh!);
  });

  test("testnet mode makes a random key, not the docs example", async ({ page }) => {
    await page.goto(`/lesson/${ID}?mode=testnet`);
    await page.getByRole("checkbox", { name: /these keys are for practice only/ }).check();
    await nextStep(page);
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    const pub = panel(page).getByTestId("public-key");
    await expect(pub).toHaveText(/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/);
    await expect(pub).not.toHaveText(DEMO_PUBLIC);
    await expect(panel(page).getByText(/printed in NEAR's docs/)).toHaveCount(0);
  });

  test("switching 2D → 3D → 2D mid-lesson keeps keys, values and open gates", async ({ page }) => {
    test.slow();
    await open(page, "2d");
    const next = page.getByRole("button", { name: "Next step" });
    await page.getByRole("checkbox", { name: /these keys are for practice only/ }).check();
    await nextStep(page);
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await nextStep(page);
    await page.getByRole("button", { name: "Rebuild from words" }).click();
    await nextStep(page);
    await page.getByRole("button", { name: "Turn it into an address" }).click();
    await expect(panel(page).getByTestId("implicit-account")).toHaveText(DEMO_IMPLICIT, { timeout: 10_000 });
    await nextStep(page);
    for (let i = 0; i < 3; i++)
      await panel(page)
        .getByRole("button", { name: /^Show the .* rule$/ })
        .first()
        .click();
    await nextStep(page);
    await page.getByRole("textbox", { name: "Message" }).fill("Pay Ben 5 NEAR");
    await page.getByRole("button", { name: "Sign", exact: true }).click();
    const signature = await panel(page).getByTestId("signature").textContent();
    await expect(next).toBeEnabled();

    // Gate passed in 2D. Switch to 3D: same step, same values, gate still open.
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await expectView(page, "3d");
    await expect(page).toHaveURL(/step=6/);
    await expect(next).toBeEnabled();
    await expect(scene(page)).toHaveAttribute("data-scene-state", "signed");
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("Pay Ben 5 NEAR");
    await expect(panel(page).getByTestId("signature")).toHaveText(signature!);
    await expect(page.locator(".sk-overlay")).toContainText("Pay Ben 5 NEAR");

    // Earlier gates stay open too: go back two steps and forward again without redoing anything.
    await page.getByRole("button", { name: "Previous step" }).click();
    await expect(next).toBeEnabled();
    await expect(panel(page).getByTestId("implicit-front")).toHaveText(DEMO_IMPLICIT);
    await nextStep(page);

    // Verify in 3D, then switch back to 2D: the verdict and the gate survive.
    await nextStep(page);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(panel(page).getByRole("status")).toHaveText(/Signature matches this message/);
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expectView(page, "2d");
    await expect(scene(page)).toHaveAttribute("data-scene-state", "verified-pass");
    await expect(panel(page).getByRole("status")).toHaveText(/Signature matches this message/);
    await expect(next).toBeDisabled();
    await page.getByRole("textbox", { name: "Message to check" }).fill("Pay Ben 6 NEAR");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", "tamper-caught");
    await expect(next).toBeEnabled();
    await expectNoSecretsStored(page);
  });

  test("3D objects are pickable and drive the same lesson state", async ({ page }) => {
    test.slow();
    await open(page, "3d");
    const overlay = page.locator(".sk-overlay");
    const pick = (name: string) => overlay.getByRole("button", { name, exact: true });
    const next = page.getByRole("button", { name: "Next step" });
    await page.getByRole("checkbox", { name: /these keys are for practice only/ }).check();
    await nextStep(page);
    await page.getByRole("button", { name: "Generate", exact: true }).click();

    // The private key stays masked in 3D labels too, until the learner reveals it.
    await expect(overlay).toContainText("Private key");
    await expect(overlay).toContainText("ed25519:••••");
    await expect(overlay).not.toContainText(DEMO_SECRET_PREFIX.slice(0, 15));
    await pick("Show the private key").press("Enter");
    await expect(panel(page).getByTestId("secret-key")).toContainText(DEMO_SECRET_PREFIX);
    await expect(overlay).toContainText(DEMO_SECRET_PREFIX.slice(0, 15));
    await pick("Hide the private key").press("Enter");
    await expect(overlay).not.toContainText(DEMO_SECRET_PREFIX.slice(0, 15));
    await nextStep(page);

    // The seed words rebuild the key when picked.
    await pick("Seed words: rebuild the key").press("Enter");
    await expect(panel(page).getByTestId("rebuilt-key")).toHaveText(DEMO_PUBLIC);
    await nextStep(page);
    await page.getByRole("button", { name: "Turn it into an address" }).click();
    await expect(panel(page).getByTestId("implicit-account")).toHaveText(DEMO_IMPLICIT, { timeout: 10_000 });
    await nextStep(page);

    // Three address blocks side by side: picking each shows its rule and opens the gate.
    for (const name of [
      "Ethereum address block",
      "NEAR implicit account block",
      "NEAR named account block",
    ]) {
      await expect(next).toBeDisabled();
      await pick(name).press("Enter");
      await expect(pick(name)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(panel(page).getByText(/last 20 bytes/)).toBeVisible();
    await nextStep(page);

    // The key stamps the card.
    await pick("Sign with the private key").press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", "signed");
    await expect(overlay).toContainText("signature");
    await nextStep(page);

    // Verify, then let the card change one letter: the seal cracks.
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(overlay).toContainText("Signature matches");
    await pick("Change one letter on the card").press("Enter");
    await expect(page.getByRole("textbox", { name: "Message to check" })).not.toHaveValue(
      "Hello from Book of NEAR",
    );
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(overlay).toContainText("Does not match");
    await expect(scene(page)).toHaveAttribute("data-scene-state", "tamper-caught");
    await nextStep(page);

    // The bin takes the keys away.
    await pick("Drop the keys in the bin").press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", "cleared");
    await expect(overlay).toContainText("Keys thrown away");
    await expect(overlay).not.toContainText("Private key");
    await expect(next).toBeEnabled();
    await expectNoSecretsStored(page);
  });

  test("2D never downloads three.js; 3D loads it lazily", async ({ page }) => {
    const scripts = collectScripts(page);
    await open(page, "2d");
    await page.waitForLoadState("networkidle");
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await expectView(page, "3d");
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(true);
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    const scripts = collectScripts(page);
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expect(scene(page)).toHaveAttribute("data-scene-state", "warning");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await expect(page.locator(".sk-stage")).toHaveCount(0);
    await page.getByRole("checkbox", { name: /these keys are for practice only/ }).check();
    await nextStep(page);
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(panel(page).getByTestId("public-key")).toHaveText(DEMO_PUBLIC);
    await page.waitForLoadState("networkidle");
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
  });
});
