import { expect, test, type Page } from "@playwright/test";
import { nextStep, seedRoute } from "./lessons/helpers";

/**
 * The book scene's camera (scene-kit CameraRig + CameraControls), on lesson 0.1: the learner may turn,
 * zoom and slide the camera a little; their view stays across steps until Reset view; the Controls card
 * explains how. The stage exposes the rounded camera as data-camera-pose ("x,y,z@x,y,z").
 */
const ID = "l-0-1-blockchain-basics";
const LOAD_3D = 20_000;
test.describe.configure({ timeout: 60_000 });

const stage = (page: Page) => page.locator(".sk-stage");
type Pose = { pos: number[]; target: number[] };
async function pose(page: Page): Promise<Pose> {
  await expect(stage(page)).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
  const raw = (await stage(page).getAttribute("data-camera-pose")) ?? "";
  const [pos, target] = raw.split("@").map((s) => s.split(",").map(Number));
  return { pos: pos!, target: target! };
}
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

async function open(page: Page, step = 1) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedRoute(page);
  await page.goto(`/lesson/${ID}?view=3d&step=${step}`);
  await expect(stage(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
}

/** Drags on the canvas from its middle (left button turns, right button slides). */
async function drag(page: Page, dx: number, dy: number, button: "left" | "right" = "left") {
  const box = (await page.locator(".sk-stage canvas").boundingBox())!;
  const x = box.x + box.width * 0.6;
  const y = box.y + box.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down({ button });
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + (dx * i) / 12, y + (dy * i) / 12);
  await page.mouse.up({ button });
}

test("a plain click on the canvas leaves the camera to the steps", async ({ page }) => {
  await open(page);
  const before = await pose(page);
  const box = (await page.locator(".sk-stage canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.6);
  expect(dist((await pose(page)).pos, before.pos)).toBeLessThan(0.05);
  await expect(stage(page)).toHaveAttribute("data-camera-user", "off");
  await expect(page.getByTestId("reset-view")).toHaveCount(0);
});

test("a tap on an object that drifts a few pixels picks it and leaves the camera to the steps", async ({
  page,
}) => {
  await open(page);
  await pose(page);
  // The object's pick button sits under the canvas at the object's place on screen: press the canvas there.
  const target = (await page
    .getByRole("button", { name: "Open Ben's notebook", exact: true })
    .boundingBox())!;
  const x = target.x + target.width / 2;
  const y = target.y + target.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 2, y + 2);
  await page.mouse.move(x + 3, y);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
  await expect(stage(page)).toHaveAttribute("data-camera-user", "off");
  await expect(page.getByTestId("reset-view")).toHaveCount(0);
});

test("switching to 2D and back keeps the learner's view", async ({ page }) => {
  await open(page);
  await pose(page);
  await drag(page, 140, 30);
  await expect(stage(page)).toHaveAttribute("data-camera-user", "on");
  const mine = await pose(page);
  const views = page.getByRole("group", { name: "Scene view" });
  await views.getByRole("button", { name: "2D" }).click();
  await expect(page.locator(".sk-stage canvas")).toHaveCount(0);
  await views.getByRole("button", { name: "3D" }).click();
  await expect(stage(page)).toHaveAttribute("data-view", "3d", { timeout: LOAD_3D });
  await expect(stage(page)).toHaveAttribute("data-camera-user", "on");
  expect(dist((await pose(page)).pos, mine.pos)).toBeLessThan(0.05);
  await expect(page.getByTestId("reset-view")).toBeVisible();
});

test("the learner's view stays across a step, and Reset view brings the step's picture back", async ({
  page,
  browser,
}) => {
  await open(page);
  const start = await pose(page);
  await drag(page, 140, 30);
  await expect(stage(page)).toHaveAttribute("data-camera-user", "on");
  const mine = await pose(page);
  expect(dist(mine.pos, start.pos)).toBeGreaterThan(1);

  // Step 1's action, then the next step: the page turns, the camera stays where the learner left it.
  await page.getByRole("button", { name: "Open Ben's notebook", exact: true }).press("Enter");
  await nextStep(page);
  await expect(page.getByText(/^Step 2 of/).first()).toBeVisible();
  const kept = await pose(page);
  expect(dist(kept.pos, mine.pos)).toBeLessThan(0.05);
  await expect(stage(page)).toHaveAttribute("data-camera-user", "on");

  // Reset view glides back to step 2's own framing (the same as opening step 2 fresh).
  await page.getByTestId("reset-view").click();
  await expect(stage(page)).toHaveAttribute("data-camera-user", "off");
  await expect(page.getByTestId("reset-view")).toHaveCount(0);
  // The button went away with the learner's view: focus stays in the cluster, on Controls.
  await expect(page.getByRole("button", { name: "Controls" })).toBeFocused();
  const reset = await pose(page);
  expect(dist(reset.pos, mine.pos)).toBeGreaterThan(1);
  const fresh = await browser.newPage();
  await open(fresh, 2);
  const framed = await pose(fresh);
  expect(dist(reset.pos, framed.pos)).toBeLessThan(0.3);
  await fresh.close();
});

test("sliding the camera is held close to the figure", async ({ page }) => {
  await open(page);
  const start = await pose(page);
  const d = dist(start.pos, start.target);
  await drag(page, 1200, 700, "right");
  await drag(page, 1200, 700, "right");
  const slid = await pose(page);
  await expect(stage(page)).toHaveAttribute("data-camera-user", "on");
  const moved = dist(slid.target, start.target);
  expect(moved).toBeGreaterThan(0.2);
  // PAN_SHARE (15 %) of the camera's distance, with rounding slack.
  expect(moved).toBeLessThanOrEqual(d * 0.15 + 0.05);
});

test("Controls opens a card on how to move the camera; Esc and a press outside close it", async ({
  page,
}) => {
  await open(page);
  const controls = page.getByRole("button", { name: "Controls" });
  const card = page.getByRole("region", { name: "Camera controls" });
  await expect(controls).toHaveAttribute("aria-expanded", "false");
  await expect(card).toBeHidden();
  await controls.click();
  await expect(controls).toHaveAttribute("aria-expanded", "true");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Right-drag");
  await expect(card).toContainText("Drag with two fingers");
  await expect(card).toContainText("Reset view");
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(controls).toBeFocused();
  // Keyboard: Enter opens it again; a press outside closes it.
  await controls.press("Enter");
  await expect(card).toBeVisible();
  const box = (await page.locator(".sk-stage canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.75);
  await expect(card).toBeHidden();
  await expect(controls).toHaveAttribute("aria-expanded", "false");
});

test("the Controls card fits a phone screen", async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 780 });
  const controls = page.getByRole("button", { name: "Controls" });
  await controls.click();
  const card = page.getByRole("region", { name: "Camera controls" });
  await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(780);
});
