import { expect, test, type Page } from "@playwright/test";
import { answerCheck, completionOf, nextStep, seedRoute } from "./lessons/helpers";

/** Demo mode. Completion records as the lessons write them (lesson ids, evidence keys: src/badges/rules.ts). */
const done = (lessonId: string, evidence?: Record<string, string>) => ({
  lessonId,
  stage: Number(lessonId.split("-")[1]),
  route: "newcomer",
  mode: "demo",
  completedAt: "2026-11-12T10:00:00.000Z",
  ...(evidence ? { evidence } : {}),
});

const STAGE0 = [
  done("l-0-1-blockchain-basics"),
  done("l-0-2-make-a-wallet"),
  done("l-0-3-send-a-transaction", { txHash: "8kQ3demo", mode: "demo" }),
];
const STAGE1 = [
  done("l-1-1-claim-your-name", { txHash: "Nm1demo", accountId: "learner.testnet", mode: "demo" }),
  done("l-1-2-function-call-key", { addKeyTxHash: "Add1demo", txHash: "Del1demo" }),
  done("l-1-3-inside-a-transaction"),
];

async function seed(page: Page, completions: unknown[]) {
  await page.addInitScript((c) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(
        "bon:v1",
        JSON.stringify({ v: 1, route: "newcomer", completions: c, evidence: {} }),
      );
      sessionStorage.setItem("seeded", "1");
    }
  }, completions);
}

const stageCard = (page: Page, n: number) =>
  page.locator("section.stage-card").filter({ has: page.locator(`#stage-${n}`) });
const claimBox = (page: Page, n: number) => page.getByRole("region", { name: `Stage ${n} badge` });

test.describe("badges in demo mode", () => {
  test("@smoke finish stage 0, claim its badge, see it in My book and in the checker", async ({ page }) => {
    await seed(page, STAGE0);
    await page.goto("/");
    const box = claimBox(page, 0);
    await expect(box).toContainText("Your badge is ready");
    await box.getByRole("button", { name: "Claim the stage 0 badge" }).click();
    await expect(box).toContainText("Stage 0 badge claimed");
    await expect(box.getByRole("img", { name: "Stage 0 badge" })).toBeVisible();
    // The art file loads (a broken SVG would show only its alt text).
    await expect
      .poll(() =>
        box.getByRole("img", { name: "Stage 0 badge" }).evaluate((i: HTMLImageElement) => i.naturalWidth),
      )
      .toBeGreaterThan(0);

    await box.getByRole("link", { name: "My book" }).click();
    await expect(page.getByRole("heading", { name: "Your badges" })).toBeVisible();
    const shelf = page.getByRole("list", { name: "My badges" });
    await expect(shelf.locator('[data-stage="0"]')).toContainText("Claimed");
    await expect(shelf.locator('[data-stage="1"]')).toContainText("Not claimed yet");
    await expect(page.getByText("1 of 5 claimed.")).toBeVisible();

    // The badge survives a reload (demo badges are kept in this browser).
    await page.reload();
    await expect(page.getByRole("list", { name: "My badges" }).locator('[data-stage="0"]')).toContainText(
      "Claimed",
    );

    await page.getByRole("link", { name: "Open in the badge checker" }).click();
    await expect(page.getByRole("heading", { name: "Check anyone's badges" })).toBeVisible();
    await expect(page.getByRole("list", { name: /^Badges of / }).locator('[data-stage="0"]')).toContainText(
      "Claimed",
    );
  });

  test("a claim before the stage is finished is refused, with what is missing", async ({ page }) => {
    await seed(page, STAGE0.slice(0, 2));
    await page.goto("/");
    const box = claimBox(page, 0);
    await expect(box).toContainText("not yet");
    await expect(box).toContainText("Finish lesson 0.3.");
    await expect(box.getByRole("button", { name: /Claim/ })).toHaveCount(0);
  });

  test("a stage tested out without its transaction asks for it", async ({ page }) => {
    await seed(
      page,
      STAGE0.map((c) => ({ ...c, testedOut: true, evidence: undefined })),
    );
    await page.goto("/");
    await expect(claimBox(page, 0)).toContainText("Send your first transaction in lesson 0.3.");
  });

  test("a reused claim is refused: the badge is already held", async ({ page }) => {
    await seed(page, STAGE0);
    await page.goto("/");
    await claimBox(page, 0).getByRole("button", { name: "Claim the stage 0 badge" }).click();
    await expect(claimBox(page, 0)).toContainText("Stage 0 badge claimed");
    // Submit the same signed claim again, straight to the demo contract.
    const second = await page.evaluate(() =>
      (
        window as unknown as { __bookOfNear: { badges: { replayLastClaim(): Promise<string> } } }
      ).__bookOfNear.badges.replayLastClaim(),
    );
    expect(second).toMatch(/already claimed/);
  });

  test("stage 1: refused before its lessons, then claimed after", async ({ page }) => {
    await seed(page, [
      ...STAGE0,
      ...STAGE1.slice(0, 1),
      { ...STAGE1[1]!, evidence: { txHash: "Del1demo" } },
      STAGE1[2]!,
    ]);
    await page.goto("/");
    await expect(claimBox(page, 1)).toContainText("Claim the stage 0 badge first.");
    await expect(claimBox(page, 1)).toContainText("Add the one-job key and delete it in lesson 1.2.");
    await claimBox(page, 0).getByRole("button", { name: "Claim the stage 0 badge" }).click();
    await expect(claimBox(page, 0)).toContainText("claimed");
    await expect(claimBox(page, 1).getByRole("button", { name: /Claim/ })).toHaveCount(0);

    // Finish 1.2 properly (its evidence now has the added key), then the stage 1 badge can be claimed.
    await page.evaluate((rec) => {
      const s = JSON.parse(localStorage.getItem("bon:v1")!);
      s.completions = s.completions
        .filter((c: { lessonId: string }) => c.lessonId !== rec.lessonId)
        .concat(rec);
      localStorage.setItem("bon:v1", JSON.stringify(s));
      window.dispatchEvent(new StorageEvent("storage", { key: "bon:v1" }));
    }, STAGE1[1]!);
    const box1 = claimBox(page, 1);
    await box1.getByRole("button", { name: "Claim the stage 1 badge" }).click();
    await expect(box1).toContainText("Stage 1 badge claimed");
    await page.goto("/my-book");
    await expect(page.getByText("2 of 5 claimed.")).toBeVisible();
  });

  test("the claim card works on a phone and with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, STAGE0);
    await page.goto("/");
    const box = claimBox(page, 0);
    await box.getByRole("button", { name: "Claim the stage 0 badge" }).click();
    await expect(box).toContainText("Stage 0 badge claimed");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(stageCard(page, 0)).toBeVisible();
  });

  test("the claim card shows at the end of the stage's last lesson", async ({ page }) => {
    await seed(page, STAGE0);
    await page.goto("/lesson/l-0-3-send-a-transaction?step=99&webgl=0");
    await page.getByRole("link", { name: "Claim the stage 0 badge" }).click();
    await expect(claimBox(page, 0)).toContainText("Your badge is ready");
    await expect(claimBox(page, 0)).toBeInViewport();
  });
});

// The same flow with nothing seeded: the learner really plays lessons 0.1 to 0.3 (2D view, demo mode),
// and the claim uses the records and the 0.3 transaction the lessons themselves wrote. Each walk does
// only what opens each gate; the lesson specs (e2e/lessons/) check every step in detail.
const dockButton = (page: Page, name: string) =>
  page.locator(".action-slot").getByRole("button", { name, exact: true });

async function finish(page: Page, lessonId: string) {
  await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
  expect(await completionOf(page, lessonId)).toMatchObject({ lessonId, stage: 0, mode: "demo" });
}

async function play01(page: Page) {
  await page.goto("/lesson/l-0-1-blockchain-basics?view=2d");
  await page.getByRole("button", { name: "Open Ben's notebook", exact: true }).click();
  await nextStep(page);
  await page.getByLabel("Amount (coins)").fill("3");
  await dockButton(page, "Send").click();
  await nextStep(page);
  await page.getByRole("button", { name: "Open block #1", exact: true }).click();
  await nextStep(page);
  await page.getByLabel("Change the text").fill("Ana->Ben 4");
  await nextStep(page);
  await dockButton(page, "Send").click();
  await expect(page.getByTestId("ledger-scene")).toHaveAttribute("data-scene-state", /blocks:3/);
  await dockButton(page, "Send").click();
  await nextStep(page);
  await page.getByLabel("Amount in block #1").fill("9");
  await nextStep(page);
  await dockButton(page, "Compare copies").click();
  await nextStep(page);
  await answerCheck(page, [
    "The block's hash changes, and the next block still stores the old hash.",
    "The transaction is rejected and no balances change.",
    "It acts as a fingerprint: any change to the block gives a different hash.",
  ]);
  await nextStep(page);
  await finish(page, "l-0-1-blockchain-basics");
}

async function play02(page: Page) {
  await page.goto("/lesson/l-0-2-make-a-wallet?view=2d");
  await page.getByRole("checkbox", { name: /these keys are for practice only/ }).check();
  await nextStep(page);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await nextStep(page);
  await page.getByRole("button", { name: "Rebuild from words" }).click();
  await nextStep(page);
  await page.getByRole("button", { name: "Turn it into an address" }).click();
  await nextStep(page);
  const wallet = page.getByRole("region", { name: "Practice wallet" });
  for (let i = 0; i < 3; i++)
    await wallet
      .getByRole("button", { name: /^Show the .* rule$/ })
      .first()
      .click();
  await nextStep(page);
  await page.getByRole("button", { name: "Sign", exact: true }).click();
  await nextStep(page);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await page.getByRole("textbox", { name: "Message to check" }).fill("Hellp from Book of NEAR");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await nextStep(page);
  await page.getByRole("button", { name: "Throw the keys away" }).click();
  await nextStep(page);
  await answerCheck(page, [
    "Close the page. Real wallets never need your seed phrase on a website.",
    "Verification fails, because the signature no longer matches the message.",
    "The 32-byte ed25519 public key written as 64 hex characters.",
  ]);
  await nextStep(page);
  await finish(page, "l-0-2-make-a-wallet");
}

async function play03(page: Page): Promise<string> {
  await page.goto("/lesson/l-0-3-send-a-transaction?view=2d");
  await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
  await nextStep(page);
  await dockButton(page, "Build").click();
  await nextStep(page);
  await dockButton(page, "Got it").click();
  await nextStep(page);
  await dockButton(page, "Sign").click();
  const hash = (await page.getByTestId("tx-hash").textContent())!;
  await nextStep(page);
  await dockButton(page, "Send").click();
  await expect(page.getByTestId("pipeline").locator('[data-phase="final"]')).toHaveAttribute(
    "data-lit",
    "true",
    { timeout: 30_000 },
  );
  await nextStep(page);
  await nextStep(page);
  await nextStep(page);
  await dockButton(page, "Open the demo explorer").click();
  await nextStep(page);
  await answerCheck(page, [
    "Build, sign, broadcast, included, final.",
    "It passes your signed transaction into the network and answers questions about the chain.",
    "So the same signed transaction cannot be sent again to move coins twice.",
  ]);
  await nextStep(page);
  await finish(page, "l-0-3-send-a-transaction");
  return hash;
}

test("plays lessons 0.1 to 0.3 in demo mode, then claims the stage 0 badge and sees it in My book", async ({
  page,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seedRoute(page);
  await play01(page);
  await play02(page);
  const hash = await play03(page);
  expect(await completionOf(page, "l-0-3-send-a-transaction")).toMatchObject({
    evidence: { txHash: hash, mode: "demo" },
  });

  await page.goto("/");
  const box = claimBox(page, 0);
  await expect(box).toContainText("Your badge is ready");
  await box.getByRole("button", { name: "Claim the stage 0 badge" }).click();
  await expect(box).toContainText("Stage 0 badge claimed");
  await box.getByRole("link", { name: "My book" }).click();
  const shelf = page.getByRole("list", { name: "My badges" });
  await expect(shelf.locator('[data-stage="0"]')).toContainText("Claimed");
  await expect(page.getByText("1 of 5 claimed.")).toBeVisible();
  expect(errors).toEqual([]);
});
