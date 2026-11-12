import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Everything lessons import must be network-free; only NearConnectWallet.ts may reach the network. */
const here = dirname(fileURLToPath(import.meta.url));
const FILES = ["types.ts", "funds.ts", "signing.ts", "DemoWallet.ts", "MainnetWalletContext.tsx", "index.ts"];
const FORBIDDEN = ["near-kit", "@hot-labs", "@near-js", "../testnet", "./NearConnectWallet"];

describe("mainnet wallet seam is network-free", () => {
  it.each(FILES)("%s imports no network code statically", (file) => {
    const src = readFileSync(join(here, file), "utf8");
    const staticImports = [...src.matchAll(/^\s*(?:import|export)[^"';]*?from\s*["']([^"']+)["']/gm)].map(
      (m) => m[1]!,
    );
    for (const spec of staticImports) expect(FORBIDDEN.some((f) => spec.startsWith(f))).toBe(false);
    expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket/);
  });
});
