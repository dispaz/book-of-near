import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
// @ts-expect-error plain JS module without types
import { PATTERNS } from "../scripts/check-secrets.mjs";

/**
 * The build that `npm run e2e` just made (playwright.config.ts builds `dist/` with `VITE_E2E=1` before it
 * serves it) carries no secret and, in the default testnet-only build, no mainnet wallet code (issue #31).
 * That build is a superset of the deploy build: it only adds test hooks, so what passes here passes there.
 * Not run against a live URL (BASE_URL): then nothing was built here.
 *
 * The commit hook's seed-phrase heuristic is left out: lesson 0.2 ships the BIP39 wordlist, which trips it.
 */
test.skip(!!process.env.BASE_URL, "checks the local build only");

const MAINNET = process.env.VITE_ENABLE_MAINNET === "true";

/** Every text file in dist/ (fonts and images left out), with its contents. */
function distFiles() {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(js|mjs|css|html|json|txt|map|svg|webmanifest)$/.test(name))
        out.push({ path, text: readFileSync(path, "utf8") });
    }
  };
  walk("dist");
  return out;
}

/**
 * Values from the git-ignored files that hold real keys on a developer's machine, if any are here.
 * A simple `KEY=value` reader: one value per line, quotes stripped, no multi-line values, no `export`
 * prefix, no `${VAR}` expansion, and a value stops at whitespace or `#`. Values under 16 characters are
 * skipped (too short to be a key, and they would match by chance).
 */
function localSecretValues() {
  const values: string[] = [];
  for (const file of [".env", ".env.local", ".env.production", ".dev.vars", "worker/.dev.vars"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'\s#]+)/.exec(line);
      // Public build variables (VITE_*) are meant for the browser; everything else is a Worker secret.
      if (m && !m[1]!.startsWith("VITE_") && m[2]!.length >= 16) values.push(m[2]!);
    }
  }
  if (process.env.TESTNET_STORE && existsSync(process.env.TESTNET_STORE)) {
    const keys = readFileSync(process.env.TESTNET_STORE, "utf8").match(/ed25519:[1-9A-HJ-NP-Za-km-z]{64,}/g);
    values.push(...(keys ?? []));
  }
  return values;
}

test.describe("production build", () => {
  test("holds no private key, token or local secret", () => {
    const files = distFiles();
    expect(files.length).toBeGreaterThan(10);
    const hits: string[] = [];
    const secrets = localSecretValues();
    for (const { path, text } of files) {
      for (const p of PATTERNS) if (p.re.test(text)) hits.push(`${path}: ${p.name}`);
      for (const s of secrets) if (text.includes(s)) hits.push(`${path}: a value from a local secrets file`);
    }
    expect(hits).toEqual([]);
  });

  test("the default testnet-only build leaves out the mainnet wallet (NEAR Connect)", () => {
    test.skip(MAINNET, "built with VITE_ENABLE_MAINNET=true");
    // NEAR Connect's own wallet-list URLs and our wallet chunk's name. (near-kit's error messages name
    // "@hot-labs/near-connect" too, so the package name alone proves nothing.)
    const hits = distFiles()
      .filter(({ path, text }) => /NearConnectWallet/.test(path) || /hot-connector|near-selector/.test(text))
      .map(({ path }) => path);
    expect(hits).toEqual([]);
  });
});
