import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const LESSON = "/lesson/placeholder-transfer?step=2";

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

    // The lesson still works, on the demo chain.
    await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
    await page.locator(".action-slot").getByRole("button", { name: "Send 1 NEAR" }).click();
    await expect(page.getByTestId("tx-block")).toHaveText("#200000001", { timeout: 10_000 });

    await page.getByRole("button", { name: "Stay in demo" }).click();
    await expect(notice).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the mode switch is a labelled button", async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
    await expect(page.getByRole("button", { name: "Use testnet" })).toBeVisible();
  });

  // Opt-in: needs the real testnet. TESTNET=1 npx playwright test --grep @testnet
  // With TESTNET_STORE pointing at a saved throwaway practice key (see src/chain/testnet/testnet.test.ts)
  // the visitor reuses it; otherwise a fresh account comes from NEAR's public helper faucet.
  test("@testnet a visitor gets a practice account and sends a real transfer", async ({ page }) => {
    test.skip(!process.env.TESTNET, "set TESTNET=1 to run against the real testnet");
    test.setTimeout(180_000);
    const storePath = process.env.TESTNET_STORE;
    if (storePath && existsSync(storePath)) {
      const saved = readFileSync(storePath, "utf8");
      await page.addInitScript((v) => localStorage.setItem("bon:testnet-practice-account:v1", v), saved);
    }
    await page.goto(`${LESSON}&mode=testnet`);
    await expect(page.getByTestId("mode-pill")).toHaveText("Testnet", { timeout: 90_000 });
    await expect(page.getByTestId("practice-balance")).toHaveText(/^\d+(\.\d+)? NEAR$/, { timeout: 30_000 });
    await page.locator(".action-slot").getByRole("button", { name: "Send 0.01 NEAR" }).click();
    const pipeline = page.getByTestId("pipeline");
    for (const phase of ["built", "signed", "broadcast", "included", "final"])
      await expect(pipeline.locator(`[data-phase="${phase}"]`)).toHaveAttribute("data-lit", "true", {
        timeout: 60_000,
      });
    await expect(page.getByTestId("tx-hash")).toHaveText(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
    await expect(page.getByTestId("tx-shard")).toHaveText(/^Shard \d+$/);
    console.log("testnet tx", await page.getByTestId("tx-hash").textContent());
  });
});
