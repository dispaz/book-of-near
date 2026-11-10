import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { COLORS, CSS_TOKENS, INK, NEAR, STAGE_ACCENTS } from "./theme";

const ROOT = process.cwd();
const INK_CSS = join(ROOT, "src/ui/ink.css");

/** The colour custom properties declared in ink.css's `:root` block. */
function rootTokens(css: string): Record<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const [, name = "", value = ""] of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/gi))
    out[name] = value.toLowerCase();
  return out;
}

/** Source files under `dir` (tests excluded): CSS, TS, TSX and the scaffolder's MJS templates. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(css|ts|tsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** `#rrggbb` as 0–255 channels. */
function rgb(hex: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return [r, g, b];
}

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe("palette: one source of truth", () => {
  const css = readFileSync(INK_CSS, "utf8");

  it("ink.css has one :root block, declaring exactly the colour tokens in theme.ts CSS_TOKENS", () => {
    expect(css.match(/:root\s*\{/g)).toHaveLength(1);
    const expected = Object.fromEntries(Object.entries(CSS_TOKENS).map(([k, v]) => [k, v.toLowerCase()]));
    expect(rootTokens(css)).toEqual(expected);
  });

  it("no token colour is hard-coded (as hex or rgb) outside the :root block and theme.ts", () => {
    const tokens = [...Object.values(CSS_TOKENS), ...Object.values(STAGE_ACCENTS), ...Object.values(NEAR)]
      .filter((v) => v.length === 7)
      .map((v) => v.toLowerCase());
    const tokenHex = new Set(tokens);
    const tokenRgb = new Set(tokens.map((t) => rgb(t).join(",")));
    const offenders: string[] = [];
    const scan = (file: string, text: string) => {
      for (const m of text.matchAll(/#[0-9a-f]{6}(?:[0-9a-f]{2})?(?![0-9a-f])/gi))
        if (tokenHex.has(m[0].toLowerCase().slice(0, 7))) offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
      for (const m of text.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi))
        if (tokenRgb.has(`${m[1]},${m[2]},${m[3]}`)) offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
    };
    const theme = join(ROOT, "src/scene-kit/theme.ts");
    for (const file of [...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "scripts"))]) {
      if (file === theme) continue;
      const text = readFileSync(file, "utf8");
      scan(file, file === INK_CSS ? text.replace(/:root\s*\{[^}]*\}/, "") : text);
    }
    expect(offenders).toEqual([]);
  });
});

describe("palette: NEAR brand", () => {
  it("uses NEAR's published green, black and off-white", () => {
    expect(NEAR.green).toBe("#00ec97");
    expect(NEAR.black).toBe("#000000");
    expect(NEAR.offWhite).toBe("#f2f1e9");
  });

  it("no stage accent can be mistaken for NEAR green (hue at least 30° away)", () => {
    for (const accent of Object.values(STAGE_ACCENTS)) {
      const gap = Math.abs(hue(accent) - hue(NEAR.green));
      expect(Math.min(gap, 360 - gap), accent).toBeGreaterThanOrEqual(30);
    }
  });
});

describe("palette: contrast (WCAG AA, 4.5:1 for body text)", () => {
  const papers = { paper: CSS_TOKENS["--paper"], page: CSS_TOKENS["--page"], card: CSS_TOKENS["--card"] };

  it.each(Object.entries(STAGE_ACCENTS))("ink text on stage %s's accent (buttons)", (_stage, accent) => {
    expect(contrast(INK, accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(papers))("ink and muted text on %s", (_name, bg) => {
    expect(contrast(INK, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(CSS_TOKENS["--mute"], bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("ink on a NEAR coin", () => {
    expect(contrast(INK, COLORS.near)).toBeGreaterThanOrEqual(4.5);
  });
});
