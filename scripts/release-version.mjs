#!/usr/bin/env node
// Works out the version for a release build (used by .github/workflows/release.yml).
//
// MAJOR.MINOR come from package.json. PATCH counts up from the git tags (vX.Y.Z) already in that
// series, so every release gets a new version without committing back to the branch.
// To start a new series, bump package.json to e.g. 0.2.0 and merge it to `release`.
//
// CLI: `node scripts/release-version.mjs` prints the next version (no "v"). It reads tags from
// `git tag --list`, so fetch tags first (`git fetch --tags`).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * @param {string} base package.json version, X.Y.Z
 * @param {string[]} tags existing git tags
 * @returns {string} the next version, X.Y.Z
 */
export function nextVersion(base, tags) {
  const m = SEMVER.exec(base);
  if (!m) throw new Error(`package.json version must be X.Y.Z, got "${base}"`);
  const [major, minor, patch] = m.slice(1).map(Number);

  let highest = -1;
  for (const tag of tags) {
    const t = SEMVER.exec(tag.startsWith("v") ? tag.slice(1) : "");
    if (t && Number(t[1]) === major && Number(t[2]) === minor) {
      highest = Math.max(highest, Number(t[3]));
    }
  }
  return `${major}.${minor}.${Math.max(patch, highest + 1)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const tags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).split("\n").filter(Boolean);
  console.log(nextVersion(pkg.version, tags));
}
