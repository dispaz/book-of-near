import { expect, test } from "@playwright/test";

// The default build is testnet only (VITE_ENABLE_MAINNET off): /wallet says so and offers no wallet.
// The mainnet wallet page is tested only in a build with the flag on: `VITE_ENABLE_MAINNET=true npm run e2e`
// (the preview build inherits the variable).
const MAINNET = process.env.VITE_ENABLE_MAINNET === "true";

test.describe("wallet page, testnet-only build", () => {
  test.skip(MAINNET, "this build has the mainnet wallet switched on");

  test("says the build is testnet only and offers no wallet", async ({ page }) => {
    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: "Testnet-only build" })).toBeVisible();
    await expect(page.getByTestId("testnet-only")).toContainText("the mainnet wallet is switched off");
    await expect(page.getByTestId("wallet-status")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
  });
});

// Demo mode: no wallet, no network. Nothing real is ever signed here.
test.describe("mainnet wallet (demo)", () => {
  test.skip(!MAINNET, "needs a build with VITE_ENABLE_MAINNET=true");

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
