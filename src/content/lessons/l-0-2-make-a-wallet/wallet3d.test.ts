import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import {
  addressHeight,
  describe3d,
  drawnFor,
  labelsFor,
  objectsFor,
  POS,
  REACTION,
  reactionsFor,
  shorten,
  shotFor,
} from "./wallet3d";
import { freeFrame, hasNoteRoom } from "./frame";
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

  it("frames a different part of the paper per step", () => {
    const steps = [STEP.generate, STEP.seed, STEP.address, STEP.compare, STEP.sign, STEP.verify];
    const shots = steps.map((s) => JSON.stringify(shotFor(s, "keys", false).focus));
    expect(new Set(shots).size).toBe(steps.length);
  });

  it("keeps each step's objects inside its shot", () => {
    const inside = (f: Focus, [x, , z]: readonly number[]) =>
      Math.abs(x! - f.center[0]) <= f.width / 2 && Math.abs(z! - f.center[2]) <= f.depth / 2;
    const shot = (s: number, d: Parameters<typeof shotFor>[1] = "keys") => shotFor(s, d, false).focus;
    expect(inside(shot(STEP.warning, "warning"), [0, 0, 0])).toBe(true);
    for (const p of [POS.words, POS.key, POS.lock]) expect(inside(shot(STEP.generate), p)).toBe(true);
    for (const p of [POS.words, POS.key]) expect(inside(shot(STEP.seed), p)).toBe(true);
    for (const p of [POS.lock, POS.address]) expect(inside(shot(STEP.address), p)).toBe(true);
    for (const x of [-3.2, 0, 3.2]) expect(inside(shot(STEP.compare), [x, 0, POS.address[2]])).toBe(true);
    for (const p of [POS.key, POS.card]) expect(inside(shot(STEP.sign), p)).toBe(true);
    for (const p of [POS.lock, POS.card]) expect(inside(shot(STEP.verify), p)).toBe(true);
    for (const p of [POS.bin, POS.words, POS.address])
      expect(inside(shot(STEP.custody, "ghosts"), p)).toBe(true);
    for (const p of [POS.bin, POS.words, POS.lock]) expect(inside(shot(STEP.custody), p)).toBe(true);
  });

  it("draws only the objects a step is about, so nothing spills outside its shot", () => {
    expect(objectsFor(STEP.generate)).toEqual({ words: true, key: true, lock: true, address: false });
    expect(objectsFor(STEP.address)).toEqual({ words: false, key: true, lock: true, address: true });
    expect(objectsFor(STEP.compare)).toMatchObject({ address: true });
    expect(objectsFor(STEP.sign)).toEqual({ words: false, key: true, lock: false, address: false });
    expect(objectsFor(STEP.verify)).toEqual({ words: false, key: false, lock: true, address: false });
    expect(objectsFor(STEP.custody)).toEqual({ words: true, key: true, lock: true, address: true });
    const inside = (f: Focus, [x, , z]: readonly number[]) =>
      Math.abs(x! - f.center[0]) <= f.width / 2 && Math.abs(z! - f.center[2]) <= f.depth / 2;
    for (const s of [STEP.generate, STEP.seed, STEP.address, STEP.sign, STEP.verify, STEP.custody]) {
      const o = objectsFor(s);
      const f = shotFor(s, "keys", false).focus;
      if (o.words) expect(inside(f, POS.words)).toBe(true);
      if (o.key) expect(inside(f, POS.key)).toBe(true);
      if (o.lock) expect(inside(f, POS.lock)).toBe(true);
      if (o.address) expect(inside(f, POS.address)).toBe(true);
    }
  });

  it("draws the warning sign for the whole first step, then the empty places", () => {
    expect(drawnFor(STEP.warning, { ack: false, alive: false })).toBe("warning");
    expect(drawnFor(STEP.warning, { ack: true, alive: false })).toBe("warning");
    expect(drawnFor(STEP.generate, { ack: false, alive: false })).toBe("warning");
    expect(drawnFor(STEP.generate, { ack: true, alive: false })).toBe("ghosts");
    expect(drawnFor(STEP.generate, { ack: true, alive: true })).toBe("keys");
    expect(drawnFor(STEP.seed, { ack: true, alive: false })).toBe("ghosts");
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

  it("on wide screens uses the page between the note margin and the panel, under the step heading", () => {
    const f = freeFrame(1440, 900, {
      head: box(16, 16, 1100, 145),
      panel: box(958, 155, 1396, 548),
      dock: box(16, 657, 428, 798),
      bar: box(498, 816, 936, 870),
    });
    expect(f.left).toBeGreaterThanOrEqual(428 + 24);
    expect(f.right).toBeLessThanOrEqual(958 - 16);
    expect(f.top).toBeGreaterThanOrEqual(145);
    expect(f.bottom).toBeLessThanOrEqual(816);
  });

  it("keeps the note margin free even when nothing is docked yet", () => {
    const f = freeFrame(1440, 900, { head: box(16, 16, 1100, 145), panel: box(958, 155, 1396, 548) });
    expect(f.left).toBeGreaterThanOrEqual(420);
  });

  it("on tablets, with no room beside the note, uses the left column above the docked note", () => {
    const parts = {
      head: box(16, 16, 900, 205),
      panel: box(540, 215, 980, 580),
      dock: box(16, 560, 428, 700),
      bar: box(290, 684, 728, 738),
    };
    expect(hasNoteRoom(1024, parts)).toBe(false);
    expect(freeFrame(1024, 768, parts)).toEqual({ left: 12, top: 217, right: 516, bottom: 548 });
    expect(hasNoteRoom(1440, { panel: box(958, 155, 1396, 548) })).toBe(true);
  });

  it("on phones uses the band between the panel and the step card", () => {
    const f = freeFrame(390, 760, {
      head: box(16, 16, 380, 70),
      panel: box(16, 108, 374, 290),
      dock: box(16, 470, 374, 650),
      bar: box(16, 660, 374, 740),
    });
    expect(f).toEqual({ left: 12, top: 302, right: 378, bottom: 458 });
  });
});

describe("3D reactions (rule 10a)", () => {
  const base = {
    keys: true,
    cleared: false,
    message: true,
    signed: false,
    stale: false,
    rebuilt: false,
    addressDone: false,
    flipped: [false, false, false],
    verdict: null,
  } as const;

  it("says 'not yet' on the empty places before any key exists", () => {
    expect(reactionsFor(STEP.generate, { ...base, keys: false }).ghost).toEqual({
      disabledHint: REACTION.noKeys,
    });
    expect(reactionsFor(STEP.custody, { ...base, keys: false, cleared: true }).ghost).toEqual({});
  });

  it("rebuilds from the words, then shows their detail", () => {
    expect(reactionsFor(STEP.seed, base).words).toEqual({});
    expect(reactionsFor(STEP.seed, { ...base, rebuilt: true }).words.detail).toMatch(/m\/44'\/397'\/0'/);
    expect(reactionsFor(STEP.custody, base).words.detail).toMatch(/12 BIP-39/);
  });

  it("never puts a key value in a detail or hint", () => {
    for (let step = STEP.generate; step <= STEP.custody; step++) {
      const r = reactionsFor(step, { ...base, signed: true, rebuilt: true, addressDone: true });
      expect(JSON.stringify(r)).not.toMatch(/ed25519:[1-9A-Za-z]/);
    }
  });

  it("asks for a message before the key can sign, and shows the signature size after", () => {
    expect(reactionsFor(STEP.sign, { ...base, message: false }).key).toEqual({
      disabledHint: REACTION.noMessage,
    });
    expect(reactionsFor(STEP.sign, base).key).toEqual({});
    expect(reactionsFor(STEP.sign, { ...base, signed: true }).key.detail).toMatch(/64 bytes/);
    expect(reactionsFor(STEP.seed, base).key.detail).toMatch(/secret/);
  });

  it("asks to turn the key into an address first, then shows its length", () => {
    expect(reactionsFor(STEP.address, base).address).toEqual({ disabledHint: REACTION.noAddress });
    expect(reactionsFor(STEP.address, { ...base, addressDone: true }).address.detail).toMatch(/64 hex/);
    const compare = { ...base, addressDone: true };
    expect(reactionsFor(STEP.compare, compare).address).toEqual({});
    const all = reactionsFor(STEP.compare, { ...compare, flipped: [true, true, true] });
    expect(all.address.detail).toMatch(/64 hex/);
    expect(all.eth.detail).toMatch(/42 characters/);
    expect(all.named.detail).toMatch(/ana\.testnet/);
  });

  it("the card waits for a signature, then shows the failed check after tampering", () => {
    expect(reactionsFor(STEP.sign, base).card).toEqual({ disabledHint: REACTION.noSignature });
    expect(reactionsFor(STEP.sign, { ...base, signed: true }).card.detail).toMatch(/signature/);
    expect(reactionsFor(STEP.verify, { ...base, signed: true }).card).toEqual({});
    // Any failed check (a typed edit too), not only the card's one-letter change.
    expect(reactionsFor(STEP.verify, { ...base, signed: true, verdict: "fail" }).card.detail).toBe(
      "The text changed: the signature does not match",
    );
  });

  it("a signature whose message box changed since is stale in step 6, but still tamperable in step 7", () => {
    const stale = { ...base, signed: true, stale: true };
    expect(reactionsFor(STEP.sign, stale).key).toEqual({});
    expect(reactionsFor(STEP.sign, stale).card).toEqual({ disabledHint: REACTION.noSignature });
    expect(reactionsFor(STEP.verify, stale).card).toEqual({});
  });

  it("the bin shows that memory is clear once the keys are gone", () => {
    expect(reactionsFor(STEP.custody, base).bin).toEqual({});
    expect(reactionsFor(STEP.custody, { ...base, keys: false, cleared: true }).bin.detail).toMatch(/0 keys/);
  });
});
