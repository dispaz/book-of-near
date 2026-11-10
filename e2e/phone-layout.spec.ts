import { expect, test, type Page } from "@playwright/test";
import { seedRoute, slow3d } from "./lessons/helpers";

// On a phone the scene must keep a usable share of the screen at every step, in 2D and 3D: the header
// (title + step heading) sits on top, the dock (step controls + explanation) and the stage bar at the
// bottom, and the scene draws in the band between them. LessonPage's layout is shared, so this walks
// every step of every lesson in stages 0 and 1, before and after the step's own button is pressed
// (results, errors and the finished state appear in the dock and the band too).
const LESSONS = [
  "l-0-1-blockchain-basics",
  "l-0-2-make-a-wallet",
  "l-0-3-send-a-transaction",
  "l-1-1-claim-your-name",
  "l-1-2-function-call-key",
  "l-1-3-inside-a-transaction",
];
const PHONES = [
  // Measured worst cases: 39% and 28%. The thresholds leave a little headroom.
  { width: 390, height: 780, minShare: 0.36 },
  { width: 360, height: 640, minShare: 0.26 },
];

test.beforeEach(({ page }) => seedRoute(page));

/** The free band between the step heading and the dock (or the stage bar when the dock is empty). */
function band(page: Page) {
  return page.evaluate(() => {
    const r = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
    const head = r(".step-head")!;
    const dock = r(".lesson-dock");
    const bar = r(".stage-bar")!;
    const top = dock && dock.height > 0 ? dock.top : bar.top;
    return { top: head.bottom, bottom: top, height: top - head.bottom };
  });
}

for (const phone of PHONES) {
  for (const id of LESSONS) {
    for (const view of ["2d", "3d"] as const) {
      test(`${id} ${view} keeps the scene in view at ${phone.width}x${phone.height}`, async ({ page }) => {
        slow3d();
        await page.setViewportSize({ width: phone.width, height: phone.height });
        await page.goto(`/lesson/${id}?view=${view}&step=2`);
        const count = Number((await page.locator(".step-label").textContent())!.match(/of (\d+)/)![1]);
        const short: string[] = [];
        for (let s = 1; s <= count; s++) {
          await page.goto(`/lesson/${id}?view=${view}&step=${s}`);
          await expect(page.locator(".step-label")).toContainText(`Step ${s} of`);
          // Let the dock settle (step controls portal in after the scene mounts).
          await page.waitForTimeout(300);
          const b = await band(page);
          if (b.height < phone.height * phone.minShare) short.push(`step ${s}: ${Math.round(b.height)}px`);
          // Press the step's own button (an action, or Finish) when it is ready, then measure again.
          const action = page.locator(".lesson-dock button.btn.primary:enabled").first();
          if (await action.count()) {
            await action.click();
            await page.waitForTimeout(1500);
            const a = await band(page);
            if (a.height < phone.height * phone.minShare)
              short.push(`step ${s} after its button: ${Math.round(a.height)}px`);
          }
        }
        expect(short, `scene band under ${phone.minShare * 100}% of the screen`).toEqual([]);
      });
    }
  }
}

/**
 * True when nothing covers the visible part of the element (its corners and centre, clipped to the
 * viewport), and that visible part is at least `minH` pixels tall (or the whole element).
 */
function readable(page: Page, testId: string, minH: number) {
  return page.getByTestId(testId).evaluate((el, minH) => {
    const r = el.getBoundingClientRect();
    const top = Math.max(r.top, 0);
    const bottom = Math.min(r.bottom, window.innerHeight);
    const pts: [number, number][] = [
      [r.left + 4, top + 4],
      [r.right - 4, top + 4],
      [r.left + 4, bottom - 4],
      [r.right - 4, bottom - 4],
      [(r.left + r.right) / 2, (top + bottom) / 2],
    ];
    const clear = pts.every(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && (el === hit || el.contains(hit));
    });
    return clear && bottom - top >= Math.min(r.height, minH) - 1;
  }, minH);
}

test.describe("phone: result cards are readable", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("lesson 1.1: the Created card is fully visible after creating the name (2D)", async ({ page }) => {
    await page.goto("/lesson/l-1-1-claim-your-name?view=2d&step=3");
    await page.getByRole("textbox", { name: "Account name" }).fill("ana-phone");
    await page.getByRole("button", { name: "Next step" }).click();
    await page
      .locator(".action-slot")
      .getByRole("button", { name: /^Create / })
      .click();
    await expect(page.getByTestId("new-account-id")).toHaveText("ana-phone.testnet", { timeout: 30_000 });
    // The card is a real card, not a sliver: a good part of it shows at once, and every field can be
    // scrolled into view without the dock or the stage bar covering it.
    await page.getByTestId("created-card").scrollIntoViewIfNeeded();
    expect(await readable(page, "created-card", 200)).toBe(true);
    for (const field of ["new-account-id", "create-tx-hash", "new-account-key"]) {
      await page.getByTestId(field).scrollIntoViewIfNeeded();
      expect(await readable(page, field, 20), field).toBe(true);
    }
  });

  test("the explanation folds to a short note and opens on demand", async ({ page }) => {
    await page.goto("/lesson/l-1-2-function-call-key?view=2d&step=5");
    const note = page.getByTestId("explain");
    const more = page.getByRole("button", { name: "Read more" });
    await expect(more).toBeVisible();
    // Let the dock settle: the step's form portals in and the web fonts load.
    await expect(page.getByRole("group", { name: "Misuse the app's key" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const folded = (await note.boundingBox())!.height;
    const dockTop = (await page.locator(".lesson-dock").boundingBox())!.y;
    await more.click();
    await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
    expect((await note.boundingBox())!.height).toBeGreaterThan(folded + 20);
    // Opening it does not push the scene around: it lies over the scene like a sheet.
    expect(Math.abs((await page.locator(".lesson-dock").boundingBox())!.y - dockTop)).toBeLessThan(1);
    await page.getByRole("button", { name: "Show less" }).click();
    await expect(more).toBeVisible();
  });

  test("the open note leaves the step's controls and heading uncovered", async ({ page }) => {
    // Step 3: its controls (the allowance and "Give the app a key") work without an earlier step.
    await page.goto("/lesson/l-1-2-function-call-key?view=2d&step=3");
    await expect(page.getByRole("button", { name: "Give the app a key" })).toBeVisible();
    await page.getByRole("button", { name: "Read more" }).click();
    const sheet = page.locator(".note.docked.open");
    await expect(sheet).toBeVisible();
    const geo = await page.evaluate(() => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const free = (el: Element) => {
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
        return !!hit && (el === hit || el.contains(hit));
      };
      const controls = [...document.querySelectorAll(".action-slot input, .action-slot button")];
      return {
        sheet: r(".note.docked.open"),
        head: r(".step-head"),
        lesson: r(".lesson"),
        covered: controls.filter((c) => !free(c)).map((c) => c.outerHTML.slice(0, 60)),
      };
    });
    expect(geo.covered).toEqual([]);
    expect(geo.sheet.top).toBeGreaterThanOrEqual(geo.head.bottom);
    expect(geo.sheet.top).toBeGreaterThanOrEqual(geo.lesson.top);
    expect(geo.sheet.bottom).toBeLessThanOrEqual(geo.lesson.bottom);
    // The controls still work with the note open.
    await page.getByRole("button", { name: "Give the app a key" }).click();
    await expect(page.locator("[data-scene-state]").first()).toHaveAttribute(
      "data-scene-state",
      /key:active/,
      {
        timeout: 15_000,
      },
    );
  });

  test("Escape or a tap outside closes the open note, and focus comes back", async ({ page }) => {
    await page.goto("/lesson/l-1-1-claim-your-name?view=2d&step=2");
    const more = page.getByRole("button", { name: "Read more" });
    await more.click();
    const less = page.getByRole("button", { name: "Show less" });
    await expect(less).toBeFocused();
    const controls = await less.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    await expect(page.locator(`[id="${controls}"]`)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(more).toBeVisible();
    await expect(more).toBeFocused();
    await more.click();
    await expect(less).toBeVisible();
    await page.mouse.click(195, 300);
    await expect(more).toBeVisible();
  });

  test("the header: full title on tap, the action name kept for screen readers, Escape closes Read as text", async ({
    page,
  }) => {
    await page.goto("/lesson/l-0-1-blockchain-basics?view=2d&step=2");
    const h1 = page.locator(".lesson-title h1");
    const cut = () => h1.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(await cut()).toBe(true);
    await h1.click();
    expect(await cut()).toBe(false);
    await page.goto("/lesson/l-1-2-function-call-key?view=2d&step=3");
    const what = page.locator(".step-label .your-turn-what");
    await expect(what).toHaveText(/: give the app a key/i);
    expect(await what.evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
    await page.getByText("Read as text").click();
    await expect(page.locator(".read-as-text")).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(page.locator(".read-as-text")).not.toHaveAttribute("open", "");
  });

  test("lesson 1.2: the misuse buttons show their whole labels", async ({ page }) => {
    await page.goto("/lesson/l-1-2-function-call-key?view=2d&step=5");
    const group = page.getByRole("group", { name: "Misuse the app's key" });
    await expect(group.getByRole("button")).toHaveCount(3);
    const cut = await group
      .getByRole("button")
      .evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
      );
    expect(cut).toEqual([]);
  });
});

// Lesson 1.3's builder only shows once the workshop account exists, so opening a step by URL does not
// draw it: walk there and check the band with the builder at its tallest (four rows, "break it" step).
for (const phone of PHONES) {
  for (const view of ["2d", "3d"] as const) {
    test(`l-1-3-inside-a-transaction ${view}: the builder leaves the scene its band at ${phone.width}x${phone.height}`, async ({
      page,
    }) => {
      slow3d();
      await page.setViewportSize({ width: phone.width, height: phone.height });
      await page.goto(`/lesson/l-1-3-inside-a-transaction?view=${view}&step=2`);
      const scene = page.locator("[data-scene-state]").first();
      const next = page.getByRole("button", { name: "Next step" });
      await page.getByRole("button", { name: "Make the workshop account" }).click();
      await expect(scene).toHaveAttribute("data-scene-state", /parent:yes/, { timeout: 30_000 });
      await next.click();
      for (const a of ["Create account", "Send NEAR", "Add a key"])
        await page.getByRole("button", { name: `Add: ${a}` }).click();
      const b3 = await band(page);
      await page.getByRole("button", { name: "Send the batch" }).click();
      await expect(scene).toHaveAttribute("data-scene-state", /batch:ok/, { timeout: 30_000 });
      await next.click();
      await expect(
        page.getByRole("list", { name: "Actions in this transaction" }).getByRole("listitem"),
      ).toHaveCount(4);
      await page.waitForTimeout(300);
      const b4 = await band(page);
      const short = [b3, b4]
        .map((b, i) => ({ step: i + 3, h: b.height }))
        .filter((b) => b.h < phone.height * phone.minShare)
        .map((b) => `step ${b.step}: ${Math.round(b.h)}px`);
      expect(short, `scene band under ${phone.minShare * 100}% of the screen`).toEqual([]);
    });
  }
}

test.describe("desktop is unchanged", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the docked explanation is not folded on wide screens", async ({ page }) => {
    await page.goto("/lesson/l-1-2-function-call-key?view=2d&step=5");
    await expect(page.getByTestId("explain")).toBeVisible();
    await expect(page.getByRole("button", { name: "Read more" })).toHaveCount(0);
  });

  test("the margin note's arrow goes around the scene's objects and labels", async ({ page }) => {
    // Lesson 1.1, 3D, step 3: the note points at the new name on the right, past "you" and the
    // registrar and their labels. The arrow must not run through them.
    await page.goto("/lesson/l-1-1-claim-your-name?view=3d&step=3");
    const arrow = page.locator(".note-arrow path").nth(1);
    await expect(arrow).toBeAttached({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    const crossings = await arrow.evaluate((path: SVGPathElement) => {
      const svg = path.ownerSVGElement!.getBoundingClientRect();
      const target = document.querySelector('[data-explain="name-box"]')!;
      const others = [...document.querySelectorAll("[data-explain]")]
        .filter((o) => o !== target)
        .map((o) => o.getBoundingClientRect());
      const len = path.getTotalLength();
      const hits: string[] = [];
      for (let i = 2; i < 18; i++) {
        const p = path.getPointAtLength((len * i) / 20);
        const x = svg.left + p.x;
        const y = svg.top + p.y;
        // Each 3D object is marked by a small anchor at its centre; the cubes are about 70px across.
        const near = (r: DOMRect) =>
          Math.abs(x - (r.left + r.right) / 2) < 36 && Math.abs(y - (r.top + r.bottom) / 2) < 36;
        if (others.some(near)) hits.push(`object at ${Math.round(x)},${Math.round(y)}`);
        const hit = document.elementFromPoint(x, y);
        const text = [...(hit?.childNodes ?? [])].some((n) => n.nodeType === 3 && n.textContent!.trim());
        if (text)
          hits.push(`"${hit!.textContent!.trim().slice(0, 20)}" at ${Math.round(x)},${Math.round(y)}`);
      }
      return hits;
    });
    expect(crossings).toEqual([]);
  });
});
