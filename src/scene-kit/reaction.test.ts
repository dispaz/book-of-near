import { describe, expect, it } from "vitest";
import {
  approach,
  hopPose,
  HOP_SECONDS,
  NOPE_SECONDS,
  pickNote,
  reactionPose,
  REST_POSE,
  type ReactionInput,
} from "./reaction";

const rest: ReactionInput = { hover: 0, press: 0, nope: -1, reducedMotion: false };

describe("reactionPose", () => {
  it("is the identity at rest", () => {
    expect(reactionPose(rest)).toEqual(REST_POSE);
  });

  it("lifts the object on hover", () => {
    const p = reactionPose({ ...rest, hover: 1 });
    expect(p.lift).toBeGreaterThan(0.05);
    expect(p.sy).toBe(1);
  });

  it("squashes on press: lower and wider", () => {
    const p = reactionPose({ ...rest, press: 1 });
    expect(p.sy).toBeLessThan(1);
    expect(p.sx).toBeGreaterThan(1);
    expect(p.sz).toBeGreaterThan(1);
  });

  it("shakes sideways during a 'not yet', then rests", () => {
    const mid = reactionPose({ ...rest, nope: NOPE_SECONDS * 0.15 });
    expect(Math.abs(mid.shake)).toBeGreaterThan(0.01);
    expect(reactionPose({ ...rest, nope: NOPE_SECONDS }).shake).toBe(0);
  });

  it("under reduced motion never moves the object", () => {
    const p = reactionPose({ hover: 1, press: 1, nope: 0.1, reducedMotion: true });
    expect(p).toEqual(REST_POSE);
  });
});

describe("approach", () => {
  it("moves toward the target at a fixed rate and stops on it", () => {
    expect(approach(0, 1, 0.1, 0.2)).toBeCloseTo(0.5);
    expect(approach(0.9, 1, 0.1, 0.2)).toBe(1);
    expect(approach(1, 0, 0.5, 0.2)).toBe(0);
  });
});

describe("hopPose (the default pick animation)", () => {
  it("jumps and is still playing halfway", () => {
    const h = hopPose(HOP_SECONDS / 2);
    expect(h.playing).toBe(true);
    expect(h.lift).toBeGreaterThan(0.1);
  });

  it("settles at the end", () => {
    const h = hopPose(HOP_SECONDS + 0.01);
    expect(h.playing).toBe(false);
    expect(h.lift).toBe(0);
    expect(h.turn).toBe(0);
  });
});

describe("pickNote", () => {
  it("a 'not yet' object shows its hint and does not pick", () => {
    expect(pickNote({ disabledHint: "Send coins first", detail: "x" })).toEqual({
      kind: "hint",
      text: "Send coins first",
    });
  });
  it("a done object shows its detail", () => {
    expect(pickNote({ detail: "Holds 1 coin" })).toEqual({ kind: "detail", text: "Holds 1 coin" });
  });
  it("a plain object shows nothing", () => {
    expect(pickNote({})).toBeNull();
  });
});
