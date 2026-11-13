import { expect, type Page } from "@playwright/test";
import { answerCheck, dock, dockButton, finish, nextStep } from "../lessons/helpers";

/**
 * One short walk per shipped lesson, for the judge's path (e2e/judge-path.spec.ts) and the badge flow
 * (e2e/badges.spec.ts). Each walk starts on the lesson's first step, in the 2D view, in demo mode, and
 * does only what opens each gate, answers the check and presses Finish. The lesson specs in
 * e2e/lessons/ check every step in detail; these walks prove the lessons still run end to end, one
 * after another, in one browser profile, as a judge would click through them.
 *
 * To add a lesson: write its walk here and add one line to `WALKS` at the bottom.
 */

const BASE58_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const T = { timeout: 15_000 };

const next = (page: Page) => page.getByRole("button", { name: "Next step" });
const sceneState = (page: Page) => page.locator("[data-scene-state]").first();
const state = (page: Page, re: RegExp) => expect(sceneState(page)).toHaveAttribute("data-scene-state", re, T);

// ---------- stage 0 ----------

export async function play01(page: Page) {
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

export async function play02(page: Page) {
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

/** Returns the demo transaction's hash (the stage 0 badge's evidence). */
export async function play03(page: Page): Promise<string> {
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

// ---------- stage 1 ----------

export async function play11(page: Page, name = "judge-path") {
  await nextStep(page);
  await nextStep(page);
  await expect(next(page)).toBeDisabled();
  await page.getByRole("textbox", { name: "Account name" }).fill(name);
  await expect(page.getByTestId("name-feedback")).toHaveText(`${name}.testnet is free.`);
  await nextStep(page);
  await dockButton(page, `Create ${name}.testnet`).click();
  await expect(page.getByTestId("new-account-id")).toHaveText(`${name}.testnet`, { timeout: 30_000 });
  await nextStep(page);
  await nextStep(page);
  await answerCheck(page, [
    "The address of an account: a name or a hex string.",
    "A transaction asked the testnet registrar contract to create it and fund it.",
    "ana-1.testnet",
  ]);
  await nextStep(page);
  await finish(page, "l-1-1-claim-your-name");
}

export async function play12(page: Page) {
  await nextStep(page);
  await nextStep(page);
  await page.getByLabel("Allowance").fill("0.1");
  await page.getByRole("button", { name: "Give the app a key" }).click();
  await state(page, /key:active/);
  await nextStep(page);
  await page.getByRole("button", { name: "Count", exact: true }).click();
  await state(page, /counter:1/);
  await nextStep(page);
  for (const [i, misuse] of [
    "Send NEAR to the attacker",
    "Call another contract",
    "Add a full-access key for the attacker",
  ].entries()) {
    await page.getByRole("button", { name: misuse }).first().click();
    await state(page, new RegExp(`refused:${i + 1}`));
  }
  await nextStep(page);
  await page.getByRole("button", { name: "Delete the app's key" }).click();
  await state(page, /key:revoked/);
  await page.getByRole("button", { name: "Count again" }).click();
  await state(page, /gone:shown/);
  await nextStep(page);
  await answerCheck(page, [
    "Send NEAR to another account.",
    "Delete the key with a transaction signed by your full-access key.",
  ]);
  await nextStep(page);
  await finish(page, "l-1-2-function-call-key");
}

export async function play13(page: Page) {
  await nextStep(page);
  await page.getByRole("button", { name: "Make the workshop account" }).click();
  await state(page, /parent:yes/);
  await nextStep(page);
  await page.getByLabel("New account name").fill("shop");
  await page.getByLabel("Amount to send").fill("0.02");
  await page.getByRole("button", { name: "Add: Create account" }).click();
  await page.getByRole("button", { name: "Add: Send NEAR" }).click();
  await page.getByRole("button", { name: "Add: Add a key" }).click();
  await page.getByRole("button", { name: "Send the batch" }).click();
  await state(page, /batch:ok/);
  await nextStep(page);
  await page.getByRole("button", { name: "Send the batch" }).click();
  await state(page, /failed:yes;rolledback:yes/);
  await nextStep(page);
  await page.getByRole("button", { name: "Re-send the batch that worked" }).click();
  await state(page, /replayed:1/);
  await nextStep(page);
  await answerCheck(page, [
    "No new account. The NEAR came back; only the fee is spent.",
    "Its nonce was already used by that key.",
    "No. All its actions go to its one receiver.",
  ]);
  await nextStep(page);
  await finish(page, "l-1-3-inside-a-transaction");
}

// ---------- stage 2 ----------

/** Follows the learner's own 0.3 transaction (the stage 2 badge's evidence). */
export async function play21(page: Page) {
  await dock(page)
    .getByRole("button", { name: /^My 0\.3 transaction/ })
    .click();
  await dockButton(page, "Load transaction path").click();
  await expect(page.getByTestId("trace-tx")).toHaveText(BASE58_HASH);
  await nextStep(page);
  await nextStep(page);
  await nextStep(page);
  const total = Number(await page.getByTestId("hop-total").textContent());
  for (let i = 1; i < total; i++) {
    await dockButton(page, "Follow next receipt").click();
    await expect(page.getByTestId("hop-index")).toHaveText(String(i + 1));
  }
  await nextStep(page);
  await dockButton(page, "Inspect breakdown").click();
  await expect(page.getByTestId("breakdown")).toBeVisible();
  await nextStep(page);
  await answerCheck(page, [
    "The transactions and receipts one shard ran for one block.",
    "The shard that holds the signer's account.",
    "Each receipt runs in a later block, often on another shard.",
  ]);
  await nextStep(page);
  await finish(page, "l-2-1-follow-across-shards");
}

export async function play22(page: Page) {
  await nextStep(page);
  await nextStep(page);
  await page.getByRole("button", { name: "Send cross-contract order", exact: true }).click();
  await state(page, /order:done;hops:3\/3/);
  await nextStep(page);
  await page.getByRole("button", { name: "Inspect gas", exact: true }).click();
  await state(page, /gas:open/);
  await nextStep(page);
  await page.getByRole("button", { name: "Simulate out-of-stock failure", exact: true }).click();
  await state(page, /fail:done/);
  await nextStep(page);
  await answerCheck(page, [
    "They stay committed. Your callback must see the failure and undo them itself.",
    "All of it is burned. No account receives it.",
    "Contracts can live on different shards and run in parallel without locking the whole network.",
  ]);
  await nextStep(page);
  await finish(page, "l-2-2-call-across-blocks");
}

// ---------- stage 3 ----------

export async function play31(page: Page) {
  await nextStep(page);
  await nextStep(page);
  await page.getByRole("button", { name: "Deploy counter contract", exact: true }).click();
  await state(page, /deployed:yes/);
  await nextStep(page);
  await page.getByRole("button", { name: "Increment", exact: true }).click();
  await state(page, /count:1;/);
  await page.getByRole("button", { name: "Read the count", exact: true }).click();
  await state(page, /read:1;/);
  await nextStep(page);
  await page.getByRole("button", { name: "Call fail with a callback", exact: true }).click();
  await state(page, /callback:failed/);
  await nextStep(page);
  await page.getByRole("button", { name: "Reset and clear state", exact: true }).click();
  await state(page, /cleared:yes/);
  await nextStep(page);
  await answerCheck(page, [
    "By locking a refundable deposit of 1 NEAR per 100 KB of data stored.",
    "It is unlocked and returned to your available balance.",
    "Standard WebAssembly (Wasm).",
  ]);
  await nextStep(page);
  await finish(page, "l-3-1-deploy-a-contract");
}

export async function play32(page: Page) {
  await nextStep(page);
  await page.getByRole("button", { name: "Mint BOOK tokens", exact: true }).click();
  await state(page, /minted:yes/);
  await nextStep(page);
  await page.getByRole("button", { name: "Send 50 BOOK to friend.testnet", exact: true }).click();
  await state(page, /refused:yes/);
  await nextStep(page);
  await page.getByRole("button", { name: "Pay storage deposit for friend", exact: true }).click();
  await state(page, /registered:yes/);
  await nextStep(page);
  await page.getByRole("button", { name: "Sign gasless transfer", exact: true }).click();
  await state(page, /relayed:1;/);
  await nextStep(page);
  await answerCheck(page, [
    "The receiver has no storage deposit to pay for its balance record in the token contract.",
    "They can send tokens without holding NEAR for gas first.",
    "It is refunded to the account.",
  ]);
  await nextStep(page);
  await finish(page, "l-3-2-issue-a-token");
}

export async function play33(page: Page) {
  await nextStep(page);
  await page.getByRole("button", { name: "Race the nodes", exact: true }).click();
  await state(page, /race:done;fastest:fastnear/);
  await nextStep(page);
  await page.getByRole("button", { name: "Disable FastNEAR", exact: true }).click();
  await state(page, /blocked:fastnear/);
  await nextStep(page);
  await page.getByRole("button", { name: "Send query via failover", exact: true }).click();
  await state(page, /failover:near-org/);
  await nextStep(page);
  await page.getByRole("button", { name: "Query historical block", exact: true }).click();
  await state(page, /archive:done/);
  await nextStep(page);
  await answerCheck(page, [
    "If that one provider has an outage, the whole dApp goes dark for its users.",
    "A regular node keeps only the last 5 epochs of history; an archival node keeps every block since the first one.",
    "It tries the request again on the next provider in its fallback list.",
  ]);
  await nextStep(page);
  await finish(page, "l-3-3-race-the-rpc");
}

// ---------- stage 4 ----------

export async function play41(page: Page) {
  await nextStep(page);
  await dockButton(page, "Derive Ethereum address").click();
  await expect(page.getByTestId("eth-address")).toHaveText(/^0x[0-9a-fA-F]{40}$/);
  await nextStep(page);
  await dockButton(page, "Prepare payload").click();
  await expect(page.getByTestId("payload")).toHaveText(/^0x[0-9a-f]{64}$/);
  await nextStep(page);
  await dockButton(page, "Request signature (MPC)").click();
  await expect(page.getByTestId("sign-status")).toContainText("Signed.", T);
  await nextStep(page);
  await dockButton(page, "Verify signer").click();
  await expect(page.getByTestId("match")).toContainText("Match");
  await nextStep(page);
  await answerCheck(page, [
    "Nobody holds the whole key. It exists only as shares spread across the signing nodes.",
    "Nothing. It is math done in your browser, with no transaction.",
    "No. Ethereum needs ETH for gas, so someone must fund it first, or a relayer must pay.",
  ]);
  await nextStep(page);
  await finish(page, "l-4-1-one-account-every-chain");
}

export async function play42(page: Page) {
  await nextStep(page);
  await dockButton(page, "Fetch live intent quote").click();
  await state(page, /quote:recorded/);
  await nextStep(page);
  await dockButton(page, "Inspect quote breakdown").click();
  await expect(page.getByTestId("min-out")).toBeVisible();
  await nextStep(page);
  await dockButton(page, "Simulate solver execution").click();
  await state(page, /fill:done/);
  await nextStep(page);
  await dockButton(page, "Finish on verified quote").click();
  await nextStep(page);
  await answerCheck(page, [
    "An intent states the result you want; solvers find and carry out the best route.",
    "They pay out from money they already hold on the destination chain.",
    "No. The solver pays the destination gas as part of the quote.",
  ]);
  await nextStep(page);
  await finish(page, "l-4-2-intent-swap");
}

export async function play43(page: Page) {
  await nextStep(page);
  await dockButton(page, "Compare workflow steps").click();
  await state(page, /played:6/);
  await nextStep(page);
  await dockButton(page, "Inspect asset backing").click();
  await expect(page.getByTestId("backing")).toContainText("an IOU");
  await nextStep(page);
  await dockButton(page, "Trigger simulated vault exploit").click();
  await state(page, /exploit:done/);
  await nextStep(page);
  await dockButton(page, "Inspect confidential shield").click();
  await state(page, /shield:on/);
  await nextStep(page);
  await answerCheck(page, [
    "They keep big pools of user coins in vault contracts run by a few signers or a multi-sig.",
    "They lose their backing and their value falls towards zero.",
    "You receive native coins directly; the solvers carry the cross-chain inventory risk themselves.",
  ]);
  await nextStep(page);
  await finish(page, "l-4-3-old-bridge-vs-near");
}

// ---------- stage 5 ----------

export async function play51(page: Page) {
  await nextStep(page);
  await dockButton(page, "Read the memory as root").click();
  await state(page, /dump:yes/);
  await nextStep(page);
  await dockButton(page, "What is a named account?").click();
  await dockButton(page, "Send prompt").click();
  await state(page, /asked:1;answered:yes/);
  await nextStep(page);
  await dockButton(page, "Fetch attestation quote").click();
  await state(page, /quote:recorded/);
  await nextStep(page);
  await dockButton(page, "Verify in my browser").click();
  await expect(page.getByTestId("verdict")).toContainText("Verified");
  await dockButton(page, "Change one byte and verify again").click();
  await state(page, /verify:ok;tamper:failed/);
  await nextStep(page);
  await answerCheck(page, [
    "The processor encrypts its memory in hardware, so even root admins cannot read it.",
    "A report signed by the chip that proves which code runs inside a genuine enclave.",
    "Encrypted noise.",
  ]);
  await nextStep(page);
  await finish(page, "l-5-1-private-ai");
}

export async function play52(page: Page) {
  await dockButton(page, "Open the .env file").click();
  await state(page, /env:open/);
  await nextStep(page);
  await dockButton(page, "Start the agent").click();
  await state(page, /agent:running/);
  await nextStep(page);
  await dockButton(page, "Register the agent").click();
  await state(page, /registered:yes/);
  await nextStep(page);
  await dockButton(page, "Sign as the developer").click();
  await expect(page.getByTestId("dev-result")).toContainText("Agent not registered");
  await dockButton(page, "Register a changed copy").click();
  await state(page, /dev:refused;copy:refused/);
  await nextStep(page);
  await dockButton(page, "Run the agent").click();
  await state(page, /run:done/);
  await nextStep(page);
  await answerCheck(page, [
    "Whoever can read the file (the developer, an attacker, the host) can sign anything as the bot.",
    "The agent contract's: it is derived from the contract's account and a path.",
    'The agent contract refuses: "Agent not registered".',
  ]);
  await nextStep(page);
  await finish(page, "l-5-2-agent-with-no-owner");
}

// ---------- stage 6 ----------

/** Votes `choice` (YES by default; the README says "Vote YES or no"). One vote per voter. */
export async function play61(page: Page, choice: "yes" | "no" = "yes") {
  await nextStep(page);
  await nextStep(page);
  await page.getByRole("slider", { name: /Time locked/ }).fill("48");
  await state(page, /months:48;locked:yes/);
  await nextStep(page);
  await dockButton(page, "Review proposal").click();
  await expect(page.getByTestId("proposal-details")).toBeVisible();
  await nextStep(page);
  await dockButton(page, `Vote ${choice.toUpperCase()}`).click();
  await expect(page.getByTestId("vote-status")).toHaveText(
    `Practice vote: +300 veNEAR ${choice.toUpperCase()}. Nothing was sent to a chain.`,
  );
  await state(page, new RegExp(`vote:${choice}`));
  await nextStep(page);
  await answerCheck(page, [
    "To give more voting power to people who keep their NEAR locked longer.",
    "After an unbonding period of 4 epochs, a little over a day.",
    "Voting power is fixed when the vote opens, and locked NEAR takes 45 days to come out.",
  ]);
  await nextStep(page);
  await finish(page, "l-6-1-vote-on-a-proposal");
}

export async function play62(page: Page) {
  await nextStep(page);
  await dockButton(page, "Compare the two USDCs").click();
  await expect(page.getByTestId("supplies")).toContainText("79.3 million");
  await nextStep(page);
  await dockButton(page, "Read the oracle").click();
  await expect(page.getByTestId("oracle")).toContainText("too old");
  await nextStep(page);
  await dockButton(page, "Trade 100 USDC").click();
  await expect(page.getByTestId("trade")).toContainText("100.09 USDt");
  await dockButton(page, "Trade 100,000 USDC").click();
  await state(page, /trade:100000/);
  await nextStep(page);
  await dockButton(page, "Show the flows").click();
  await state(page, /flows:yes/);
  await nextStep(page);
  await answerCheck(page, [
    "Circle issues it on NEAR itself, so no bridge stands between you and Circle.",
    "Refuse it as too old, and wait for a fresh signed update.",
    "A stable pool's curve keeps same-value tokens near 1:1; a simple pool's price moves as a big trade drains one side.",
  ]);
  await nextStep(page);
  await finish(page, "l-6-2-live-money-map");
}

// ---------- stage 7 ----------

export async function play71(page: Page) {
  await nextStep(page);
  await dockButton(page, "Authorize intent").click();
  await state(page, /authorized:yes/);
  await nextStep(page);
  await nextStep(page);
  await nextStep(page);
  await dockButton(page, "Verify foreign settlement").click();
  await state(page, /settle:done/);
  await nextStep(page);
  await answerCheck(page, [
    "So that even if the app is compromised, the account's full-access key and main funds stay safe.",
    "Through receipts that carry the call to the other shard and run in a later block.",
    "A solver pays out from funds it already holds there, and the verifier contract on NEAR settles the trade.",
  ]);
  await nextStep(page);
  await finish(page, "l-7-1-trace-an-intent");
}

export async function play72(page: Page) {
  for (const [title, dim] of [
    ["Accounts", "accounts"],
    ["Scalability", "scaling"],
    ["Speed", "execution"],
    ["Liquidity", "liquidity"],
  ] as const) {
    await nextStep(page);
    await dockButton(page, `Open the ${title} card`).click();
    await state(page, new RegExp(`dim:${dim};`));
  }
  await nextStep(page);
  await answerCheck(page, [
    "Calls between contracts are asynchronous: they take several blocks and do not roll back as one.",
    "Money locked in DeFi (TVL), institutional capital and developer attention.",
    "Every validator runs one large shared state, with no shards to split the work.",
  ]);
  await nextStep(page);
  await finish(page, "l-7-2-honest-scoreboard");
}

/**
 * Every shipped lesson, in book order, with its walk. One line per lesson (a judge-path test fails if a
 * lesson folder has none). The final exam is walked separately, after the badge claims.
 */
export const WALKS: [lessonId: string, walk: (page: Page) => Promise<unknown>][] = [
  ["l-0-1-blockchain-basics", play01],
  ["l-0-2-make-a-wallet", play02],
  ["l-0-3-send-a-transaction", play03],
  ["l-1-1-claim-your-name", play11],
  ["l-1-2-function-call-key", play12],
  ["l-1-3-inside-a-transaction", play13],
  ["l-2-1-follow-across-shards", play21],
  ["l-2-2-call-across-blocks", play22],
  ["l-3-1-deploy-a-contract", play31],
  ["l-3-2-issue-a-token", play32],
  ["l-3-3-race-the-rpc", play33],
  ["l-4-1-one-account-every-chain", play41],
  ["l-4-2-intent-swap", play42],
  ["l-4-3-old-bridge-vs-near", play43],
  ["l-5-1-private-ai", play51],
  ["l-5-2-agent-with-no-owner", play52],
  ["l-6-1-vote-on-a-proposal", play61],
  ["l-6-2-live-money-map", play62],
  ["l-7-1-trace-an-intent", play71],
  ["l-7-2-honest-scoreboard", play72],
];
