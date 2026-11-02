import { expect, test } from "@playwright/test";

const LESSON = "/lesson/l-0-3-send-a-transaction?step=1&view=2d";

test.describe("testnet mode", () => {
  test("falls back to demo mode with a notice when no faucet answers", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Our Worker faucet and NEAR's public helper are both unreachable.
    await page.route("**/faucet", (r) => r.abort());
    await page.route("https://helper.testnet.near.org/**", (r) => r.abort());
    await page.goto(`${LESSON}&mode=testnet`);

    const notice = page.getByTestId("mode-notice");
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(notice).toContainText("demo mode");
    await expect(notice).toContainText("faucet did not answer");
    await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");

    // The lesson still works, on the demo chain: the demo practice account shows its balance.
    await expect(page.getByTestId("sender-balance")).toContainText("5");

    await page.getByRole("button", { name: "Stay in demo" }).click();
    await expect(notice).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the mode switch is a labelled button", async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
    await expect(page.getByRole("button", { name: "Use testnet" })).toBeVisible();
  });
  // The real-network walk lives in e2e/lessons/l-0-3-send-a-transaction.spec.ts (@testnet).
});
