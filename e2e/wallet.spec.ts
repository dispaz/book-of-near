import { expect, test } from "@playwright/test";

// Demo mode: no wallet, no network. Nothing real is ever signed here.
test.describe("mainnet wallet (demo)", () => {
  test("connects the simulated account, shows the balance and the funds check", async ({ page }) => {
    await page.goto("/wallet");
    await expect(page.getByTestId("wallet-status")).toHaveText(/not connected/i);
    await expect(page.getByTestId("funds-no-wallet")).toBeVisible();
    await page.getByRole("button", { name: "Connect demo wallet" }).click();
    await expect(page.getByTestId("wallet-account")).toHaveText("demo-learner.near");
    await expect(page.getByTestId("wallet-balance")).toHaveText("25 NEAR");
    await expect(page.getByTestId("funds-enough")).toBeVisible();
    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByTestId("funds-no-wallet")).toBeVisible();
  });
});
