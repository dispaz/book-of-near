import { base58 } from "@scure/base";
import { expect, test, type Page } from "@playwright/test";
import { ANSWER_KEY } from "../src/exam/answerKey";
import { EXAM_QUESTIONS, questionsFor } from "../src/exam/bank";

/**
 * Text that only the answer key holds: every `why` explanation that is not also question text.
 * Grading uses these strings, so a bundle that holds the key holds them (a separate marker constant
 * would be tree-shaken out and prove nothing).
 */
const BANK_TEXT = EXAM_QUESTIONS.flatMap((q) => [q.prompt, ...q.options]).join("\n");
const KEY_TEXT = Object.values(ANSWER_KEY)
  .flatMap((k) => k.why)
  .filter((w) => w.length >= 30 && !BANK_TEXT.includes(w));
const holdsKey = (script: string) => KEY_TEXT.some((w) => script.includes(w));

/** Collects the body of every script the page downloads; `bodies()` waits for all of them. */
function collectScripts(page: Page) {
  const pending: Promise<{ url: string; text: string }>[] = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script")
      pending.push(
        r.text().then(
          (text) => ({ url: r.url(), text }),
          () => ({ url: r.url(), text: "" }),
        ),
      );
  });
  return { bodies: (from = 0) => Promise.all(pending.slice(from)) };
}

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
    ({ r, me }) =>
      (
        window as unknown as {
          __bookOfNear: { progress: { exam(r: string, mode: string, accountId: string): unknown } };
        }
      ).__bookOfNear.progress.exam(r, "demo", me),
    { r: route, me: ME },
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
    expect(KEY_TEXT.length).toBeGreaterThan(20);
    // The answer key is not in anything the page downloads before the exam is graded.
    const scripts = collectScripts(page);
    await page.goto("/exam");
    await expect(page.locator('form[data-exam-state="open"]')).toBeVisible();

    // A blank answer is caught before grading.
    await handIn(page);
    await expect(page.getByRole("alert")).toContainText("15 are still blank");
    await expect(page.getByRole("alert")).toBeFocused();
    await page.waitForLoadState("networkidle");
    const before = await scripts.bodies();
    expect(before.length).toBeGreaterThan(0);
    expect(before.filter((s) => holdsKey(s.text)).map((s) => s.url)).toEqual([]);

    await answer(page, "general", 4);
    await handIn(page);
    const result = page.locator(".exam-result");
    await expect(result).toHaveAttribute("data-exam-state", "failed");
    // Positive control: demo grading fetched the key chunk, and the check above would have caught it.
    const after = await scripts.bodies(before.length);
    expect(after.filter((s) => holdsKey(s.text)).length).toBe(1);
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

  test("pass, claim the final badge, see it in My book and the checker (issue #29)", async ({ page }) => {
    await seed(page, [0, 1, 2]);
    await page.goto("/exam");
    await expect(page.locator('form[data-exam-state="open"]')).toBeVisible();
    // No card before a pass.
    await expect(page.getByRole("region", { name: "Final badge" })).toHaveCount(0);
    await answer(page, "general", 1);
    await handIn(page);
    await expect(page.locator(".exam-result")).toHaveAttribute("data-exam-state", "passed");

    // 14 of 15 is rare; demo time is inside the hackathon window, which raises it one tier.
    const card = page.getByRole("region", { name: "Final badge" });
    await expect(card).toHaveAttribute("data-claim-state", "ready");
    await expect(card).toContainText("Your final badge is ready: epic");
    await expect(card).toContainText("14 of 15, plus one tier for a pass during the hackathon.");
    // Demo time never leaves the window, and the card says so instead of claiming a real date.
    await expect(card).toContainText(
      "Demo time is set inside the hackathon (from 1 Nov 2026), so a demo pass always gets the extra tier.",
    );
    await expect(card).not.toContainText("1 to 14 Nov 2026");
    await card.getByRole("button", { name: "Claim the final badge" }).click();
    await expect(card).toHaveAttribute("data-claim-state", "claimed");
    await expect(card).toContainText("Final badge claimed: epic");
    await expect(card.getByRole("img", { name: "Final badge, epic" })).toBeVisible();

    await card.getByRole("link", { name: "My book" }).click();
    const slot = page.getByRole("group", { name: "Final badge" });
    await expect(slot).toHaveAttribute("data-final", "epic");
    await expect(slot).toContainText("Passed the general route");
    // Stage badges still count as before: the final badge is not one of them.
    await expect(page.locator(".badge-count")).toContainText("3 of");

    // A reload keeps it (demo badges live in this browser), and the checker reads it too.
    await page.reload();
    await expect(page.getByRole("group", { name: "Final badge" })).toHaveAttribute("data-final", "epic");
    await page.goto(`/check?account=${ME}`);
    await expect(page.locator(".badge-count")).toContainText("and the final badge (epic)");
    await expect(page.getByRole("group", { name: "Final badge" })).toHaveAttribute("data-final", "epic");

    // Back on the exam page, the card says it is held; a retake cannot claim a second one.
    await page.goto("/exam");
    await expect(page.getByRole("region", { name: "Final badge" })).toContainText(
      "You hold the final badge: epic",
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
