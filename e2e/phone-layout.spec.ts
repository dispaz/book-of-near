import { expect, test, type Page } from "@playwright/test";
import { seedRoute } from "./lessons/helpers";

// On a phone the scene must keep a usable share of the screen at every step, in 2D and 3D: the header
// (title + step heading) sits on top, the dock (step controls + explanation) and the stage bar at the
// bottom, and the scene draws in the band between them. LessonPage's layout is shared, so this walks
// every step of every lesson in stages 0 and 1.
const LESSONS = [
  "l-0-1-blockchain-basics",
  "l-0-2-make-a-wallet",
  "l-0-3-send-a-transaction",
  "l-1-1-claim-your-name",
  "l-1-2-function-call-key",
];
const PHONES = [
  { width: 390, height: 780, minShare: 0.38 },
  { width: 360, height: 640, minShare: 0.28 },
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
        test.slow();
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
    await expect(page.getByRole("textbox", { name: "Tell the agent what to do" })).toBeVisible();
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

  test("lesson 1.2: the prompt box shows its whole placeholder", async ({ page }) => {
    await page.goto("/lesson/l-1-2-function-call-key?view=2d&step=5");
    const input = page.getByRole("textbox", { name: "Tell the agent what to do" });
    const fits = await input.evaluate((el: HTMLInputElement) => {
      const c = document.createElement("canvas").getContext("2d")!;
      const s = getComputedStyle(el);
      c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const room = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      return c.measureText(el.placeholder).width <= room;
    });
    expect(fits).toBe(true);
  });
});

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
