import { expect, test, type Page } from "@playwright/test";
import {
  answerCheck,
  completionOf,
  countDrawnFrames,
  expectFocusMarksHover,
  expectNotYetHint,
  expectPickDetail,
  expectPickPlaysAndSettles,
  expectSettled,
  LOAD_3D,
  nextStep,
  pickButton,
  seedRoute,
  slow3d,
  slow3dUnless2d,
} from "./helpers";

// Walks lesson 5.2 in demo mode (no wallet, no network): the bot's .env, the agent starts and makes its
// key, registers with a model of the reference agent contract, the developer is refused twice, and the
// agent asks its contract for an Ethereum signature (the address derived from DemoChain's demo signer).
const ID = "l-5-2-agent-with-no-owner";
const TITLE = "An agent with no owner";
const STAGE = 5;
const ANSWERS = [
  "Whoever can read the file (the developer, an attacker, the host) can sign anything as the bot.",
  "The agent contract's: it is derived from the contract's account and a path.",
  'The agent contract refuses: "Agent not registered".',
];

test.beforeEach(async ({ page }, info) => {
  slow3dUnless2d(info);
  await seedRoute(page);
});

const scene = (page: Page) => page.getByTestId("nao-scene");
const dock = (page: Page) => page.locator(".action-slot");
const next = (page: Page) => page.getByRole("button", { name: "Next step" });

async function expectView(page: Page, view: "2d" | "3d") {
  await expect(scene(page)).toHaveAttribute("data-view", view, { timeout: LOAD_3D });
}

/** Next, then wait until the new step is on screen (in 3D the words change after the page turn). */
async function go(page: Page, caption: string | RegExp) {
  await nextStep(page);
  await expect(page.getByTestId("caption")).toContainText(caption);
}

/** From the hook to "Lesson done". */
async function walk(page: Page) {
  await expect(page.getByTestId("caption")).toContainText("Most bots sign with a key");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Open the .env file" }).click();
  await expect(page.getByTestId("env-file")).toContainText("BOT_PRIVATE_KEY=");
  await expect(scene(page)).toHaveAttribute("data-scene-state", /env:open/);

  await go(page, "makes its key inside a TEE");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Start the agent" }).click();
  await expect(page.getByTestId("agent-account")).toContainText(/[0-9a-f]{8}…[0-9a-f]{8}/);
  await expect(scene(page)).toHaveAttribute("data-scene-state", /agent:running/);

  await go(page, "The agent registers");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Register the agent" }).click();
  await expect(page.getByTestId("reg-checks").locator('li[data-ok="yes"]')).toHaveCount(4);
  await expect(page.getByTestId("measurements-source")).toContainText("recorded on 13 Nov 2026");
  await expect(page.getByTestId("measurements-source")).toContainText(
    "A model of the reference agent contract",
  );
  await expect(scene(page)).toHaveAttribute("data-scene-state", /registered:yes/);

  await go(page, "Can the developer");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Sign as the developer" }).click();
  await expect(page.getByTestId("dev-result")).toContainText("Agent not registered");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Register a changed copy" }).click();
  await expect(page.getByTestId("copy-result")).toContainText("Attestation verification failed");
  await expect(page.getByTestId("attack-verdict")).toBeVisible();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /dev:refused;copy:refused/);

  await go(page, "Ethereum signature");
  await expect(next(page)).toBeDisabled();
  await dock(page).getByRole("button", { name: "Run the agent" }).click();
  await expect(scene(page)).toHaveAttribute("data-scene-state", /run:done/, { timeout: 15_000 });
  await expect(page.getByTestId("eth-address")).toHaveText(/^0x[0-9a-fA-F]{40}$/);
  await expect(page.getByTestId("sign-call")).toContainText("sign on v1.signer-prod.testnet, 1 yoctoNEAR");
  await expect(page.getByTestId("address-source")).toContainText("Demo mode");
  await expect(page.getByTestId("address-source")).toContainText("nothing was sent");

  await go(page, "Three questions");
  await answerCheck(page, ANSWERS);
  await nextStep(page); // check → honest take
  const honest = page.getByRole("region", { name: "Honest take" });
  await expect(honest).toBeVisible();
  await expect(honest).toContainText("The contract owner approves new code");
  await expect(honest).toContainText("deprecated");
  await page.getByRole("button", { name: "Finish lesson" }).click();
  await expect(page.getByText("Lesson done")).toBeVisible();
}

for (const view of ["2d", "3d"] as const)
  test.describe(`lesson ${ID} (${view})`, () => {
    test.beforeEach(() => slow3d(view === "3d"));

    test("walks to Finish in demo mode, refusing the developer", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript((v) => localStorage.setItem("bon:view", v), view);
      await page.goto("/");
      await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: TITLE }).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${ID}`));
      await expect(page.getByTestId("mode-pill")).toHaveText("Demo mode");
      await expectView(page, view);
      await walk(page);
      expect(await completionOf(page, ID)).toMatchObject({
        stage: STAGE,
        mode: "demo",
        evidence: {
          agentContract: "agent.example.testnet",
          agentAccount: expect.stringMatching(/^[0-9a-f]{64}$/),
          derivedAddress: expect.stringMatching(/^0x[0-9a-fA-F]{40}$/),
          developerRefused: "Agent not registered",
          copyRefused: "true",
          contractModel: "reference agent contract (in browser)",
          signer: "demo signer",
        },
      });
      expect(errors).toEqual([]);
    });

    test("walks with reduced motion", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedRoute(page);
      await page.goto(`/lesson/${ID}?view=${view}`);
      await expectView(page, view);
      await walk(page);
      await context.close();
    });
  });

test.describe(`lesson ${ID}`, () => {
  test("2D objects do the step's action, say 'not yet' too early, and show a detail after", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d`);
    await expectView(page, "2d");
    const note = page.getByTestId("picked-note");
    await page.getByRole("button", { name: "The developer's key" }).press("Enter");
    await expect(note).toHaveAttribute("data-not-yet", "yes");
    await expect(note).toContainText("Not yet: the developer tries this key on step 4.");
    await page.getByRole("button", { name: "The agent contract" }).press("Enter");
    await expect(note).toContainText("Start the agent first (step 2).");
    await page.getByRole("button", { name: "The developer's laptop" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /env:open/);
    await page.getByRole("button", { name: "The developer's laptop" }).press("Enter");
    await expect(note).not.toHaveAttribute("data-not-yet", "yes");
    await expect(note).toContainText("Anyone who reads the file can sign as the bot");
    await go(page, "makes its key inside a TEE");
    await page.getByRole("button", { name: "The agent contract" }).press("Enter");
    await expect(note).toContainText("Start the agent first (step 2).");
    await page.getByRole("button", { name: "The agent's enclave" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /agent:running/);
    await go(page, "The agent registers");
    await page.getByRole("button", { name: "The agent contract" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /registered:yes/);
    await go(page, "Can the developer");
    await page.getByRole("button", { name: "The developer's key" }).press("Enter");
    await page.getByRole("button", { name: "The agent's enclave" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dev:refused;copy:refused/);
    await page.getByRole("button", { name: "The developer's key" }).press("Enter");
    await expect(note).toContainText('Refused: "Agent not registered"');
    await go(page, "Ethereum signature");
    await page.getByRole("button", { name: "The contract's Ethereum address" }).press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /run:done/, { timeout: 15_000 });
    await page.getByRole("button", { name: "The signing network" }).press("Enter");
    await expect(note).toContainText("sign called by agent.example.testnet, path ethereum-1");
  });

  test("opening a later step by its link fills in the free steps but leaves the check to the learner", async ({
    page,
  }) => {
    await page.goto(`/lesson/${ID}?view=2d&step=6`);
    await expect(page.getByRole("dialog", { name: "Quick check" })).toBeVisible();
    await expect(next(page)).toBeDisabled();
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await expect(scene(page)).toHaveAttribute(
      "data-scene-state",
      "env:open;agent:running;registered:yes;dev:refused;copy:refused;run:idle",
    );
  });

  test("without WebGL the lesson runs in 2D with no view switch", async ({ page }) => {
    await page.goto(`/lesson/${ID}?webgl=0&view=3d`);
    await expectView(page, "2d");
    await expect(page.getByRole("group", { name: "Scene view" })).toHaveCount(0);
    await dock(page).getByRole("button", { name: "Open the .env file" }).click();
    await expect(page.getByTestId("env-file")).toBeVisible();
  });

  test("phone layout: the 2D page and its facts fit the screen", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await dock(page).getByRole("button", { name: "Run the agent" }).click();
    await expect(page.getByTestId("eth-address")).toBeVisible({ timeout: 15_000 });
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    await ctx.close();
  });

  test("2D to 3D keeps the agent, the refusals and the run", async ({ page }) => {
    slow3d();
    await page.goto(`/lesson/${ID}?view=2d&step=5`);
    await dock(page).getByRole("button", { name: "Run the agent" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /run:done/, { timeout: 15_000 });
    const address = await page.getByTestId("eth-address").textContent();
    await page.getByRole("group", { name: "Scene view" }).getByRole("button", { name: "3D" }).click();
    await expectView(page, "3d");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dev:refused;copy:refused;run:done/);
    await expect(page.getByTestId("eth-address")).toHaveText(address!);
    await expect(next(page)).toBeEnabled();
  });

  test("the stage 5 badge: honest about stage 4 first, then claimable in demo mode", async ({ page }) => {
    // Stages 0 to 4 and lesson 5.1 already done (completion records as the lessons write them).
    const done = (lessonId: string, evidence?: Record<string, string>) => ({
      lessonId,
      stage: Number(lessonId.split("-")[1]),
      route: "newcomer",
      mode: "demo",
      completedAt: "2026-11-13T10:00:00.000Z",
      ...(evidence ? { evidence } : {}),
    });
    const completions = [
      done("l-0-1-blockchain-basics"),
      done("l-0-2-make-a-wallet"),
      done("l-0-3-send-a-transaction", { txHash: "T0" }),
      done("l-1-1-claim-your-name", { txHash: "N1", accountId: "learner.testnet" }),
      done("l-1-2-function-call-key", { addKeyTxHash: "A1", txHash: "D1" }),
      done("l-1-3-inside-a-transaction"),
      done("l-2-1-follow-across-shards", { txHash: "T2" }),
      done("l-2-2-call-across-blocks"),
      done("l-3-1-deploy-a-contract", { txHash: "T3", contractId: "counter.learner.testnet" }),
      done("l-3-2-issue-a-token"),
      done("l-3-3-race-the-rpc"),
      done("l-4-1-one-account-every-chain", { mpcTxHash: "M4" }),
      done("l-4-2-intent-swap"),
      done("l-4-3-old-bridge-vs-near"),
      done("l-5-1-private-ai"),
    ];
    await page.addInitScript((c) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(
          "bon:v1",
          JSON.stringify({ v: 1, route: "newcomer", completions: c, evidence: {} }),
        );
        sessionStorage.setItem("seeded", "1");
      }
    }, completions);
    const box = (n: number) => page.getByRole("region", { name: `Stage ${n} badge` });

    // Before 5.2: the stage 5 card names the missing lesson and the stage 4 badge.
    await page.goto("/");
    await expect(box(5)).toContainText("Finish lesson 5.2.");
    await expect(box(5)).toContainText("Claim the stage 4 badge first.");

    // Finish 5.2 (opened at the check: the free steps fill in).
    await page.goto(`/lesson/${ID}?view=2d&step=6`);
    await answerCheck(page, ANSWERS);
    await nextStep(page);
    await page.getByRole("button", { name: "Finish lesson" }).click();
    await expect(page.getByText("Lesson done")).toBeVisible();

    // The lessons are done; the contract still wants stage 4 first, and the page says so.
    await page.goto("/");
    await expect(box(5)).toContainText("Claim the stage 4 badge first.");
    await expect(box(5)).not.toContainText("Finish lesson");
    for (const n of [0, 1, 2, 3, 4]) {
      await box(n)
        .getByRole("button", { name: `Claim the stage ${n} badge` })
        .click();
      await expect(box(n)).toContainText(`Stage ${n} badge claimed`);
      // Each card reads the badges it needs when the page loads; demo badges survive a reload.
      await page.reload();
    }
    await expect(box(5)).toContainText("Your badge is ready");
    await box(5).getByRole("button", { name: "Claim the stage 5 badge" }).click();
    await expect(box(5)).toContainText("Stage 5 badge claimed");
    await page.goto("/my-book");
    await expect(page.getByText("6 of 7 claimed.")).toBeVisible();
    const shelf = page.getByRole("list", { name: "My badges" });
    await expect(shelf.locator('[data-stage="5"]')).toContainText("Claimed");
    await expect(shelf.locator('[data-stage="7"]')).toContainText("Badge not available yet");
  });
});

test.describe("3D book scene", () => {
  test.beforeEach(() => slow3d());

  test("wide screens print the step on the left page; the tour moves the camera and docks the words", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=4`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).toHaveAttribute("data-spread", "");
    await expect(page.locator(".book-page")).toHaveCSS("transform", /matrix3d/);
    // The printed actions still work.
    await dock(page).getByRole("button", { name: "Sign as the developer" }).click();
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dev:refused/);

    const caption = page.getByTestId("tour-caption");
    await expect(caption).toHaveText(/^Fig\. 4/);
    await page.getByRole("button", { name: "Play the tour" }).click();
    await expect(caption).not.toHaveText(/^Fig\. 4/);
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.getByTestId("caption")).toBeVisible();
    await ctx.close();
  });

  test("phones keep the step's words docked, not printed on the page", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=3`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expect(page.locator("main.lesson")).not.toHaveAttribute("data-spread", /.*/);
    await expect(page.locator(".book-page")).toHaveCSS("display", "contents");
    await ctx.close();
  });

  test("an idle 3d scene draws no frames (render on demand)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(countDrawnFrames);
    await page.goto(`/lesson/${ID}?view=3d`);
    const stage = page.locator(".sk-stage").first();
    await expect(stage).toHaveAttribute("data-camera", "still", { timeout: LOAD_3D });
    await expect(stage).not.toHaveAttribute("data-pop", /./, { timeout: LOAD_3D });
    await expectSettled(page);
  });

  // Rule 10a: every clickable object reacts (docs/lessons/stage-5/5.2.md, "Reactions").
  const open3d = async (page: Page, step = 1) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/lesson/${ID}?view=3d&step=${step}`);
    await expect(page.locator(".book-scene .sk-stage")).toHaveAttribute("data-camera", "still", {
      timeout: LOAD_3D,
    });
  };

  test("3d reactions: focus marks every object hovered", async ({ page }) => {
    await open3d(page);
    for (const name of [
      "The developer's laptop",
      "The developer's key",
      "The agent's enclave",
      "The agent contract",
      "The signing network",
      "The contract's Ethereum address",
    ])
      await expectFocusMarksHover(page, name);
  });

  test("3d reactions: early picks say 'not yet' and change nothing", async ({ page }) => {
    await open3d(page);
    await expectNotYetHint(page, "The developer's key", "Not yet: the developer tries this key on step 4.");
    await expectNotYetHint(page, "The agent's enclave", "Not yet: the agent starts on step 2.");
    await expectNotYetHint(page, "The agent contract", "Start the agent first (step 2).");
    await expectNotYetHint(page, "The signing network", "Not yet: the agent asks for a signature on step 5.");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /env:closed;agent:none/);
  });

  test("3d reactions: a pick does the step's action with its own animation, then the canvas settles; a detail after", async ({
    page,
  }) => {
    await page.addInitScript(countDrawnFrames);
    await open3d(page, 2);
    await expectPickPlaysAndSettles(page, "The agent's enclave");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /agent:running/);
    await expectPickDetail(page, "The agent's enclave", /implicit account made from a key the agent made/);
    await expectPickDetail(page, "The developer's laptop", /Anyone who reads the file can sign as the bot/);
    await expectNotYetHint(page, "The agent contract", "Not yet: the agent registers on step 3.");
  });

  test("3d reactions: the key and the enclave are refused on step 4, then show their details", async ({
    page,
  }) => {
    await open3d(page, 4);
    await pickButton(page, "The developer's key").press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /dev:refused/);
    await pickButton(page, "The agent's enclave").press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /copy:refused/);
    await expectPickDetail(page, "The developer's key", /Refused: "Agent not registered"/);
    await expectPickDetail(page, "The agent's enclave", /A changed copy of the code was refused/);
    await expectPickDetail(page, "The agent contract", /registered the agent: genuine quote/);
  });

  test("3d reactions under reduced motion: hover still marks, a pick shows its detail with no motion", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await seedRoute(page);
    await page.goto(`/lesson/${ID}?view=3d&step=1`);
    await expect(page.locator(".book-scene .sk-stage")).toBeVisible({ timeout: LOAD_3D });
    await expectFocusMarksHover(page, "The developer's laptop");
    await pickButton(page, "The developer's laptop").press("Enter");
    await expect(scene(page)).toHaveAttribute("data-scene-state", /env:open/);
    await expect(pickButton(page, "The developer's laptop")).toHaveAttribute("data-pick", "idle");
    await expectPickDetail(page, "The developer's laptop", /Anyone who reads the file/);
    await ctx.close();
  });
});
