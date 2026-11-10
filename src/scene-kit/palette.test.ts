import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CSS_TOKENS, NEAR, STAGE_ACCENTS } from "./theme";

const ROOT = process.cwd();
const INK_CSS = join(ROOT, "src/ui/ink.css");

/** The colour custom properties declared in ink.css's first `:root` block. */
function rootTokens(css: string): Record<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const [, name = "", value = ""] of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/gi))
    out[name] = value.toLowerCase();
  return out;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(css|ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("palette: one source of truth", () => {
  it("ink.css :root declares exactly the colour tokens in theme.ts CSS_TOKENS", () => {
    const expected = Object.fromEntries(Object.entries(CSS_TOKENS).map(([k, v]) => [k, v.toLowerCase()]));
    expect(rootTokens(readFileSync(INK_CSS, "utf8"))).toEqual(expected);
  });

  it("no token colour is hard-coded outside ink.css and theme.ts", () => {
    const tokenHex = new Set(
      [...Object.values(CSS_TOKENS), ...Object.values(STAGE_ACCENTS), ...Object.values(NEAR)]
        .filter((v) => v.length === 7)
        .map((v) => v.toLowerCase()),
    );
    const allowed = new Set([INK_CSS, join(ROOT, "src/scene-kit/theme.ts")]);
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, "src"))) {
      if (allowed.has(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/#[0-9a-f]{6}(?:[0-9a-f]{2})?(?![0-9a-f])/gi)) {
        if (tokenHex.has(m[0].toLowerCase().slice(0, 7))) offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
