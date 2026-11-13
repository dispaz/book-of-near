import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { base58 } from "@scure/base";
import { expect, test, type Page, type Route } from "@playwright/test";
import {
  answerCheck,
  completionOf,
  countDrawnFrames,
  expectFocusMarksHover,
  expectNotYetHint,
  expectPickDetail,
  expectPickPlaysAndSettles,
  LOAD_3D,
  nextStep,
  pickButton,
  seedRoute,
  slow3dUnless2d,
} from "./helpers";

// Walks lesson 0.3 in demo mode (no wallet, no network): build, fee, sign, send, watch the pipeline,
// open the explorer, check, honest take. The demo practice account is the fixed key from the script.
const ID = "l-0-3-send-a-transaction";
const TITLE = "Send a transaction and watch it";
const STAGE = 0;
const DEMO_ACCOUNT = "cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5";
const BASE58_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

test.beforeEach(({ page }, info) => {
  slow3dUnless2d(info);
  return seedRoute(page);
});

/** The lesson draws the view it was asked for: the 3D scene has a WebGL canvas, 2D has none. */
async function expectView(page: Page, view: "2d" | "3d") {
  await expect(page.getByTestId("tx-scene")).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
  await expect(page.locator(".stx-3d canvas")).toHaveCount(view === "3d" ? 1 : 0, { timeout: LOAD_3D });
}

const light = (page: Page, phase: string) => page.getByTestId("pipeline").locator(`[data-phase="${phase}"]`);
const dock = (page: Page) => page.locator(".action-slot");

/** Walks from step 1 to the Honest take in demo mode. Checks every gate on the way. Returns the tx hash. */
async function walk(page: Page): Promise<string> {
  const next = page.getByRole("button", { name: "Next step" });

  // 1. The practice account with its balance.
  await expect(page.getByTestId("account-id")).toHaveText(DEMO_ACCOUNT);
  await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
  await expect(page.getByTestId("receiver-id")).toHaveText("book-of-near.testnet");
  await nextStep(page);

  // 2. Build: a wrong amount gets a kind message; the right one fills nonce and block hash.
  await expect(next).toBeDisabled();
  await expect(page.getByTestId("tx-nonce")).toHaveText(/fills in when you press Build/);
  const amount = page.getByRole("textbox", { name: "Amount" });
  await expect(amount).toHaveValue("0.01");
  await amount.fill("5");
  await dock(page).getByRole("button", { name: "Build" }).click();
  await expect(page.getByRole("alert")).toHaveText("Pick an amount from 0.001 to 0.1 NEAR.");
  await expect(light(page, "built")).toHaveAttribute("data-lit", "false");
  await amount.fill("0.01");
  await dock(page).getByRole("button", { name: "Build" }).click();
  await expect(light(page, "built")).toHaveAttribute("data-lit", "true");
  await expect(page.getByTestId("tx-nonce")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("tx-block-hash")).toHaveText(BASE58_HASH);
  await expect(page.getByTestId("tx-receiver")).toContainText("book-of-near.testnet");
  await nextStep(page);

  // 3. Gas and the fee.
  await expect(next).toBeDisabled();
  await expect(page.getByTestId("fee-panel")).toContainText("0.45 Tgas");
  await expect(page.getByTestId("fee-panel")).toContainText("0.000045 NEAR");
  await dock(page).getByRole("button", { name: "Got it" }).click();
  await nextStep(page);

  // 4. Sign: the transaction ID appears, still no network.
  await expect(next).toBeDisabled();
  await dock(page).getByRole("button", { name: "Sign" }).click();
  await expect(light(page, "signed")).toHaveAttribute("data-lit", "true");
  await expect(page.getByTestId("tx-hash")).toHaveText(BASE58_HASH);
  const hash = (await page.getByTestId("tx-hash").textContent())!;
  await expect(light(page, "broadcast")).toHaveAttribute("data-lit", "false");
  await nextStep(page);

  // 5. Send: broadcast, then included, then final, in order, from the chain's phase events.
  await expect(next).toBeDisabled();
  await dock(page).getByRole("button", { name: "Send" }).click();
  for (const phase of ["broadcast", "included", "final"])
    await expect(light(page, phase)).toHaveAttribute("data-lit", "true", { timeout: 30_000 });
  await expect(page.getByTestId("tx-node")).toHaveText(/demo node/);
  await expect(page.getByTestId("tx-accepted")).toHaveText("+250 ms");
  await expect(page.getByTestId("tx-rpc-status")).toHaveText("FINAL at +3.25 s");
  await expect(page.getByTestId("time-broadcast")).toHaveText("+250 ms");
  await expect(page.getByTestId("time-included")).toHaveText("+850 ms");
  await expect(page.getByTestId("time-final")).toHaveText("+3.25 s");
  await nextStep(page);

  // 6. Included: the block and the balances.
  await expect(page.getByTestId("tx-height")).toHaveText("#200000001");
  await expect(page.getByTestId("inclusion-block")).toBeVisible();
  await expect(page.getByTestId("receiver-balance")).toHaveText("100.01 NEAR");
  await nextStep(page);

  // 7. Final: stopwatch, fee and the balance after the refund.
  await expect(page.getByTestId("time-to-final")).toHaveText("3.25 s");
  await expect(page.getByTestId("final-balance")).toHaveText("4.989955 NEAR");
  await expect(page.getByTestId("sender-balance")).toHaveText("4.989955 NEAR");
  await expect(page.getByTestId("tx-fee")).toHaveText("0.00004463 NEAR");
  await nextStep(page);

  // 8. Explorer: demo mode shows a mock card and the link it would open, disabled.
  await expect(next).toBeDisabled();
  await expect(page.getByTestId("explorer-url")).toHaveText(`https://testnet.nearblocks.io/txns/${hash}`);
  await expect(page.getByTestId("explorer-url")).not.toHaveAttribute("href");
  await dock(page).getByRole("button", { name: "Open the demo explorer" }).click();
  await expect(page.getByTestId("demo-explorer")).toContainText(hash);
  await expect(page.getByTestId("demo-explorer")).toContainText("Success");
  await expect(page.getByTestId("explorer-note")).toContainText("NearBlocks has never seen it");
  await nextStep(page);

  // 9. Check: one wrong answer first, to see the explanation.
  const check = page.getByRole("dialog", { name: "Quick check" });
  await check
    .getByRole("radiogroup")
    .nth(1)
    .getByRole("radio", { name: /holds your private key/ })
    .check();
  await check.getByRole("button", { name: "Check answers" }).click();
  await expect(check.getByText(/the RPC node only sees the signed result/)).toBeVisible();
  await expect(next).toBeDisabled();
  await answerCheck(page, [
    "Build, sign, broadcast, included, final.",
    "It passes your signed transaction into the network and answers questions about the chain.",
    "So the same signed transaction cannot be sent again to move coins twice.",
  ]);
  await nextStep(page);

  // 10. Honest take, then Finish.
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest.getByText(/Sent is not done/)).toBeVisible();
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
  return hash;
}

// The whole lesson runs in both views: one state, drawn as flat cards (2D) or as the 3D scene.
for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test("is in the contents and walks to Finish in demo mode", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript((v) => localStorage.setItem("bon:view", v), view);
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await expectView(page, view);
      const hash = await walk(page);
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: { txHash: hash, mode: "demo" },
      });
      expect(errors).toEqual([]);
    });

    test("the pipeline lights up one stage at a time in demo mode", async ({ page }) => {
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Build" }).click();
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Got it" }).click();
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Sign" }).click();
      await nextStep(page);
      const seen: string[] = [];
      await page.exposeFunction("seeLights", (s: string) => seen.push(s));
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="tx-scene"]')!;
        new MutationObserver(() =>
          (window as unknown as { seeLights(s: string): void }).seeLights(
            el.getAttribute("data-scene-state")!,
          ),
        ).observe(el, { attributes: true, attributeFilter: ["data-scene-state"] });
      });
      await dock(page).getByRole("button", { name: "Send" }).click();
      await expect(light(page, "final")).toHaveAttribute("data-lit", "true", { timeout: 30_000 });
      const lits = [...new Set(seen.map((s) => /lit:([^;]*)/.exec(s)![1]))];
      expect(lits.filter((l) => l !== "built,signed")).toEqual([
        "built,signed,broadcast",
        "built,signed,broadcast,included",
        "built,signed,broadcast,included,final",
      ]);
    });

    test("Finish stays locked until a transfer was sent", async ({ page }) => {
      await page.goto(`/lesson/${ID}?step=10&view=${view}`);
      await expect(page.getByRole("region", { name: "Honest take" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Finish lesson" })).toBeDisabled();
      await dock(page).getByRole("button", { name: "Go back and send it" }).click();
      await expect(page).toHaveURL(/step=2/);
      await expect(dock(page).getByRole("button", { name: "Build" })).toBeVisible();
    });

    test("walks with reduced motion", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      const hash = await walk(page);
      expect(await completionOf(page, ID)).toMatchObject({ stage: STAGE, evidence: { txHash: hash } });
      await context.close();
    });

    test("walks on a phone-sized screen", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 760 } });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      const hash = await walk(page);
      expect(await completionOf(page, ID)).toMatchObject({ stage: STAGE, evidence: { txHash: hash } });
      await context.close();
    });

    test("a failed testnet transfer shows a kind error and continues in demo mode", async ({ page }) => {
      // A throwaway practice key made for this test; the RPC nodes are faked, so nothing reaches testnet.
      const { publicKey, privateKey } = generateKeyPairSync("ed25519");
      const pub = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
      const seed = Buffer.from(privateKey.export({ format: "jwk" }).d!, "base64url");
      const publicKeyText = `ed25519:${base58.encode(pub)}`;
      const accountId = pub.toString("hex");
      const stored = {
        warning: "Throwaway practice key for NEAR TESTNET only (e2e test).",
        network: "testnet",
        accountId,
        publicKey: publicKeyText,
        secretKey: `ed25519:${base58.encode(Buffer.concat([seed, pub]))}`,
        fundedBy: "test",
        createdAt: new Date().toISOString(),
      };
      await page.addInitScript(
        (v) => localStorage.setItem("bon:testnet-practice-account:v1", v),
        JSON.stringify(stored),
      );

      const blockHash = base58.encode(new Uint8Array(32).fill(7));
      const sendAttempts: string[] = [];
      const fakeRpc = async (route: Route) => {
        const req = route.request();
        const cors = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "POST, OPTIONS",
        };
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const body = req.postDataJSON() as { id: number; method: string; params: Record<string, unknown> };
        const reply = (result: unknown) =>
          route.fulfill({
            headers: cors,
            contentType: "application/json",
            json: { jsonrpc: "2.0", id: body.id, result },
          });
        if (body.method === "send_tx") {
          sendAttempts.push(req.url());
          return route.abort("connectionrefused"); // every node fails to take the transaction
        }
        const at = { block_height: 1000, block_hash: blockHash };
        if (body.method === "query" && body.params.request_type === "view_access_key_list")
          return reply({
            keys: [{ public_key: publicKeyText, access_key: { nonce: 5, permission: "FullAccess" } }],
            ...at,
          });
        if (body.method === "query" && body.params.request_type === "view_access_key")
          return reply({ nonce: 5, permission: "FullAccess", ...at });
        if (body.method === "query" && body.params.request_type === "view_account")
          return reply({
            amount: "10000000000000000000000000",
            locked: "0",
            code_hash: "11111111111111111111111111111111",
            storage_usage: 182,
            ...at,
          });
        return route.fulfill({
          headers: cors,
          contentType: "application/json",
          json: {
            jsonrpc: "2.0",
            id: body.id,
            error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_BLOCK" }, message: "not faked" },
          },
        });
      };
      await page.route(/https:\/\/[a-z.-]*(fastnear\.com|near\.org)\//, fakeRpc);
      await page.route("**/faucet", (r) => r.abort());

      await page.goto(`/lesson/${ID}?mode=testnet&view=${view}`);
      await expect(page.getByTestId("mode-pill")).toHaveText("Testnet", { timeout: 20_000 });
      await expectView(page, view);
      await expect(page.getByTestId("account-id")).toHaveText(accountId);
      await expect(page.getByTestId("practice-balance")).toHaveText("10 NEAR");
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Build" }).click();
      await expect(page.getByTestId("tx-nonce")).toHaveText("6");
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Got it" }).click();
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Sign" }).click();
      await expect(page.getByTestId("tx-hash")).toHaveText(BASE58_HASH);
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Send" }).click();

      const error = page.getByTestId("tx-error");
      await expect(error).toBeVisible({ timeout: 20_000 });
      await expect(error).toContainText("The RPC node did not answer");
      await expect(error).toContainText("Could not reach NEAR testnet");
      expect(sendAttempts.length).toBeGreaterThan(0);
      await expect(page.getByTestId("tx-node")).toHaveText("rpc.testnet.fastnear.com");
      await expect(page.getByTestId("tx-rpc-status")).toHaveText("no answer");
      await expect(light(page, "included")).toHaveAttribute("data-lit", "false");
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();

      await error.getByRole("button", { name: "Continue in demo mode" }).click();
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await expect(page).toHaveURL(/step=2/);
      await expect(page.getByTestId("scene-status")).toHaveText(/You are in demo mode now/);
      await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
      await dock(page).getByRole("button", { name: "Build" }).click();
      await expect(light(page, "built")).toHaveAttribute("data-lit", "true");
      await expect(page.getByTestId("tx-receiver")).toContainText("book-of-near.testnet");
      await expectView(page, view);
    });

    // Opt-in: needs the real testnet. TESTNET=1 TESTNET_STORE=/path/outside/repo.json npx playwright test --grep @testnet
    // TESTNET_STORE holds a saved throwaway practice key (see src/chain/testnet/testnet.test.ts); without it a
    // fresh account comes from the Worker faucet (VITE_WORKER_URL) or NEAR's public helper.
    test("@testnet sends a real transfer and links to NearBlocks", async ({ page }) => {
      test.skip(!process.env.TESTNET, "set TESTNET=1 to run against the real testnet");
      test.skip(view === "3d", "one real transfer is enough: runs in 2D only");
      test.setTimeout(180_000);
      const storePath = process.env.TESTNET_STORE;
      if (storePath && existsSync(storePath)) {
        const saved = readFileSync(storePath, "utf8");
        await page.addInitScript((v) => localStorage.setItem("bon:testnet-practice-account:v1", v), saved);
      }
      await page.goto(`/lesson/${ID}?mode=testnet`);
      await expect(page.getByTestId("mode-pill")).toHaveText("Testnet", { timeout: 90_000 });
      await expect(page.getByTestId("practice-balance")).toHaveText(/^\d+(\.\d+)? NEAR$/, {
        timeout: 30_000,
      });
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Build" }).click();
      await expect(page.getByTestId("tx-nonce")).toHaveText(/^\d+$/, { timeout: 30_000 });
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Got it" }).click();
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Sign" }).click();
      await expect(page.getByTestId("tx-hash")).toHaveText(BASE58_HASH);
      const hash = (await page.getByTestId("tx-hash").textContent())!;
      await nextStep(page);
      await dock(page).getByRole("button", { name: "Send" }).click();
      for (const phase of ["broadcast", "included", "final"])
        await expect(light(page, phase)).toHaveAttribute("data-lit", "true", { timeout: 60_000 });
      const node = await page.getByTestId("tx-node").textContent();
      const accepted = await page.getByTestId("tx-accepted").textContent();
      const times = await Promise.all(
        ["broadcast", "included", "final"].map((p) => page.getByTestId(`time-${p}`).textContent()),
      );
      await nextStep(page);
      await expect(page.getByTestId("tx-height")).toHaveText(/^#\d+$/);
      await nextStep(page);
      await expect(page.getByTestId("final-balance")).toHaveText(/NEAR$/);
      await nextStep(page);
      const link = dock(page).getByRole("link", { name: "Open in NearBlocks" });
      await expect(link).toHaveAttribute("href", `https://testnet.nearblocks.io/txns/${hash}`);
      await expect(link).toHaveAttribute("target", "_blank");
      await link.click();
      await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled();
      expect(await completionOf(page, ID)).toBeUndefined();
      const evidence = await page.evaluate(() => localStorage.getItem("bon:v1"));
      expect(evidence).toContain(hash);
      console.log(
        `testnet tx ${hash} via ${node}; handed over ${accepted}; broadcast/included/final ${times.join(" / ")}`,
      );
    });
  });

test.describe(`lesson ${ID}: both views`, () => {
  const labels = (page: Page) => page.locator(".stx-3d .sk-label");

  test("switching 2D → 3D → 2D mid-lesson keeps the step, the amount, the transaction and open gates", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await expectView(page, "2d");
    await nextStep(page);
    await page.getByRole("textbox", { name: "Amount" }).fill("0.02");
    await dock(page).getByRole("button", { name: "Build" }).click();
    await expect(light(page, "built")).toHaveAttribute("data-lit", "true");
    await nextStep(page);
    await dock(page).getByRole("button", { name: "Got it" }).click();
    await nextStep(page);
    await dock(page).getByRole("button", { name: "Sign" }).click();
    await expect(page.getByTestId("tx-hash")).toHaveText(BASE58_HASH);
    const hash = (await page.getByTestId("tx-hash").textContent())!;
    const next = page.getByRole("button", { name: "Next step" });
    await expect(next).toBeEnabled();

    const views = page.getByRole("group", { name: "Scene view" });
    await views.getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expect(page).toHaveURL(/step=4/);
    await expect(next).toBeEnabled(); // the Sign gate stays open
    await expect(page.getByTestId("tx-hash")).toHaveText(hash);
    await expect(light(page, "signed")).toHaveAttribute("data-lit", "true");
    await expect(dock(page).getByRole("button", { name: "Signed ✓" })).toBeDisabled();
    // The amount the learner typed is the amount the 3D scene shows, everywhere.
    await expect(labels(page).filter({ hasText: "0.02 NEAR" }).first()).toBeVisible();
    await expect(labels(page).filter({ hasText: /0\.01 NEAR/ })).toHaveCount(0);
    // Earlier steps stay done: back on Build, the built transaction shows, not a fresh form.
    await page.getByRole("button", { name: "Previous step" }).click();
    await page.getByRole("button", { name: "Previous step" }).click();
    await expect(page).toHaveURL(/step=2/);
    await expect(dock(page).getByRole("textbox", { name: "Amount" })).toHaveValue("0.02");
    await expect(dock(page).getByRole("button", { name: "Built ✓" })).toBeDisabled();
    await expect(labels(page).filter({ hasText: "transfer 0.02 NEAR" })).toBeVisible();

    await views.getByRole("button", { name: "2D" }).click();
    await expectView(page, "2d");
    await expect(page.getByTestId("tx-nonce")).toHaveText(/^\d+$/);
    await expect(next).toBeEnabled();
    await nextStep(page);
    await nextStep(page);
    await expect(page.getByTestId("tx-hash")).toHaveText(hash);
    await expect(page.locator(".stx-arrow")).toHaveText("0.02 NEAR");
  });

  test("the 3D objects do the step actions too: click the key to sign, the RPC node to send", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=3d`);
    await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
    await nextStep(page);
    await page.getByRole("button", { name: "Build the transaction" }).press("Enter");
    await expect(light(page, "built")).toHaveAttribute("data-lit", "true");
    await expect(labels(page).filter({ hasText: /^nonce \d+$/ })).toBeVisible();
    await nextStep(page);
    await dock(page).getByRole("button", { name: "Got it" }).click();
    await nextStep(page);
    await page.getByRole("button", { name: "Sign with your private key" }).press("Enter");
    await expect(light(page, "signed")).toHaveAttribute("data-lit", "true");
    await expect(page.getByTestId("tx-hash")).toHaveText(BASE58_HASH);
    await nextStep(page);
    await page.getByRole("button", { name: "Send to the RPC node" }).press("Enter");
    // The 3D view follows the chain's phase events: same lights, same demo timings as 2D.
    await expect(light(page, "final")).toHaveAttribute("data-lit", "true", { timeout: 30_000 });
    await expect(page.getByTestId("time-final")).toHaveText("+3.25 s");
    await expect(labels(page).filter({ hasText: "stopwatch: final in 3.25 s" })).toBeVisible();
    await expect(labels(page).filter({ hasText: "block #200000001" })).toBeVisible();
    // Picking an account says whose it is.
    await expectPickDetail(
      page,
      "Receiver account",
      "The app's return account book-of-near.testnet: 100.01 NEAR.",
    );
  });

  // Clickable objects react (docs/book-scene.md rule 10a; the script's "Reactions" table).
  const open3d = async (page: Page) => {
    await page.goto(`/lesson/${ID}?view=3d`);
    await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
    await expect(page.locator(".stx-3d canvas")).toHaveCount(1, { timeout: LOAD_3D });
  };

  test("3d reactions: keyboard focus on a pick button marks its object hovered", async ({ page }) => {
    await open3d(page);
    for (const name of ["Your practice account", "Build the transaction", "Sign with your private key"])
      await expectFocusMarksHover(page, name);
  });

  test("3d reactions: early picks say 'not yet' and change nothing", async ({ page }) => {
    await open3d(page);
    await expectNotYetHint(page, "Build the transaction", "Not yet: you build the transaction on step 2.");
    await expectNotYetHint(page, "Sign with your private key", "Build the transaction first (step 2).");
    await expectNotYetHint(page, "Send to the RPC node", "Sign the transaction first (step 4).");
    await expect(light(page, "built")).toHaveAttribute("data-lit", "false");
  });

  test("3d reactions: a pick plays the object's own animation, then the canvas settles", async ({ page }) => {
    await page.addInitScript(countDrawnFrames);
    await open3d(page);
    await expect(page.locator(".sk-stage")).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    await expectPickPlaysAndSettles(page, "Your practice account");
    await expect(pickButton(page, "Your practice account")).toHaveAttribute(
      "data-detail",
      /^Your practice account cf4342.+: 5 NEAR\.$/,
    );
  });

  test("3d reactions: after its step, each object shows a detail", async ({ page }) => {
    await page.addInitScript(countDrawnFrames);
    await open3d(page);
    await nextStep(page);
    await pickButton(page, "Build the transaction").press("Enter");
    await expect(light(page, "built")).toHaveAttribute("data-lit", "true");
    await expectPickDetail(
      page,
      "Build the transaction",
      /^Built on your device: transfer 0\.01 NEAR to book-of-near\.testnet, nonce \d+, recent block hash \S+\.$/,
    );
    await expectPickPlaysAndSettles(page, "Build the transaction");
    await nextStep(page);
    await expectNotYetHint(page, "Sign with your private key", "Not yet: you sign on step 4.");
    await dock(page).getByRole("button", { name: "Got it" }).click();
    await nextStep(page);
    await pickButton(page, "Sign with your private key").press("Enter");
    await expect(light(page, "signed")).toHaveAttribute("data-lit", "true");
    await expectPickDetail(
      page,
      "Sign with your private key",
      /^Signed on your device with your private key\. Transaction ID: \S+\.$/,
    );
    await nextStep(page);
    await pickButton(page, "Send to the RPC node").press("Enter");
    await expect(light(page, "broadcast")).toHaveAttribute("data-lit", "true", { timeout: 30_000 });
    await expectPickDetail(page, "Send to the RPC node", /^Passed to the validators by a demo node/);
  });

  test("3d reactions under reduced motion: hover still marks, a pick shows its detail with no motion", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await seedRoute(page);
    await open3d(page);
    await expectFocusMarksHover(page, "Receiver account");
    const account = pickButton(page, "Receiver account");
    await account.evaluate((el) => {
      const w = window as unknown as { __pickSeen: string[] };
      w.__pickSeen = [];
      new MutationObserver(() => w.__pickSeen.push(el.getAttribute("data-pick") ?? "")).observe(el, {
        attributes: true,
        attributeFilter: ["data-pick"],
      });
    });
    await account.press("Enter");
    await expect(account).toHaveAttribute("data-detail", /^The app's return account/);
    const seen = await page.evaluate(() => (window as unknown as { __pickSeen: string[] }).__pickSeen);
    expect(seen).not.toContain("playing");
    await ctx.close();
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
    await expectView(page, "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
  });

  test("2D never downloads three.js; 3D loads it when chosen", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") && r.status() === 200) scripts.push(await r.text().catch(() => ""));
    });
    await page.goto(`/lesson/${ID}?view=2d`);
    await expect(page.getByTestId("practice-balance")).toHaveText("5 NEAR");
    await nextStep(page);
    await dock(page).getByRole("button", { name: "Build" }).click();
    await expect(light(page, "built")).toHaveAttribute("data-lit", "true");
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expect.poll(() => scripts.some((s) => s.includes("WebGLRenderer"))).toBe(true);
  });
});
