import { readdirSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { CLAIMABLE_BADGES, STAGE_RULES } from "../src/badges/rules";
import { ANSWER_KEY } from "../src/exam/answerKey";
import { questionsFor } from "../src/exam/bank";
import { WALKS } from "./judge/walks";

/**
 * The judge's path (issue #31): what an AI reviewer does after `npm install && npm run dev`. One fresh
 * browser profile, demo mode, no wallet. It takes the opening quiz, opens every shipped lesson from the
 * contents and walks it to Finish in the 2D view, claims every claimable stage badge, checks My book and
 * the public checker, passes the final exam, and reaches the 2D/3D switch. The list reporter prints one line per lesson.
 *
 * Demo-mode parity: the whole run must make NO request outside the app's own origin (no RPC, Worker,
 * DefiLlama, NEAR AI or 1Click). Every outside request is blocked and recorded, and the test that made it
 * fails with its URL.
 *
 * Run it alone: `npm run verify:demo`. Adding a lesson is one line in `WALKS` (e2e/judge/walks.ts).
 */

const NO_3D = process.env.E2E_NO_3D === "1";

// One profile for the whole path: progress, badges and the chosen view carry from test to test.
test.describe.configure({ mode: "serial", timeout: 120_000 });

let context: BrowserContext;
let page: Page;
let origin: string;
const external: string[] = [];
const errors: string[] = [];

test.beforeAll(async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL!;
  origin = new URL(baseURL).origin;
  // A fresh profile, as a judge has: no progress, no route. Only the closed-book cover is skipped (the
  // e2e default), so the walks start on each lesson's first step.
  context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: "bon:cover", value: "off" }] }] },
  });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (new URL(url).origin === origin) return route.continue();
    external.push(url);
    return route.abort("blockedbyclient");
  });
  // The walks play the 2D view (the 3D view is checked at the end).
  // It runs on about:blank too (a new page, a popup), where localStorage throws: skip those.
  await context.addInitScript(() => {
    if (location.origin === "null") return;
    if (!localStorage.getItem("bon:view")) localStorage.setItem("bon:view", "2d");
  });
  // Web sockets skip context.route, so they are watched on every page of the context (popups too).
  // `vite preview` serves no hot-reload socket: any socket to another host is outside traffic.
  context.on("page", (p) => {
    p.on("websocket", (ws) => {
      if (new URL(ws.url()).host !== new URL(origin).host) external.push(ws.url());
    });
    p.on("pageerror", (e) => errors.push(e.message));
  });
  page = await context.newPage();
});

test.afterAll(() => context?.close());

// Each test owns the outside requests and page errors made while it ran.
let seen = 0;
let seenErrors = 0;
test.afterEach(async () => {
  // Let requests still in flight settle first, so they are blamed on this test, not the next one.
  await page.waitForLoadState("networkidle").catch(() => {});
  const mine = external.slice(seen);
  const myErrors = errors.slice(seenErrors);
  seen = external.length;
  seenErrors = errors.length;
  expect(mine, "requests that left the app's origin in demo mode").toEqual([]);
  expect(myErrors, "page errors").toEqual([]);
});

const contents = () => page.getByRole("navigation", { name: "Contents" });
const lessonLink = (id: string) => contents().locator(`a[href$="/lesson/${id}"]`).first();

test("a fresh profile takes the opening quiz and sees the contents with every lesson", async () => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Where should you start/ })).toBeVisible();
  await page.getByRole("radio", { name: "Never" }).check();
  await page.getByRole("radio", { name: "No, not yet" }).check();
  await page.getByRole("radio", { name: "I don't write code" }).check();
  await page.getByRole("button", { name: "Show my path" }).click();
  await expect(page.getByRole("heading", { name: "Newcomer path" })).toBeVisible();
  await page.getByRole("link", { name: "See the contents" }).click();
  await expect(page.getByRole("heading", { name: "Book of NEAR", level: 1 })).toBeVisible();

  // Every lesson folder on this branch has a walk below, and the contents links each of them.
  const shipped = readdirSync("src/content/lessons").filter((d) => /^l-\d+-\d+-/.test(d));
  expect(WALKS.map(([id]) => id).sort(), "lessons without a judge-path walk").toEqual(shipped.sort());
  for (const [id] of WALKS) await expect(lessonLink(id)).toBeVisible();
});

for (const [id, walk] of WALKS)
  test(`lesson ${id}: opens from the contents and walks to Finish (2D, demo mode)`, async () => {
    await page.goto("/");
    await lessonLink(id).click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${id}`));
    await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
    await walk(page);
    // The walk ran in the 2D view: no WebGL canvas was drawn.
    await expect(page.locator("canvas")).toHaveCount(0);
  });

const claimable = STAGE_RULES.map((r) => r.stage);

test(`claims the badges of stages ${claimable.join(", ")} in demo mode`, async () => {
  await page.goto("/");
  for (const n of claimable) {
    const box = page.getByRole("region", { name: `Stage ${n} badge` });
    await expect(box).toContainText("Your badge is ready");
    await box.getByRole("button", { name: `Claim the stage ${n} badge` }).click();
    await expect(box).toContainText(`Stage ${n} badge claimed`);
  }
});

test("My book shows every claimed badge, and the public checker agrees", async () => {
  await page.goto("/my-book");
  const shelf = page.getByRole("list", { name: "My badges" });
  for (const n of claimable) await expect(shelf.locator(`[data-stage="${n}"]`)).toContainText("Claimed");
  await expect(page.getByText(`${claimable.length} of ${CLAIMABLE_BADGES} claimed.`)).toBeVisible();

  await page.getByRole("link", { name: "Open in the badge checker" }).click();
  await expect(page).toHaveURL(/\/check/);
  await expect(page.getByRole("heading", { name: "Check anyone's badges" })).toBeVisible();
  const checked = page.getByRole("list", { name: /^Badges of / });
  for (const n of claimable) await expect(checked.locator(`[data-stage="${n}"]`)).toContainText("Claimed");

  // Anyone's badges, no login: another account holds none, and a bad name is refused.
  const account = page.getByRole("textbox", { name: "Account" });
  await account.fill("someone-else.testnet");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("someone-else.testnet holds no badges.")).toBeVisible();
  await account.fill("Not A Name");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("That is not a NEAR account name.");
});

test(`the final exam opens with the badges held, and all ${questionsFor("general").length} right answers pass it`, async () => {
  await page.goto("/");
  await page.getByRole("link", { name: "Final exam" }).click();
  await expect(page).toHaveURL(/\/exam/);
  await expect(page.getByRole("heading", { name: "The final exam" })).toBeVisible();
  // The general route needs the stage 0 to 2 badges, claimed above.
  const form = page.locator('form[data-exam-state="open"]');
  await expect(form).toBeVisible();
  const questions = questionsFor("general");
  await expect(form.locator("fieldset.quiz-q")).toHaveCount(questions.length);
  for (const q of questions)
    await form
      .locator(`fieldset[data-question="${q.id}"]`)
      .getByRole("radio", { name: q.options[ANSWER_KEY[q.id]!.answer], exact: true })
      .check();
  await page.getByRole("button", { name: "Hand in my answers" }).click();
  // Demo grading loads the answer key chunk from the app's own origin: the network guard allows it.
  await expect(page.locator(".exam-result")).toHaveAttribute("data-exam-state", "passed");
  await expect(page.getByRole("heading", { name: "You passed the final exam" })).toBeVisible();
  await expect(page.locator(".exam-result")).toContainText(
    `${questions.length} of ${questions.length} right`,
  );
});

// The title avoids the word "3D": E2E_NO_3D=1 leaves out tests named so, and this one has a no-WebGL branch.
test("the view switch is reachable on a lesson (without WebGL: 2D only, no switch)", async () => {
  test.slow(!NO_3D, "draws a 3D scene");
  await page.goto("/lesson/l-0-1-blockchain-basics");
  const scene = page.locator("[data-view]").first();
  const views = page.getByRole("group", { name: "Scene view" });
  if (NO_3D) {
    // E2E_NO_3D=1 switches WebGL off: the lesson falls back to 2D and offers no switch.
    await expect(scene).toHaveAttribute("data-view", "2d");
    await expect(views).toHaveCount(0);
    return;
  }
  await views.getByRole("button", { name: "3D" }).click();
  await expect(scene).toHaveAttribute("data-view", "3d", { timeout: 20_000 });
  await expect(page.locator(".book-scene canvas")).toHaveCount(1, { timeout: 20_000 });
  await views.getByRole("button", { name: "2D" }).click();
  await expect(scene).toHaveAttribute("data-view", "2d");
});

test("the whole path made no request outside the app's origin", () => {
  expect(external).toEqual([]);
});
