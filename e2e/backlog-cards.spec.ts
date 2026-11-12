import { expect, test } from "@playwright/test";
import { seedRoute } from "./lessons/helpers";

// Backlog topics from docs/curriculum/topics.json show as locked cards under their stage (#30).
test.beforeEach(({ page }) => seedRoute(page));

test.describe("backlog topic cards", () => {
  test("every registered stage is in the contents; stage 7 opens with the capstone and keeps its locked card", async ({
    page,
  }) => {
    await page.goto("/");
    for (const n of [0, 1, 2, 3, 4, 7]) {
      await expect(page.getByRole("region", { name: new RegExp(`Stage ${n}\\b`) })).toBeVisible();
    }
    // Stages 5 and 6 are parked (docs/progress.md, #30): no section and no cards for them.
    for (const n of [5, 6]) {
      await expect(page.getByRole("region", { name: new RegExp(`Stage ${n}\\b`) })).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: /Shade Agents/ })).toHaveCount(0);
    const stage7 = page.getByRole("region", { name: /Stage 7/ });
    // The capstone (#26) is ready, so stage 7 is no longer "Coming later".
    await expect(stage7).not.toContainText("Coming later");
    await expect(stage7.getByRole("button", { name: /Capstone: the honest take/ })).toBeVisible();
    await expect(stage7.getByRole("link", { name: /Trace one intent end to end/ })).toHaveCount(1);
  });

  test("opening a card shows its summary and comparison note; it closes again", async ({ page }) => {
    await page.goto("/");
    const stage0 = page.getByRole("region", { name: /Stage 0/ });
    const card = stage0.getByRole("button", { name: /Smart contracts/ });
    await expect(card).toHaveAttribute("aria-expanded", "false");
    await expect(card).toContainText("Coming soon");
    await card.click();
    await expect(card).toHaveAttribute("aria-expanded", "true");
    const details = stage0.getByRole("region", { name: "Smart contracts" });
    await expect(details).toContainText("A smart contract is a program stored on a blockchain.");
    await expect(details).toContainText("Comparison note");
    await expect(details).toContainText("Standard concept.");
    await card.click();
    await expect(details).toBeHidden();
  });

  test("going-deeper topics are tagged and unchecked notes are marked", async ({ page }) => {
    await page.goto("/");
    const stage2 = page.getByRole("region", { name: /Stage 2/ });
    const spice = stage2.getByRole("button", { name: /Roadmap: SPICE/ });
    await expect(spice).toContainText("Going deeper");
    await expect(stage2.getByRole("button", { name: /Dynamic resharding/ })).not.toContainText(
      "Going deeper",
    );
    await spice.click();
    const details = stage2.getByRole("region", { name: /Roadmap: SPICE/ });
    await expect(details).toContainText("Not yet checked");
    await expect(details).toContainText(/optional/i);
  });

  test("a planned lesson with a summary shows its being-written state", async ({ page }) => {
    await page.goto("/");
    const stage4 = page.getByRole("region", { name: /Stage 4/ });
    const card = stage4.getByRole("button", { name: /Old bridge vs the NEAR way/ });
    await card.click();
    const details = stage4.getByRole("region", { name: "Old bridge vs the NEAR way" });
    await expect(details).toContainText(/being written/);
  });

  test("a card has its own page with the same text", async ({ page }) => {
    await page.goto("/lesson/topic-2-dynamic-resharding");
    await expect(page.getByRole("heading", { level: 1, name: /Dynamic resharding/ })).toBeVisible();
    await expect(page.getByText("Stage 2 · Nightshade")).toBeVisible();
    await expect(page.getByText(/It lets the network make room as use grows/)).toBeVisible();
    await expect(page.getByText("Comparison note")).toBeVisible();
    await page.getByRole("link", { name: "Back to contents" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Book of NEAR" })).toBeVisible();
  });

  test("cards stay usable on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto("/");
    const card = page.getByRole("button", { name: /Tokens: fungible/ });
    await card.click();
    await expect(page.getByRole("region", { name: /Tokens: fungible/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await ctx.close();
  });
});
