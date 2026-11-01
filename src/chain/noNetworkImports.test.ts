import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The Chain interface must stay swappable: its files may not import network libraries or call
 * the network. Lessons import these files; TestnetChain (#7) keeps its network code to itself.
 */
const here = dirname(fileURLToPath(import.meta.url));
const INTERFACE_FILES = ["types.ts", "errors.ts", "shards.ts", "units.ts", "accountId.ts", "ops.ts"];
const NETWORK_LIBS = [
  "near-kit",
  "near-api-js",
  "@near-js",
  "@hot-labs",
  "@near-wallet-selector",
  "axios",
  "ky",
  "node-fetch",
  "cross-fetch",
  "isomorphic-fetch",
  "undici",
  "ws",
];

function importsOf(source: string): string[] {
  const re =
    /(?:import|export)[^"';]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
  return [...source.matchAll(re)].map((m) => m[1] ?? m[2] ?? m[3]!);
}

function isNetworkLib(spec: string): boolean {
  return NETWORK_LIBS.some((lib) => spec === lib || spec.startsWith(`${lib}/`));
}

describe("Chain interface has no network imports", () => {
  it.each(INTERFACE_FILES)("%s imports no network library and makes no network call", (file) => {
    const src = readFileSync(join(here, file), "utf8");
    for (const spec of importsOf(src)) expect(isNetworkLib(spec), `${file} imports ${spec}`).toBe(false);
    expect(src).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|new WebSocket/);
  });

  it("types.ts is types only", () => {
    const src = readFileSync(join(here, "types.ts"), "utf8");
    expect(src).not.toMatch(/^import\s+(?!type\b)/m);
    expect(src).not.toMatch(/^export\s+(const|let|var|function|class|enum)\b/m);
  });

  it("the scanner catches network imports", () => {
    const found = importsOf(
      'import { Near } from "near-kit";\nconst m = await import("near-api-js");\nimport "@near-js/providers";',
    );
    expect(found).toEqual(["near-kit", "near-api-js", "@near-js/providers"]);
    expect(found.every(isNetworkLib)).toBe(true);
    expect(isNetworkLib("@noble/hashes/sha2.js")).toBe(false);
  });
});
