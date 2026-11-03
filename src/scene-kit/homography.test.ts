import { describe, expect, it } from "vitest";
import { applyHomography, homography, matrix3d, type Quad } from "./homography";

const close = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe("homography", () => {
  it("maps the corners of a w x h box onto the four corners of a quad", () => {
    const quad: Quad = [
      [100, 50],
      [380, 80],
      [420, 600],
      [60, 560],
    ];
    const h = homography(400, 600, quad);
    close(applyHomography(h, 0, 0), quad[0]);
    close(applyHomography(h, 400, 0), quad[1]);
    close(applyHomography(h, 400, 600), quad[2]);
    close(applyHomography(h, 0, 600), quad[3]);
  });

  it("is a plain scale and shift when the quad is a rectangle", () => {
    const h = homography(200, 100, [
      [10, 20],
      [410, 20],
      [410, 220],
      [10, 220],
    ]);
    close(applyHomography(h, 100, 50), [210, 120]);
    expect(h[6]).toBeCloseTo(0, 9);
    expect(h[7]).toBeCloseTo(0, 9);
  });

  it("keeps straight lines straight (the middle of a trapezoid's diagonal stays on it)", () => {
    const quad: Quad = [
      [200, 100],
      [400, 100],
      [500, 400],
      [100, 400],
    ];
    const h = homography(100, 100, quad);
    const [x, y] = applyHomography(h, 50, 50);
    // The centre of the box lands where the quad's diagonals cross.
    const t = (x - 200) / (500 - 200);
    expect(y).toBeCloseTo(100 + t * 300, 6);
  });

  it("writes a CSS matrix3d in column-major order", () => {
    const css = matrix3d(
      homography(100, 100, [
        [0, 0],
        [200, 0],
        [200, 100],
        [0, 100],
      ]),
    );
    expect(css).toMatch(/^matrix3d\(/);
    const n = css.slice(9, -1).split(",").map(Number);
    expect(n).toHaveLength(16);
    expect(n[0]).toBeCloseTo(2); // x scale
    expect(n[5]).toBeCloseTo(1); // y scale
    expect(n[15]).toBeCloseTo(1);
  });
});
