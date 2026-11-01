import { expect, test, type Page } from "@playwright/test";

const PHASES = ["built", "signed", "broadcast", "included", "final"];

async function sendAndCheck(page: Page) {
  await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
  const next = page.getByRole("button", { name: "Next step" });
  await expect(next).toBeDisabled();
  await page.locator(".action-slot").getByRole("button", { name: "Send 1 NEAR" }).click();

  const pipeline = page.getByTestId("pipeline");
  for (const phase of PHASES)
    await expect(pipeline.locator(`[data-phase="${phase}"]`)).toHaveAttribute("data-lit", "true", {
      timeout: 10_000,
    });

  const details = page.getByTestId("tx-details");
  await expect(details.getByTestId("tx-hash")).toHaveText(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
  await expect(details.getByTestId("tx-block")).toHaveText("#200000001");
  await expect(details.getByTestId("tx-shard")).toHaveText(/^Shard \d$/);
  await expect(details.getByTestId("tx-gas")).toHaveText("0.45 Tgas");
  await expect(pipeline.locator('[data-phase="final"] .ptx-ms')).toHaveText("3250 ms");
  await expect(page.getByTestId("practice-balance")).toHaveText("3.99995 NEAR");
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId("caption")).toHaveText(/Final/);
}

test.describe("chain: placeholder transfer (demo mode)", () => {
  test("sends 1 NEAR and shows the transaction details", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/lesson/placeholder-transfer?step=2");
    await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
    await sendAndCheck(page);
    expect(errors).toEqual([]);
  });

  test("works the same with reduced motion", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/lesson/placeholder-transfer?step=2");
    await sendAndCheck(page);
    await ctx.close();
  });

  test("is hidden from the contents", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "bon:v1",
        JSON.stringify({ v: 1, route: "newcomer", completions: [], evidence: {} }),
      ),
    );
    await page.goto("/");
    const contents = page.getByRole("navigation", { name: "Contents" });
    await expect(
      contents.getByRole("link", { name: /How a blockchain and a transaction work/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Send a test transfer/ })).toHaveCount(0);
  });
});
