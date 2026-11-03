import { describe, expect, it } from "vitest";
import { POP, POP_DONE, popState } from "./pop";

describe("popState after a page turn", () => {
  it("folds the figure flat into a line drawing before the page passes over it", () => {
    const s = popState(POP.collapse, "turn");
    expect(s.scale).toBeLessThan(0.05);
    expect(s.reveal).toBe(0);
  });

  it("turns the page, then lets the outlines rise, then fills them in", () => {
    const turning = popState((POP.turnStart + POP.turnEnd) / 2, "turn");
    expect(turning.turn).toBeGreaterThan(0.3);
    expect(turning.turn).toBeLessThan(0.7);
    const rising = popState((POP.riseStart + POP.riseEnd) / 2, "turn");
    expect(rising.scale).toBeGreaterThan(0.3);
    expect(rising.reveal).toBe(0);
    const filling = popState((POP.fillStart + POP.fillEnd) / 2, "turn");
    expect(filling.reveal).toBeGreaterThan(0.2);
    expect(filling.reveal).toBeLessThan(1);
  });

  it("ends with everything solid and the page at rest", () => {
    expect(popState(POP.fillEnd + 0.01, "turn")).toEqual(POP_DONE);
    expect(POP_DONE).toMatchObject({ scale: 1, reveal: 1, turn: null, phase: null, done: true });
  });

  it("names the phase: turn, then rise, then fill", () => {
    expect(popState(0.5, "turn").phase).toBe("turn");
    expect(popState(POP.turnEnd + 0.05, "turn").phase).toBe("rise");
    expect(popState(POP.fillStart + 0.05, "turn").phase).toBe("fill");
  });
});

describe("popState when the 3D view grows out of the 2D page", () => {
  it("turns no page and starts as a flat drawing", () => {
    const s = popState(0, "grow");
    expect(s.turn).toBeNull();
    expect(s.phase).toBe("rise");
    expect(s.scale).toBeLessThan(0.05);
    expect(s.reveal).toBe(0);
  });

  it("ends solid", () => {
    expect(popState(5, "grow").done).toBe(true);
  });
});
