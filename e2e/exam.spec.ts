import { base58 } from "@scure/base";
import { expect, test, type Page } from "@playwright/test";
import { ANSWER_KEY, ANSWER_KEY_MARK } from "../src/exam/answerKey";
import { questionsFor } from "../src/exam/bank";

// The final exam in demo mode (issue #28): no wallet, no network. The gate reads the demo badge
// contract, which keeps its badges in this browser (bon:demo-badges:v1).

/** The demo practice account (src/chain/DemoChain.ts, DEMO_PRACTICE_PUBLIC_KEY): hex of the public key. */
const ME = [...base58.decode("Ex4stLtTe43ynFmxGweGzMWLvRmRSUP6EjU6nvAdY2vg")]
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

const done = (lessonId: string, evidence?: Record<string, string>) => ({
  lessonId,
  stage: Number(lessonId.split("-")[1]),
  route: "newcomer",
  mode: "demo",
  completedAt: "2026-11-13T10:00:00.000Z",
  ...(evidence ? { evidence } : {}),
});

const STAGE2 = [
  done("l-2-1-follow-across-shards", { txHash: "Sh1demo", mode: "demo" }),
  done("l-2-2-call-across-blocks"),
];

async function seed(page: Page, badges: number[], completions: unknown[] = []) {
  await page.addInitScript(
    ({ badges, completions, me }) => {
      if (sessionStorage.getItem("seeded")) return;
      localStorage.setItem("bon:v1", JSON.stringify({ v: 1, route: "newcomer", completions, evidence: {} }));
      localStorage.setItem(
        "bon:demo-badges:v1",
        JSON.stringify(badges.map((stage) => ({ owner: me, stage, mintedAtMs: 1 }))),
      );
      sessionStorage.setItem("seeded", "1");
    },
    { badges, completions, me: ME },
  );
}

type Route = "general" | "developer";
const right = (route: Route) => questionsFor(route).map((q) => ANSWER_KEY[q.id]!.answer);

/** Answers every question: the right option, except for the first `wrong` questions. */
async function answer(page: Page, route: Route, wrong = 0) {
  const qs = questionsFor(route);
  for (const [i, q] of qs.entries()) {
    const k = ANSWER_KEY[q.id]!.answer;
    const pick = i < wrong ? (k + 1) % q.options.length : k;
    await page
      .locator(`fieldset[data-question="${q.id}"]`)
      .getByRole("radio", { name: q.options[pick], exact: true })
      .check();
  }
}

const handIn = (page: Page) => page.getByRole("button", { name: "Hand in my answers" }).click();
const examRecord = (page: Page, route: Route) =>
  page.evaluate(
    (r) =>
      (
        window as unknown as { __bookOfNear: { progress: { exam(r: string): unknown } } }
      ).__bookOfNear.progress.exam(r),
    route,
  );

test.describe("final exam in demo mode", () => {
  test("@smoke locked without the badges, opens once the last one is claimed", async ({ page }) => {
    await seed(page, [0, 1], STAGE2);
    await page.goto("/");
    await page.getByRole("link", { name: "Final exam" }).click();
    await expect(page.getByRole("heading", { name: "The final exam" })).toBeVisible();
    const locked = page.locator('[data-exam-state="locked"]');
    await expect(locked).toContainText("The exam is locked");
    await expect(locked).toContainText("Stage 2 badge: not yet");
    await expect(locked).toContainText("Stage 0 badge: held");
    await expect(page.getByRole("radio", { name: questionsFor("general")[0]!.options[0] })).toHaveCount(0);

    // Claim stage 2 on the contents page, then come back.
    await locked.getByRole("link", { name: "Claim badges on the contents page" }).click();
    const box = page.getByRole("region", { name: "Stage 2 badge" });
    await box.getByRole("button", { name: "Claim the stage 2 badge" }).click();
    await expect(box).toContainText("Stage 2 badge claimed");
    await page.getByRole("link", { name: "Final exam" }).click();
    const form = page.locator('form[data-exam-state="open"]');
    await expect(form).toBeVisible();
    await expect(form.locator("fieldset.quiz-q")).toHaveCount(15);
  });

  test("the developer route needs stages 3 and 4 as well", async ({ page }) => {
    await seed(page, [0, 1, 2]);
    await page.goto("/exam");
    await expect(page.locator('form[data-exam-state="open"]')).toBeVisible();
    await page.getByRole("radio", { name: /Developer route/ }).check();
    await expect(page).toHaveURL(/route=developer/);
    const locked = page.locator('[data-exam-state="locked"]');
    await expect(locked).toContainText("Stage 3 badge: not yet");
    await expect(locked).toContainText("Stage 4 badge: not yet");
  });

  test("fail, read the explanations, retake and pass; the result is kept", async ({ page }) => {
    await seed(page, [0, 1, 2]);
    // The answer key must not be in anything the page downloads before the exam is graded.
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.request().resourceType() === "script") scripts.push(await r.text().catch(() => ""));
    });
    await page.goto("/exam");
    await expect(page.locator('form[data-exam-state="open"]')).toBeVisible();

    // A blank answer is caught before grading.
    await handIn(page);
    await expect(page.getByRole("alert")).toContainText("15 are still blank");
    await expect(page.getByRole("alert")).toBeFocused();
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.some((s) => s.includes(ANSWER_KEY_MARK))).toBe(false);

    await answer(page, "general", 4);
    await handIn(page);
    const result = page.locator(".exam-result");
    await expect(result).toHaveAttribute("data-exam-state", "failed");
    await expect(page.getByRole("heading", { name: "Not passed yet" })).toBeFocused();
    await expect(result).toContainText("11 of 15 right");
    await expect(result).toContainText("You need 12 of 15");
    const review = page.getByRole("list", { name: "Your answers" });
    await expect(review.getByRole("listitem")).toHaveCount(15);
    const first = questionsFor("general")[0]!;
    const firstItem = review.locator(`[data-question="${first.id}"]`);
    await expect(firstItem).toContainText("Wrong");
    await expect(firstItem).toContainText(first.options[ANSWER_KEY[first.id]!.answer]!);
    await expect(firstItem).toContainText(ANSWER_KEY[first.id]!.why[ANSWER_KEY[first.id]!.answer]!);
    expect(await examRecord(page, "general")).toMatchObject({ score: 11, passed: false, attempts: 1 });

    await page.getByRole("button", { name: "Take the exam again" }).click();
    await expect(page.locator('form[data-exam-state="open"]')).toBeVisible();
    await expect(page.getByTestId("exam-kept")).toContainText("Your last try on the general route: 11 of 15");
    await expect(page.getByRole("radio", { checked: true, name: first.options[0] })).toHaveCount(0);
    await answer(page, "general", 1);
    await handIn(page);
    await expect(page.locator(".exam-result")).toHaveAttribute("data-exam-state", "passed");
    await expect(page.getByRole("heading", { name: "You passed the final exam" })).toBeVisible();
    await expect(page.locator(".exam-result")).toContainText("14 of 15 right");
    expect(await examRecord(page, "general")).toMatchObject({
      route: "general",
      accountId: ME,
      mode: "demo",
      score: 14,
      total: 15,
      passed: true,
      attempts: 2,
      receipt: { contractId: "badges.book-of-near.testnet", signature: expect.any(String) },
    });

    // A later fail does not replace the pass.
    await page.getByRole("button", { name: "Take the exam again" }).click();
    await answer(page, "general", 10);
    await handIn(page);
    await expect(page.locator(".exam-result")).toHaveAttribute("data-exam-state", "failed");
    expect(await examRecord(page, "general")).toMatchObject({ score: 14, passed: true, attempts: 3 });

    await page.reload();
    await expect(page.getByTestId("exam-kept")).toContainText(
      "You passed the general route with 14 of 15. Attempts: 3.",
    );
  });

  test("works on a phone, by keyboard, with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 740 });
    await seed(page, [0, 1, 2]);
    await page.goto("/exam");
    const form = page.locator('form[data-exam-state="open"]');
    await expect(form).toBeVisible();
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);

    // Keyboard: focus the first option of each question and pick with the arrow keys.
    const qs = questionsFor("general");
    const picks = right("general");
    for (const [i, q] of qs.entries()) {
      const radios = form.locator(`fieldset[data-question="${q.id}"]`).getByRole("radio");
      await radios.first().focus();
      // The first arrow press from an unchecked group moves on, so check the first with Space.
      await page.keyboard.press("Space");
      for (let n = 0; n < picks[i]!; n++) await page.keyboard.press("ArrowDown");
      await expect(radios.nth(picks[i]!)).toBeChecked();
    }
    await page.getByRole("button", { name: "Hand in my answers" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "You passed the final exam" })).toBeFocused();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
