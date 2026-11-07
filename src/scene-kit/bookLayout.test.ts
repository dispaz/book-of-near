import { describe, expect, it } from "vitest";
import { spreadBeside, textBlock } from "./book";
import {
  activeCursor,
  folios,
  freeFrame,
  nextShot,
  PRINT_MIN_WIDTH,
  READING_ELEVATION,
  readingShot,
  toggleTour,
  type Chrome,
} from "./bookLayout";
import { focusOf } from "./framing";

describe("readingShot", () => {
  const spread = spreadBeside({ minX: -6, maxX: 6, minZ: -3, maxZ: 3 });
  const text = textBlock(spread, 6.4);
  const figure = focusOf([[-6, 6, -3, 3, 1.2]], 34);

  it("keeps both the figure and the printed words in view", () => {
    const f = readingShot(figure, text);
    expect(f.center[0] - f.width / 2).toBeCloseTo(text.x0);
    expect(f.center[0] + f.width / 2).toBeCloseTo(6);
    expect(f.height).toBeCloseTo(1.2);
  });

  it("looks down steeply enough to read the page", () => {
    expect(readingShot(figure, text).elevation).toBe(READING_ELEVATION);
    expect(readingShot(figure, text, 60).elevation).toBe(60);
  });
});

describe("folios", () => {
  it("numbers each sheet's two pages, left even, right odd", () => {
    expect(folios(0)).toEqual([4, 5]);
    expect(folios(3)).toEqual([10, 11]);
    expect(folios(1, 2)).toEqual([4, 5]);
  });
});

describe("tour cursor", () => {
  it("starts at the first shot, playing", () => {
    expect(toggleTour(null, 2)).toEqual({ page: 2, i: 0, playing: true });
  });

  it("pauses and resumes the same shot", () => {
    const paused = toggleTour({ page: 2, i: 1, playing: true }, 2);
    expect(paused).toEqual({ page: 2, i: 1, playing: false });
    expect(toggleTour(paused, 2)).toEqual({ page: 2, i: 1, playing: true });
  });

  it("moves to the next shot and ends after the last one", () => {
    expect(nextShot({ page: 0, i: 0, playing: true }, 3)).toEqual({ page: 0, i: 1, playing: true });
    expect(nextShot({ page: 0, i: 2, playing: true }, 3)).toBeNull();
  });

  it("ends when the page changes or the shots run out", () => {
    const c = { page: 2, i: 1, playing: true };
    expect(activeCursor(c, 2, 3)).toBe(c);
    expect(activeCursor(c, 3, 3)).toBeNull();
    expect(activeCursor(c, 2, 1)).toBeNull();
    expect(activeCursor(null, 2, 3)).toBeNull();
  });
});

describe("freeFrame", () => {
  const chrome = (over: Partial<Chrome> = {}): Chrome => ({
    width: 1440,
    height: 900,
    titleBottom: 90,
    headBottom: 150,
    dockTop: 600,
    dockRight: 420,
    barTop: 830,
    sideLeft: null,
    statusHeight: 0,
    panelHeight: 0,
    ...over,
  });

  it("prints on wide screens: the whole width under the title is free", () => {
    const f = freeFrame(chrome(), { summary: false });
    expect(f.print).toBe(true);
    expect(f.frame).toEqual({ left: 24, right: 1416, top: 102, bottom: 816 });
    // The panel and status note sit over the right page, clear of the printed words.
    expect(f.vars.l).toBe(Math.round(1440 * 0.47));
  });

  it("docks the words on mid widths: the scene is right of the dock, under the step heading", () => {
    const f = freeFrame(chrome({ width: 1024 }), { summary: false });
    expect(f.print).toBe(false);
    expect(f.wide).toBe(true);
    expect(f.frame).toEqual({ left: 452, right: 1000, top: 162, bottom: 816 });
  });

  it("never prints at the quiz and honest take (summary): the scene is left of the side panel", () => {
    const f = freeFrame(chrome({ sideLeft: 1000 }), { summary: true });
    expect(f.print).toBe(false);
    expect(f.frame).toEqual({ left: 24, right: 968, top: 162, bottom: 588 });
  });

  it("puts the scene above the dock on phones", () => {
    const f = freeFrame(chrome({ width: 390, height: 844, dockTop: 500 }), { summary: false });
    expect(f.wide).toBe(false);
    expect(f.frame).toEqual({ left: 12, right: 378, top: 162, bottom: 490 });
  });

  it("keeps room for the status note and the panel, but always a band of the scene", () => {
    const f = freeFrame(chrome({ statusHeight: 30, panelHeight: 100 }), { summary: false });
    expect(f.frame.bottom).toBe(816 - 36 - 108);
    expect(f.vars.sh).toBe(36);
    const tall = freeFrame(chrome({ panelHeight: 2000 }), { summary: false });
    expect(tall.frame.bottom).toBe(102 + 70);
  });

  it("honours a lesson's own print width", () => {
    expect(freeFrame(chrome({ width: PRINT_MIN_WIDTH - 1 }), { summary: false }).print).toBe(false);
    expect(freeFrame(chrome({ width: 1300 }), { summary: false, printMinWidth: 1400 }).print).toBe(false);
  });
});
