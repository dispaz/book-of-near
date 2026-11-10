import { expect, test, type Page } from "@playwright/test";
import { LOAD_3D, slow3d } from "./lessons/helpers";

const DEMO = "/lesson/scene-kit-demo";

// A returning visitor with a route sees the contents at "/" (new visitors get the opening quiz).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("bon:v1")) {
      localStorage.setItem(
        "bon:v1",
        JSON.stringify({ v: 1, route: "newcomer", completions: [], evidence: {} }),
      );
    }
  });
});
const state = (page: Page) => page.locator("[data-scene-state]");

/** Records every value data-scene-state takes, so a test can check what happened in between. */
async function recordStates(page: Page) {
  // Watch the whole document, not one element: under load React may swap the stage element (Suspense),
  // and an observer on the old element would miss every later state.
  await page.evaluate(() => {
    const w = window as unknown as { __states: string[] };
    const read = () => {
      for (const el of document.querySelectorAll("[data-scene-state]")) {
        const v = el.getAttribute("data-scene-state") ?? "";
        if (w.__states.at(-1) !== v) w.__states.push(v);
      }
    };
    w.__states = [];
    read();
    new MutationObserver(read).observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scene-state"],
      subtree: true,
      childList: true,
    });
  });
  return () => page.evaluate(() => (window as unknown as { __states: string[] }).__states);
}

test.describe("scene kit demo (3D)", () => {
  test.beforeEach(() => slow3d());

  test("draws the scene with WebGL and loads the 3D code only when the scene opens", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Book of NEAR", level: 1 })).toBeVisible();
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);

    await page.goto(DEMO);
    await expect(page.locator(".sk-stage canvas")).toBeVisible({ timeout: LOAD_3D });
    await expect(state(page)).toHaveAttribute("data-scene-state", /coin=ana/);
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(true);
  });

  test("the demo lesson is hidden from the contents", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Scene kit demo/ })).toHaveCount(0);
  });

  test("the Send coin button moves the coin to Ben and opens the gate", async ({ page }) => {
    await page.goto(`${DEMO}?step=3`);
    await expect(state(page)).toHaveAttribute("data-scene-state", /coin=ana/);
    const next = page.getByRole("button", { name: "Next step" });
    await expect(next).toBeDisabled();
    const states = await recordStates(page);
    await page.locator(".action-slot").getByRole("button", { name: "Send coin" }).click();
    await expect(state(page)).toHaveAttribute("data-scene-state", /coin=ben/);
    expect(await states()).toContainEqual(expect.stringMatching(/coin=moving/));
    await expect(next).toBeEnabled();
    await expect(page.locator(".action-slot").getByRole("button", { name: "Send coin" })).toHaveCount(0);
  });

  test("labelled buttons pick objects for keyboards and screen readers", async ({ page }) => {
    await page.goto(DEMO);
    const ben = page.getByRole("button", { name: "Ben's account" });
    await expect(ben).toHaveAttribute("aria-pressed", "false");
    await ben.press("Enter");
    await expect(state(page)).toHaveAttribute("data-scene-state", /selected=ben/);
    await expect(ben).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("scene-status")).toContainText("Ben");
    await page.getByRole("button", { name: "Ana's account" }).press("Enter");
    await expect(state(page)).toHaveAttribute("data-scene-state", /selected=ana/);
  });

  test("a click on a block picks it, a drag turns the camera instead", async ({ page }) => {
    await page.goto(DEMO);
    const ben = page.getByRole("button", { name: "Ben's account" });
    const stage = page.locator(".sk-stage");
    // Let the camera settle on the step's preset view.
    await expect(stage).toHaveAttribute("data-camera", "still");
    const box = (await ben.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 10, { steps: 6 });
    await page.mouse.up();
    await expect(state(page)).toHaveAttribute("data-scene-state", /selected=none/);

    // Wait for the camera to come to rest again, then click where the block now is.
    await expect(stage).toHaveAttribute("data-camera", "still");
    const box2 = (await ben.boundingBox())!;
    await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await expect(state(page)).toHaveAttribute("data-scene-state", /selected=ben/);
  });

  test("the Flat view pill switches to the top-down camera", async ({ page }) => {
    await page.goto(DEMO);
    const flat = page.getByRole("button", { name: "Flat view" });
    await flat.click();
    await expect(flat).toHaveAttribute("aria-pressed", "true");
    await expect(state(page)).toHaveAttribute("data-scene-state", /view=flat/);
    await flat.click();
    await expect(state(page)).toHaveAttribute("data-scene-state", /view=3d/);
  });

  test("with reduced motion the coin jumps straight to Ben", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${DEMO}?step=3`);
    await expect(page.locator(".sk-stage canvas")).toBeVisible({ timeout: LOAD_3D });
    await expect(state(page)).toHaveAttribute("data-scene-state", /coin=ana/);
    const states = await recordStates(page);
    await page.locator(".action-slot").getByRole("button", { name: "Send coin" }).click();
    await expect(state(page)).toHaveAttribute("data-scene-state", /coin=ben/);
    expect(await states()).not.toContainEqual(expect.stringMatching(/coin=moving/));
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
    await ctx.close();
  });
});

test.describe("scene kit demo (fallback)", () => {
  test("?webgl=0 shows the flat drawing with the same captions and actions", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
    });
    await page.goto(`${DEMO}?webgl=0`);
    await expect(page.locator(".sk-svg-stage svg")).toBeVisible();
    await expect(page.locator(".sk-stage canvas")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Flat view" })).toHaveCount(0);
    await expect(page.getByTestId("caption")).toHaveText(/This block is an account/);
    await page.getByText("Read as text").click();
    await expect(page.locator(".read-as-text li")).toHaveCount(4);

    await page.getByRole("button", { name: "Ben's account" }).click();
    await expect(state(page)).toHaveAttribute("data-scene-state", /selected=ben/);

    // Steps 1 and 2 have no gate, so Next walks straight to step 3 without a reload.
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await page.locator(".action-slot").getByRole("button", { name: "Send coin" }).click();
    await expect(state(page)).toHaveAttribute("data-scene-state", /coin=ben/);
    await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
  });

  test("the fallback honours reduced motion too", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${DEMO}?webgl=0&step=3`);
    await expect(state(page)).toHaveAttribute("data-scene-state", /coin=ana/);
    const states = await recordStates(page);
    await page.locator(".action-slot").getByRole("button", { name: "Send coin" }).click();
    await expect(state(page)).toHaveAttribute("data-scene-state", /coin=ben/);
    expect(await states()).not.toContainEqual(expect.stringMatching(/coin=moving/));
    await ctx.close();
  });
});
