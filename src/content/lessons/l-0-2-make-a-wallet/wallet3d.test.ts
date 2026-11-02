import { describe, expect, it } from "vitest";
import { addressHeight, cameraFor, describe3d, labelsFor, shorten } from "./wallet3d";
import { freeFrame } from "./frame";
import { STEP } from "./useWallet";
import { MASKED_SECRET, shownSecret } from "./wallet";

describe("3D view helpers", () => {
  it("masks the private key the same way in every view", () => {
    const kp = { secretKey: "ed25519:5uJtH8hdSECRET" };
    expect(shownSecret(kp, false)).toBe(MASKED_SECRET);
    expect(shownSecret(kp, false)).not.toContain("5uJ");
    expect(shownSecret(kp, true)).toBe(kp.secretKey);
  });

  it("shortens long values but keeps both ends", () => {
    expect(shorten("short", 10)).toBe("short");
    const s = shorten("ed25519:Ex4stLtTe43ynFmxGweGzMWLvRmRSUP6EjU6nvAdY2vg", 24);
    expect(s).toHaveLength(24);
    expect(s.startsWith("ed25519:")).toBe(true);
    expect(s.endsWith("nvAdY2vg")).toBe(true);
  });

  it("makes longer addresses taller blocks", () => {
    expect(addressHeight(64)).toBeGreaterThan(addressHeight(42));
    expect(addressHeight(42)).toBeGreaterThan(addressHeight(11));
    expect(addressHeight(11)).toBeGreaterThan(0);
  });

  it("has a camera for every step and moves between them", () => {
    const views = Object.values(STEP).map((s) => JSON.stringify(cameraFor(s, "keys")));
    expect(new Set(views).size).toBeGreaterThan(5);
    expect(cameraFor(STEP.generate, "warning")).toEqual(cameraFor(STEP.warning, "warning"));
  });

  it("shows only the labels a step needs, fewer on phones", () => {
    expect(labelsFor(STEP.seed, false)).toMatchObject({ wordList: true, arrow: "SLIP-10 path" });
    expect(labelsFor(STEP.seed, true)).toMatchObject({ wordList: false, arrow: null, values: false });
    expect(labelsFor(STEP.compare, false).pipeline).toBe(false);
    expect(labelsFor(STEP.address, false)).toMatchObject({ address: true, key: false });
    expect(labelsFor(STEP.check, false).values).toBe(false);
  });

  it("describes the verdict for screen readers", () => {
    expect(describe3d("verify", "fail", false)).toMatch(/cracks red/);
    expect(describe3d("verify", "pass", false)).toMatch(/green/);
    expect(describe3d("gone", null, true)).toMatch(/bin/);
  });
});

describe("free frame", () => {
  const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

  it("on wide screens uses the space left of the panel, above the step card", () => {
    const f = freeFrame(1280, 800, {
      title: box(16, 16, 300, 70),
      panel: box(816, 72, 1256, 460),
      dock: box(16, 517, 416, 707),
      bar: box(280, 724, 1000, 784),
    });
    expect(f.x).toBe(12);
    expect(f.x + f.w).toBeLessThanOrEqual(816);
    expect(f.y).toBeGreaterThanOrEqual(70);
    expect(f.y + f.h).toBeLessThanOrEqual(517);
  });

  it("on phones uses the band between the panel and the step card", () => {
    const f = freeFrame(390, 760, {
      title: box(16, 16, 380, 70),
      panel: box(16, 108, 374, 290),
      dock: box(16, 470, 374, 650),
      bar: box(16, 660, 374, 740),
    });
    expect(f).toEqual({ x: 12, y: 302, w: 366, h: 156 });
  });
});
