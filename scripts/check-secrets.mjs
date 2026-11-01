#!/usr/bin/env node
// Blocks commits that add private keys, seed phrases or API tokens.
// Usage: node scripts/check-secrets.mjs --staged   (scans the staged diff)
//        node scripts/check-secrets.mjs <file...>  (scans whole files)
// A line containing "secret-scan:allow" is skipped (for test fixtures with fake keys).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PATTERNS = [
  { name: "NEAR private key", re: /\b(?:ed25519|secp256k1):[1-9A-HJ-NP-Za-km-z]{64,}/ },
  { name: "PEM private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "Cloudflare API token", re: /CLOUDFLARE_API_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}/ },
  { name: "Ethereum private key", re: /(?:private|priv|secret)[_ ]?key\s*[=:]\s*["']?0x[0-9a-fA-F]{64}\b/i },
  {
    name: "Assigned secret",
    re: /\b[A-Z0-9_]*(?:PRIVATE_KEY|SECRET|API_KEY)\s*=\s*["']?[A-Za-z0-9:_+/=-]{16,}/,
  },
];

const SEED_HINT = /\b(seed|mnemonic|phrase)\b/i;
const SEED_WORDS = /(?:\b[a-z]{3,8}\b[\s,"']+){11,23}\b[a-z]{3,8}\b/;
const BLOCKED_FILES = [/(^|\/)\.dev\.vars$/, /(^|\/)\.env(\.(?!example$)[^/]*)?$/];

/** Returns the findings for one line of added text. */
export function scanLine(line) {
  if (line.includes("secret-scan:allow")) return [];
  const hits = PATTERNS.filter((p) => p.re.test(line)).map((p) => p.name);
  if (SEED_HINT.test(line) && SEED_WORDS.test(line)) hits.push("Seed phrase");
  return hits;
}

export function isBlockedFile(path) {
  return BLOCKED_FILES.some((re) => re.test(path));
}

/** Scans a unified diff (only added lines). Returns findings with file and line. */
export function scanDiff(diff) {
  const findings = [];
  let file = "";
  let lineNo = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      file = raw.replace(/^\+\+\+ (b\/)?/, "");
      if (file !== "/dev/null" && isBlockedFile(file)) findings.push({ file, line: 0, kind: "Secrets file" });
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      lineNo = Number(hunk[1]) - 1;
      continue;
    }
    if (raw.startsWith("+")) {
      lineNo++;
      for (const kind of scanLine(raw.slice(1))) findings.push({ file, line: lineNo, kind });
    } else if (!raw.startsWith("-")) lineNo++;
  }
  return findings;
}

function main() {
  const args = process.argv.slice(2);
  let findings = [];
  if (args[0] === "--staged") {
    const diff = execFileSync("git", ["diff", "--cached", "-U0", "--no-color", "--diff-filter=ACM"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    findings = scanDiff(diff);
  } else {
    for (const f of args) {
      if (isBlockedFile(f)) findings.push({ file: f, line: 0, kind: "Secrets file" });
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((l, i) => scanLine(l).forEach((kind) => findings.push({ file: f, line: i + 1, kind })));
    }
  }
  if (findings.length) {
    console.error("Commit blocked: possible secrets found.");
    for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.kind}`);
    console.error('Remove them, or add "secret-scan:allow" to a line that only holds a fake test value.');
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
