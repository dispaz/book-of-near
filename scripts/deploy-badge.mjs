#!/usr/bin/env node
/**
 * Deploy the badge contract to testnet and apply the owner settings (issue #68, docs/badge-contract.md).
 *
 *   node scripts/deploy-badge.mjs deploy [--vars worker/.dev.vars]
 *       Makes an owner account with NEAR's public testnet helper (10 NEAR), then in ONE transaction
 *       creates `badges.<owner>`, funds it, deploys contracts/badge/target/badge.wasm and calls `new`
 *       (single step, so `new` cannot be front-run). Then the owner settings. A fresh claim key pair
 *       is generated. Every secret is written to the --vars file (git-ignored), never printed.
 *   node scripts/deploy-badge.mjs settings [--vars ...]   re-applies daily cap, base URI, claim key, stage count.
 *   node scripts/deploy-badge.mjs art [--keys stage-0,stage-4] [--vars ...]
 *       set_art for every entry of public/badges/art.json (stage-0..7), or only the --keys listed.
 *
 * Reads and writes the --vars file (default worker/.dev.vars): BADGE_OWNER_ID, BADGE_OWNER_PRIVATE_KEY,
 * BADGE_CONTRACT_ID, CLAIM_SIGNING_KEY, CLAIM_PUBLIC_KEY.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Near, generateKey } from "near-kit";
import { selectArt } from "./badges-art.mjs";

const BASE_URI = "https://book-of-near.pages.dev/badges";
const STAGE_COUNT = 8;
const DAILY_CAP = 200;

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";
const varsPath = args.includes("--vars") ? args[args.indexOf("--vars") + 1] : "worker/.dev.vars";

function readVars() {
  if (!existsSync(varsPath)) return {};
  const out = {};
  for (const line of readFileSync(varsPath, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

function writeVars(update) {
  const old = existsSync(varsPath) ? readFileSync(varsPath, "utf8") : "";
  const lines = old.split("\n").filter((l) => l && !Object.keys(update).some((k) => l.startsWith(`${k}=`)));
  for (const [k, v] of Object.entries(update)) lines.push(`${k}=${v}`);
  writeFileSync(varsPath, lines.join("\n") + "\n", { mode: 0o600 });
}

const hashOf = (r) => r?.transaction?.hash ?? r?.transaction_outcome?.id ?? "?";

async function owner(vars) {
  return new Near({
    network: "testnet",
    privateKey: vars.BADGE_OWNER_PRIVATE_KEY,
    defaultSignerId: vars.BADGE_OWNER_ID,
  });
}

async function settings(vars) {
  const near = await owner(vars);
  const c = vars.BADGE_CONTRACT_ID;
  const calls = [
    ["set_stage_count", { stage_count: STAGE_COUNT }],
    ["set_daily_cap", { daily_cap: DAILY_CAP }],
    ["set_claim_key", { claim_key: vars.CLAIM_PUBLIC_KEY }],
    ["set_base_uri", { base_uri: BASE_URI }],
  ];
  for (const [method, a] of calls) {
    const r = await near
      .transaction(vars.BADGE_OWNER_ID)
      .functionCall(c, method, a, { gas: "30 Tgas" })
      .send();
    console.log(`${method}: ${hashOf(r)}`);
  }
}

async function deploy() {
  const vars = readVars();
  if (vars.BADGE_CONTRACT_ID) throw new Error(`Already deployed: ${vars.BADGE_CONTRACT_ID}. Use "settings".`);
  const ownerKey = generateKey();
  const contractKey = generateKey();
  const claimKey = generateKey();
  const ownerId = `bon-badges-${Date.now().toString(36)}.testnet`;
  const res = await fetch("https://helper.testnet.near.org/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newAccountId: ownerId, newAccountPublicKey: ownerKey.publicKey.toString() }),
  });
  if (!res.ok) throw new Error(`helper.testnet.near.org refused: ${res.status} ${await res.text()}`);
  const contractId = `badges.${ownerId}`;
  writeVars({
    BADGE_OWNER_ID: ownerId,
    BADGE_OWNER_PRIVATE_KEY: ownerKey.secretKey,
    BADGE_CONTRACT_PRIVATE_KEY: contractKey.secretKey,
    CLAIM_SIGNING_KEY: claimKey.secretKey,
    CLAIM_PUBLIC_KEY: claimKey.publicKey.toString(),
  });
  console.log(`owner account: ${ownerId}`);
  const near = new Near({ network: "testnet", privateKey: ownerKey.secretKey, defaultSignerId: ownerId });
  for (let i = 0; i < 20 && !(await near.accountExists(ownerId)); i++)
    await new Promise((r) => setTimeout(r, 1500));
  const wasm = readFileSync("contracts/badge/target/badge.wasm");
  const r = await near
    .transaction(ownerId)
    .createAccount(contractId)
    .transfer(contractId, "8 NEAR")
    .addKey(contractKey.publicKey.toString(), { type: "fullAccess" })
    .deployContract(contractId, new Uint8Array(wasm))
    .functionCall(
      contractId,
      "new",
      { owner_id: ownerId, claim_key: claimKey.publicKey.toString(), stage_count: STAGE_COUNT },
      { gas: "100 Tgas" },
    )
    .send();
  console.log(`create + deploy + new: ${hashOf(r)}`);
  writeVars({ BADGE_CONTRACT_ID: contractId });
  await settings(readVars());
  console.log(`contract: ${contractId}`);
}

async function art() {
  const vars = readVars();
  const near = await owner(vars);
  // `--keys stage-0,stage-4` sends only those entries (art for stages the contract does not count yet waits).
  const list = selectArt(JSON.parse(readFileSync("public/badges/art.json", "utf8")), args);
  for (const a of list) {
    const r = await near
      .transaction(vars.BADGE_OWNER_ID)
      .functionCall(
        vars.BADGE_CONTRACT_ID,
        "set_art",
        { key: a.key, media: a.media, media_hash: a.sha256 },
        { gas: "30 Tgas" },
      )
      .send();
    console.log(`set_art ${a.key}: ${hashOf(r)}`);
  }
}

/** `stage-count <n>`: the owner grows the stage count (it can never shrink). Owner decision, never automatic. */
async function stageCount() {
  const n = Number(args[1]);
  if (!Number.isInteger(n) || n < 1) throw new Error("usage: stage-count <n>, for example stage-count 8");
  const vars = readVars();
  const near = await owner(vars);
  const r = await near
    .transaction(vars.BADGE_OWNER_ID)
    .functionCall(vars.BADGE_CONTRACT_ID, "set_stage_count", { stage_count: n }, { gas: "30 Tgas" })
    .send();
  console.log(`set_stage_count(${n}): ${hashOf(r)}`);
}

const run = { deploy, settings: () => settings(readVars()), art, "stage-count": stageCount }[cmd];
if (!run) {
  console.log(
    "usage: node scripts/deploy-badge.mjs deploy|settings|art|stage-count <n> [--keys ...] [--vars worker/.dev.vars]",
  );
  process.exit(1);
}
run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
