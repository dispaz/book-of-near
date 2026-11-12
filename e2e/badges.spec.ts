import { expect, test, type Page } from "@playwright/test";

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
