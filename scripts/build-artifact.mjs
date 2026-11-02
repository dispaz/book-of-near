#!/usr/bin/env node
// Builds the claude.ai review copy of the app into dist-artifact/:
// - hash routing and relative asset paths (the copy is served as one page),
// - index.html turned into a fragment (claude.ai wraps the page in its own document),
// - files.json: the map of published path -> local file, for the Artifact publish call.
// Only demo mode works there: the page cannot reach the network.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const out = "dist-artifact";
execFileSync(
  "npx",
  ["vite", "build", "--mode", "artifact", "--base", "./", "--outDir", out, "--emptyOutDir"],
  {
    stdio: "inherit",
  },
);

const html = readFileSync(join(out, "index.html"), "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
const keep = head
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => /^<(title|link rel="stylesheet"|link rel="modulepreload"|script)/.test(l));
const fragment = [
  "<title>Book of NEAR</title>",
  ...keep.filter((l) => !l.startsWith("<title")),
  '<div id="root"></div>',
  "",
].join("\n");
writeFileSync(join(out, "index.html"), fragment);

const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name !== "index.html" && name !== "files.json") files[relative(out, p)] = p;
  }
};
walk(out);
writeFileSync(join(out, "files.json"), JSON.stringify(files, null, 2));
console.log(`dist-artifact: index.html fragment + ${Object.keys(files).length} files`);
