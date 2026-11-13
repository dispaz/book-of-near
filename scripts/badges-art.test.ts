import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { ACCENTS, badgeSvg, writeArt } from "./badges-art.mjs";

describe("badges:art", () => {
  it("draws five valid SVG badges in ink and each stage's accent", () => {
    for (let s = 0; s < 5; s++) {
      const svg = badgeSvg(s) as string;
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(doc.getElementsByTagName("parsererror"), `stage ${s}`).toHaveLength(0);
      expect(svg).toContain('stroke="#16141f"');
      expect(svg).toContain((ACCENTS as string[])[s]);
      expect(svg).toContain(`STAGE ${s}`);
    }
  });

  it("records a sha256 (base64) per file for set_art, matching the bytes written", async () => {
    const dir = mkdtempSync(join(tmpdir(), "badges-"));
    const list = writeArt(dir) as { key: string; media: string; sha256: string }[];
    expect(list.map((a) => a.key)).toEqual(["stage-0", "stage-1", "stage-2", "stage-3", "stage-4"]);
    const { createHash } = await import("node:crypto");
    for (const a of list) {
      const bytes = readFileSync(join(dir, a.media));
      expect(createHash("sha256").update(bytes).digest("base64")).toBe(a.sha256);
    }
    expect(JSON.parse(readFileSync(join(dir, "art.json"), "utf8"))).toEqual(list);
  });

  it("is deterministic, and public/badges matches the generator", () => {
    const committed = readFileSync(join(__dirname, "..", "public", "badges", "stage-2.svg"), "utf8");
    expect(badgeSvg(2)).toBe(committed);
  });
});
