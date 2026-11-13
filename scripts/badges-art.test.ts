import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLORS, NEAR, STAGE_ACCENTS } from "../src/scene-kit/theme";
// @ts-expect-error plain ESM script without types
import { badgeSvg, finalSvg, NAMES, RARITIES, selectArt, writeArt } from "./badges-art.mjs";
import { registry } from "../src/app/registry";
import { STAGE_BADGE_NAMES, STAGE_BADGES } from "../src/badges/config";

const STAGES = [0, 1, 2, 3, 4, 5, 6, 7];
const hexes = (svg: string) => new Set([...svg.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase()));

describe("badges:art", () => {
  it("draws eight valid SVG badges, one per stage (0 to 7), each named and numbered", () => {
    expect(NAMES).toEqual([
      "Blank Page",
      "Named",
      "Nightshade",
      "Wasm",
      "Any Chain",
      "Enclave",
      "Citizen",
      "Book of NEAR",
    ]);
    for (const s of STAGES) {
      const svg = badgeSvg(s) as string;
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(doc.getElementsByTagName("parsererror"), `stage ${s}`).toHaveLength(0);
      expect(svg).toContain(`STAGE ${s}`);
      expect(svg).toContain(`stage ${s} badge: ${(NAMES as string[])[s]}`);
    }
  });

  it("uses only NEAR's palette: black outlines, off-white ground, NEAR green and its forest shade", () => {
    const near = new Set(Object.values(NEAR).map((v) => v.toLowerCase()));
    const stageAccents = new Set(Object.values(STAGE_ACCENTS).map((v) => v.toLowerCase()));
    for (const s of STAGES) {
      const svg = badgeSvg(s) as string;
      const used = hexes(svg);
      expect(
        [...used].filter((h) => !near.has(h)),
        `stage ${s}`,
      ).toEqual([]);
      expect(
        [...used].filter((h) => stageAccents.has(h)),
        `stage ${s}`,
      ).toEqual([]);
      expect(svg).toContain(`stroke="${NEAR.black}"`);
      expect(svg).toContain(`fill="${NEAR.offWhite}"`);
      expect(svg).toContain(NEAR.green);
      // The "pass" green is not NEAR's: it must not sneak in.
      expect(svg).not.toContain(COLORS.green);
    }
  });

  it("draws each stage's motif differently (no two badges share their art)", () => {
    const motifs = STAGES.map((s) =>
      (badgeSvg(s) as string).replace(/STAGE \d|stage \d|\(.*?\)|: [^"<]+/g, ""),
    );
    expect(new Set(motifs).size).toBe(8);
  });

  it("stage 4 is linked blocks (blockchains), not rings", () => {
    const svg = badgeSvg(4) as string;
    expect(svg).toContain('data-motif="blockchains"');
    expect(svg.match(/data-part="block"/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(svg.match(/data-part="link"/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("records a sha256 (base64) per file for set_art, matching the bytes written", async () => {
    const dir = mkdtempSync(join(tmpdir(), "badges-"));
    const list = writeArt(dir) as { key: string; media: string; sha256: string }[];
    expect(list.map((a) => a.key)).toEqual([
      ...STAGES.map((s) => `stage-${s}`),
      "final-common",
      "final-rare",
      "final-epic",
      "final-legendary",
    ]);
    expect(new Set(list.map((a) => a.sha256)).size).toBe(12);
    const { createHash } = await import("node:crypto");
    for (const a of list) {
      const bytes = readFileSync(join(dir, a.media));
      expect(createHash("sha256").update(bytes).digest("base64")).toBe(a.sha256);
    }
    expect(JSON.parse(readFileSync(join(dir, "art.json"), "utf8"))).toEqual(list);
  });

  it("is deterministic, and public/badges matches the generator", () => {
    const committed = JSON.parse(
      readFileSync(join(__dirname, "..", "public", "badges", "art.json"), "utf8"),
    ) as { media: string }[];
    expect(committed).toHaveLength(12);
    for (const s of STAGES) {
      const file = readFileSync(join(__dirname, "..", "public", "badges", `stage-${s}.svg`), "utf8");
      expect(badgeSvg(s), `stage ${s}`).toBe(file);
    }
    for (const r of RARITIES as string[]) {
      const file = readFileSync(join(__dirname, "..", "public", "badges", `final-${r}.svg`), "utf8");
      expect(finalSvg(r), r).toBe(file);
    }
  });
});

describe("final badge art (issue #29)", () => {
  it("draws one valid SVG per rarity the contract accepts, in NEAR's palette, told apart without colour", () => {
    expect(RARITIES).toEqual(["common", "rare", "epic", "legendary"]);
    const near = new Set(Object.values(NEAR).map((v) => v.toLowerCase()));
    (RARITIES as string[]).forEach((r, i) => {
      const svg = finalSvg(r) as string;
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(doc.getElementsByTagName("parsererror"), r).toHaveLength(0);
      expect(
        [...hexes(svg)].filter((h) => !near.has(h)),
        r,
      ).toEqual([]);
      expect(svg).toContain(r.toUpperCase());
      expect(svg.match(/data-part="star"/g)).toHaveLength(i + 1);
    });
    expect(() => finalSvg("mythic")).toThrow(/Unknown rarity/);
  });
});

describe("badge names", () => {
  it("match the app's stage names (stage.ts, else STAGE_BADGE_NAMES) for every badge", () => {
    expect(STAGE_BADGES).toBe((NAMES as string[]).length);
    for (const s of STAGES) {
      const appName = registry.stages.find((st) => st.id === s)?.name ?? STAGE_BADGE_NAMES[s];
      expect(appName, `stage ${s}`).toBe((NAMES as string[])[s]);
    }
  });
});

describe("selectArt (deploy-badge.mjs art --keys)", () => {
  type Art = { key: string; media: string; sha256: string };
  const all: Art[] = STAGES.map((s) => ({ key: `stage-${s}`, media: `stage-${s}.svg`, sha256: "x" }));
  const pick = selectArt as (all: Art[], argv: string[]) => Art[];

  it("sends every entry without --keys, and only the listed ones with it", () => {
    expect(pick(all, ["art"])).toEqual(all);
    expect(pick(all, ["art", "--keys", "stage-0,stage-4"]).map((a) => a.key)).toEqual(["stage-0", "stage-4"]);
  });

  it("refuses --keys with no value, and names only the unknown keys", () => {
    expect(() => pick(all, ["art", "--keys"])).toThrow("--keys needs a value");
    expect(() => pick(all, ["art", "--keys", "--vars"])).toThrow("--keys needs a value");
    expect(() => pick(all, ["art", "--keys", "stage-0,stage-9,nope"])).toThrow(
      /^Unknown key in --keys: stage-9, nope$/,
    );
  });
});
