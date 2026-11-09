/**
 * Paintings of the room round the table (Room.tsx): a cosy flat with a balcony onto a garden.
 * Each surface is painted on a canvas in world units, then blurred by scaling it down and up again
 * (works in every browser, unlike `ctx.filter`), so the room reads as out of focus behind the sharp book.
 * Colours are warm and pale, with NEAR greens in the plants, the sofa and the rug.
 */
import { NEAR } from "./theme";

type G = CanvasRenderingContext2D;
type Rnd = () => number;

/** A seeded random generator, so the paintings are the same on every load. */
export function seeded(seed: number): Rnd {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const MAX_PX = 2048;

/**
 * A canvas `w` x `h` world units, painted by `paint` with 1 unit = 1 (y runs down from the top), then
 * blurred: `blur` is how many times smaller the picture is shrunk before it is blown up again.
 */
export function paintSurface(w: number, h: number, blur: number, paint: (g: G) => void): HTMLCanvasElement {
  const k = MAX_PX / Math.max(w, h);
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(w * k));
  c.height = Math.max(2, Math.round(h * k));
  const g = c.getContext("2d")!;
  g.save();
  g.scale(k, k);
  paint(g);
  g.restore();
  return blur > 1 ? soften(c, blur) : c;
}

/** Blurs a canvas by halving it down to 1/`factor` of its size and doubling it back up. */
function soften(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const steps: HTMLCanvasElement[] = [src];
  let cur = src;
  for (let f = 2; f <= factor; f *= 2) {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(src.width / f));
    c.height = Math.max(2, Math.round(src.height / f));
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(cur, 0, 0, c.width, c.height);
    steps.push(c);
    cur = c;
  }
  for (const step of steps.slice(0, -1).reverse()) {
    const c = document.createElement("canvas");
    c.width = step.width;
    c.height = step.height;
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  return cur;
}

// ---------- shared bits ----------

/** One of `items`, at random. */
const pick = <T>(items: readonly T[], rnd: Rnd): T => items[Math.floor(rnd() * items.length)]!;

const WALL = "#eee4d3";
const TRIM = "#f8f4ea";
const WALNUT = "#7d5a3f";
const LEAF = [NEAR.forest, "#2f7d55", "#4f9a63", "#6fae6f", NEAR.deep];
const BOOKS = [
  "#c9563f",
  "#3e6b8a",
  "#e2b04a",
  NEAR.deep,
  "#d9cfc0",
  "#6b4f7a",
  "#2f3a3a",
  "#e48a5c",
  "#9cc7b4",
];

function rect(g: G, x: number, y: number, w: number, h: number, fill: string) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
}

function roundRect(g: G, x: number, y: number, w: number, h: number, r: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

function blob(g: G, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
}

/** A plain wall: warm plaster, darker towards the ceiling, with a skirting board along the floor. */
function plaster(g: G, w: number, h: number) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#e2d7c4");
  grad.addColorStop(0.35, WALL);
  grad.addColorStop(1, "#ece2d0");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  rect(g, 0, h - 4.5, w, 4.5, TRIM);
  rect(g, 0, h - 4.8, w, 0.4, "rgba(80,60,40,0.18)");
}

/** Soft shadow in the corners and under the ceiling, so the walls meet like a real room's. */
function cornerShade(g: G, w: number, h: number) {
  for (const [x0, x1] of [
    [0, 10],
    [w, w - 10],
  ] as const) {
    const s = g.createLinearGradient(x0, 0, x1, 0);
    s.addColorStop(0, "rgba(70,55,40,0.18)");
    s.addColorStop(1, "rgba(70,55,40,0)");
    g.fillStyle = s;
    g.fillRect(Math.min(x0, x1), 0, 10, h);
  }
  const top = g.createLinearGradient(0, 0, 0, 14);
  top.addColorStop(0, "rgba(70,55,40,0.16)");
  top.addColorStop(1, "rgba(70,55,40,0)");
  g.fillStyle = top;
  g.fillRect(0, 0, w, 14);
}

/** The garden seen through glass: sky, trees, lawn and flower beds, clipped to the pane's rectangle. */
function garden(g: G, x: number, y: number, w: number, h: number, horizon: number, rnd: Rnd) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const sky = g.createLinearGradient(0, y, 0, horizon);
  sky.addColorStop(0, "#bcdcea");
  sky.addColorStop(1, "#eef6ee");
  g.fillStyle = sky;
  g.fillRect(x, y, w, horizon - y);
  // Far trees, then nearer ones: rows of round crowns in NEAR-ish greens.
  const rows: [number, number, string[]][] = [
    [horizon - 2, 7, ["#9cc9a2", "#8dbf98", "#a9d1a6"]],
    [horizon + 2, 9, ["#5e9f6f", "#4c8f63", "#6aa978"]],
  ];
  for (const [base, size, cols] of rows) {
    for (let tx = x - size; tx < x + w + size; tx += size * (0.8 + rnd() * 0.5)) {
      const r = size * (0.7 + rnd() * 0.6);
      blob(g, tx, base - r * 0.6, r, r * 1.1, pick(cols, rnd));
    }
  }
  const lawn = g.createLinearGradient(0, horizon, 0, y + h);
  lawn.addColorStop(0, "#8fc47c");
  lawn.addColorStop(1, "#6fae64");
  g.fillStyle = lawn;
  g.fillRect(x, horizon + 2, w, y + h - horizon);
  // Flower beds along the lawn.
  for (let i = 0; i < w / 1.6; i++) {
    const fx = x + rnd() * w;
    const fy = horizon + 4 + rnd() * 6;
    blob(g, fx, fy, 0.9, 0.7, pick(["#f5f0f2", "#f2a5b6", "#f6d36b", "#e66f5c"], rnd));
  }
  // Sunlight from the top right.
  const sun = g.createRadialGradient(x + w * 0.9, y, 1, x + w * 0.9, y, w);
  sun.addColorStop(0, "rgba(255,244,214,0.55)");
  sun.addColorStop(1, "rgba(255,244,214,0)");
  g.fillStyle = sun;
  g.fillRect(x, y, w, h);
  g.restore();
}

/** A potted plant standing on the floor (or a sill) at (x, base): terracotta pot, a crown of leaves. */
function pottedPlant(g: G, x: number, base: number, size: number, rnd: Rnd, pot = "#c46f4b") {
  const pw = size * 0.55;
  const ph = size * 0.45;
  g.fillStyle = pot;
  g.beginPath();
  g.moveTo(x - pw / 2, base - ph);
  g.lineTo(x + pw / 2, base - ph);
  g.lineTo(x + pw * 0.38, base);
  g.lineTo(x - pw * 0.38, base);
  g.closePath();
  g.fill();
  rect(g, x - pw * 0.55, base - ph - size * 0.06, pw * 1.1, size * 0.08, "#b0603f");
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
    const len = size * (0.5 + rnd() * 0.7);
    const lx = x + Math.cos(a) * len * 0.75;
    const ly = base - ph + Math.sin(a) * len;
    blob(g, lx, ly, size * 0.24, size * 0.13, pick(LEAF, rnd), a);
  }
}

/** A bookcase against the wall: walnut shelves full of books, a trailing plant on top. */
function bookcase(g: G, x: number, w: number, floor: number, height: number, rnd: Rnd) {
  const top = floor - height;
  rect(g, x, top, w, height, WALNUT);
  rect(g, x + 0.8, top + 0.8, w - 1.6, height - 1.6, "#5e432f");
  const shelf = height / 5;
  for (let s = 0; s < 5; s++) {
    const sy = top + s * shelf;
    let bx = x + 1.2;
    while (bx < x + w - 2.5) {
      const bw = 0.9 + rnd() * 1.5;
      const bh = shelf * (0.55 + rnd() * 0.35);
      if (rnd() < 0.12) {
        bx += bw;
        continue;
      }
      rect(g, bx, sy + shelf - bh - 0.6, bw - 0.15, bh, pick(BOOKS, rnd));
      bx += bw;
    }
    rect(g, x + 0.8, sy + shelf - 0.7, w - 1.6, 0.7, WALNUT);
  }
  pottedPlant(g, x + w * 0.7, top, 7, rnd, "#e8e1d4");
  // Leaves trailing down the side.
  for (let i = 0; i < 18; i++)
    blob(g, x + w * 0.85 + rnd() * 2, top + i * 1.8, 1.1, 0.7, LEAF[i % LEAF.length]!);
}

/** A floor lamp with a warm glow round its shade. */
function floorLamp(g: G, x: number, floor: number, height: number) {
  const glow = g.createRadialGradient(x, floor - height, 1, x, floor - height, 26);
  glow.addColorStop(0, "rgba(255,214,150,0.75)");
  glow.addColorStop(1, "rgba(255,214,150,0)");
  g.fillStyle = glow;
  g.fillRect(x - 26, floor - height - 26, 52, 52);
  rect(g, x - 0.4, floor - height, 0.8, height, "#3a3530");
  blob(g, x, floor - 0.4, 4, 0.8, "#3a3530");
  g.fillStyle = "#f4e3c3";
  g.beginPath();
  g.moveTo(x - 3.5, floor - height - 6);
  g.lineTo(x + 3.5, floor - height - 6);
  g.lineTo(x + 5.5, floor - height + 1);
  g.lineTo(x - 5.5, floor - height + 1);
  g.closePath();
  g.fill();
}

/** A deep green sofa with cushions, its back against the wall. */
function sofa(g: G, x: number, w: number, floor: number) {
  const seat = floor - 18;
  roundRect(g, x, seat - 14, w, 16, 3, NEAR.forest);
  roundRect(g, x - 2, seat - 2, w + 4, 12, 2.5, "#1b6a4e");
  roundRect(g, x - 4, seat - 8, 6, 18, 2.5, "#12513b");
  roundRect(g, x + w - 2, seat - 8, 6, 18, 2.5, "#12513b");
  const cushions = [NEAR.mint, NEAR.green, "#f2d7a8"];
  cushions.forEach((c, i) => roundRect(g, x + 4 + i * (w / 3.4), seat - 10, w / 4.2, 9, 2.5, c));
  for (const lx of [x + 1, x + w - 2]) rect(g, lx, seat + 10, 1, floor - seat - 10, "#3a2b20");
}

/** A framed picture: a little landscape in greens. */
function frame(g: G, x: number, y: number, w: number, h: number, rnd: Rnd) {
  rect(g, x, y, w, h, "#2d2a26");
  rect(g, x + 0.6, y + 0.6, w - 1.2, h - 1.2, TRIM);
  const ix = x + 1.8;
  const iy = y + 1.8;
  const iw = w - 3.6;
  const ih = h - 3.6;
  rect(g, ix, iy, iw, ih, "#dfeee4");
  g.save();
  g.beginPath();
  g.rect(ix, iy, iw, ih);
  g.clip();
  for (let i = 0; i < 3; i++)
    blob(g, ix + rnd() * iw, iy + ih, iw * 0.4, ih * (0.3 + rnd() * 0.3), LEAF[i + 1]!);
  blob(g, ix + iw * 0.75, iy + ih * 0.3, ih * 0.12, ih * 0.12, "#f6d36b");
  g.restore();
}

// ---------- surfaces ----------

/**
 * The wall behind the table (facing the reader): glass balcony doors onto a garden, linen curtains,
 * a bookcase and a big plant on the left, an armchair and a floor lamp on the right.
 */
export function backWall(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(7);
    plaster(g, w, h);
    // The balcony doors fill the middle, where the reader looks past the book.
    const dw = Math.min(96, w * 0.55);
    const dx = w / 2 - dw / 2;
    const dTop = h - 88;
    rect(g, dx - 2.2, dTop - 2.2, dw + 4.4, 88 + 2.2, TRIM);
    const pane = { x: dx, y: dTop, w: dw, h: 88 };
    const horizon = h - 44;
    garden(g, pane.x, pane.y, pane.w, pane.h, horizon, rnd);
    // The balcony: deck boards, planters and a railing.
    g.save();
    g.beginPath();
    g.rect(pane.x, pane.y, pane.w, pane.h);
    g.clip();
    rect(g, pane.x, h - 10, pane.w, 10, "#cdb592");
    for (let i = 0; i < 4; i++) rect(g, pane.x, h - 10 + i * 2.5, pane.w, 0.25, "rgba(90,70,50,0.3)");
    pottedPlant(g, pane.x + pane.w * 0.14, h - 8, 12, rnd);
    pottedPlant(g, pane.x + pane.w * 0.86, h - 8, 14, rnd);
    rect(g, pane.x + pane.w * 0.32, h - 19, pane.w * 0.36, 9, "#a8704e");
    for (let i = 0; i < 14; i++)
      blob(
        g,
        pane.x + pane.w * (0.33 + rnd() * 0.34),
        h - 20 - rnd() * 3,
        1.6,
        1.2,
        ["#f2a5b6", "#f6d36b", "#f5f0f2", NEAR.green][i % 4]!,
      );
    rect(g, pane.x, h - 40, pane.w, 1.4, "#3b3f3a");
    for (let bx = pane.x + 1.5; bx < pane.x + pane.w; bx += 3.2) rect(g, bx, h - 40, 0.45, 30, "#3b3f3a");
    // Reflections on the glass.
    g.fillStyle = "rgba(255,255,255,0.14)";
    for (const off of [0.15, 0.6]) {
      g.beginPath();
      g.moveTo(pane.x + pane.w * off, pane.y);
      g.lineTo(pane.x + pane.w * (off + 0.12), pane.y);
      g.lineTo(pane.x + pane.w * (off - 0.05), pane.y + pane.h);
      g.lineTo(pane.x + pane.w * (off - 0.17), pane.y + pane.h);
      g.closePath();
      g.fill();
    }
    g.restore();
    // Frames: the two doors and the transom.
    rect(g, dx + dw / 2 - 1.2, dTop, 2.4, 88, TRIM);
    rect(g, dx, dTop + 16, dw, 1.8, TRIM);
    rect(g, dx - 2.2, h - 1.5, dw + 4.4, 1.5, "#d9cfbf");
    // Curtains on a rod, gathered either side.
    rect(g, dx - 14, dTop - 6, dw + 28, 0.8, "#3a3530");
    for (const side of [-1, 1]) {
      const cx = side < 0 ? dx - 12 : dx + dw + 1;
      g.fillStyle = "rgba(246,240,228,0.92)";
      g.fillRect(cx, dTop - 6, 11, h - dTop + 5);
      for (let f = 0; f < 6; f++)
        rect(g, cx + 0.8 + f * 1.8, dTop - 6, 0.6, h - dTop + 5, "rgba(150,130,100,0.18)");
    }
    // Light falling in from the balcony across the floor.
    const pool = g.createLinearGradient(0, h - 10, 0, h);
    pool.addColorStop(0, "rgba(255,240,205,0)");
    pool.addColorStop(1, "rgba(255,240,205,0.5)");
    g.fillStyle = pool;
    g.fillRect(dx, h - 10, dw, 10);
    // Left: a bookcase and a big plant. Right: an armchair, a floor lamp and a picture.
    bookcase(g, dx - 44, 24, h, 74, rnd);
    pottedPlant(g, dx - 15, h, 15, rnd);
    floorLamp(g, dx + dw + 30, h, 52);
    roundRect(g, dx + dw + 14, h - 30, 20, 22, 4, NEAR.forest);
    roundRect(g, dx + dw + 12, h - 16, 24, 9, 3, "#1b6a4e");
    roundRect(g, dx + dw + 17, h - 24, 12, 7, 2.5, NEAR.mint);
    frame(g, dx + dw + 38, h - 76, 16, 20, rnd);
    pottedPlant(g, dx + dw + 52, h, 12, rnd);
    cornerShade(g, w, h);
  };
}

/** The wall on the reader's right: a tall garden window near the back, a sofa and pictures. */
export function rightWall(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(23);
    plaster(g, w, h);
    // Canvas left is the back of the room.
    const wx = 14;
    const ww = 34;
    const wy = h - 86;
    rect(g, wx - 2, wy - 2, ww + 4, 64 + 4, TRIM);
    garden(g, wx, wy, ww, 64, h - 40, rnd);
    rect(g, wx + ww / 2 - 0.8, wy, 1.6, 64, TRIM);
    rect(g, wx - 4, wy + 64, ww + 8, 2, TRIM);
    pottedPlant(g, wx + 7, wy + 64, 9, rnd, "#e8e1d4");
    pottedPlant(g, wx + ww - 8, wy + 64, 8, rnd);
    sofa(g, w * 0.48, 46, h);
    frame(g, w * 0.5, h - 70, 14, 18, rnd);
    frame(g, w * 0.5 + 17, h - 66, 20, 14, rnd);
    pottedPlant(g, w * 0.86, h, 14, rnd);
    cornerShade(g, w, h);
  };
}

/** The wall on the reader's left: a sideboard with a lamp, pictures and plants. */
export function leftWall(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(41);
    plaster(g, w, h);
    // Canvas right is the back of the room.
    const sx = w * 0.42;
    rect(g, sx, h - 26, 44, 22, WALNUT);
    for (let i = 1; i < 4; i++) rect(g, sx + i * 11, h - 24, 0.4, 18, "rgba(40,28,20,0.4)");
    for (const lx of [sx + 2, sx + 41]) rect(g, lx, h - 4, 1, 4, "#3a2b20");
    // A table lamp with a warm glow, books and a plant on the sideboard.
    const glow = g.createRadialGradient(sx + 8, h - 38, 1, sx + 8, h - 38, 18);
    glow.addColorStop(0, "rgba(255,214,150,0.7)");
    glow.addColorStop(1, "rgba(255,214,150,0)");
    g.fillStyle = glow;
    g.fillRect(sx - 10, h - 56, 36, 36);
    rect(g, sx + 7.5, h - 34, 1, 8, "#3a3530");
    roundRect(g, sx + 3, h - 41, 10, 7, 1.5, "#f4e3c3");
    for (let i = 0; i < 5; i++)
      rect(g, sx + 18 + i * 1.6, h - 26 - 6 - rnd() * 2, 1.4, 6 + rnd() * 2, BOOKS[i]!);
    pottedPlant(g, sx + 36, h - 26, 9, rnd, "#e8e1d4");
    frame(g, sx + 4, h - 76, 18, 24, rnd);
    frame(g, sx + 26, h - 70, 14, 14, rnd);
    pottedPlant(g, w * 0.88, h, 16, rnd);
    pottedPlant(g, w * 0.14, h, 13, rnd);
    cornerShade(g, w, h);
  };
}

/** The wall behind the reader: the room's door and a coat stand. Rarely seen. */
export function frontWall(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(59);
    plaster(g, w, h);
    rect(g, w * 0.3 - 2, h - 74, 34, 74, TRIM);
    rect(g, w * 0.3, h - 72, 30, 72, "#d8c7aa");
    blob(g, w * 0.3 + 26, h - 36, 1, 1, "#8a7356");
    frame(g, w * 0.62, h - 70, 22, 16, rnd);
    pottedPlant(g, w * 0.82, h, 14, rnd);
    cornerShade(g, w, h);
  };
}

/** The ceiling: warm white, a little darker at the edges. */
export function ceiling(w: number, h: number): (g: G) => void {
  return (g) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, "#f6f1e7");
    grad.addColorStop(1, "#ddd2bf");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  };
}

/**
 * The floor: warm oak boards running along x, and a rug under the table (`rug` is its x, y, w, h on the
 * floor, with y towards the front of the room). Light from the balcony falls in from the back.
 */
export function floor(w: number, h: number, rug: [number, number, number, number]): (g: G) => void {
  return (g) => {
    const rnd = seeded(83);
    rect(g, 0, 0, w, h, "#c39a6b");
    for (let y = 0; y < h; y += 5) {
      rect(g, 0, y, w, 5, `rgba(${110 + rnd() * 40},${70 + rnd() * 30},40,${0.08 + rnd() * 0.1})`);
      rect(g, 0, y, w, 0.25, "rgba(70,45,25,0.35)");
      for (let x = rnd() * 30; x < w; x += 24 + rnd() * 20) rect(g, x, y, 0.25, 5, "rgba(70,45,25,0.3)");
    }
    const [rx, ry, rw, rh] = rug;
    roundRect(g, rx, ry, rw, rh, 2, NEAR.sage);
    g.strokeStyle = NEAR.forest;
    g.lineWidth = 2.4;
    g.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);
    g.strokeStyle = NEAR.offWhite;
    g.lineWidth = 0.8;
    g.strokeRect(rx + 7, ry + 7, rw - 14, rh - 14);
    for (let x = rx + 2; x < rx + rw; x += 1.6) {
      rect(g, x, ry - 1.4, 0.4, 1.4, NEAR.offWhite);
      rect(g, x, ry + rh, 0.4, 1.4, NEAR.offWhite);
    }
    const sun = g.createLinearGradient(0, 0, 0, h * 0.5);
    sun.addColorStop(0, "rgba(255,238,200,0.45)");
    sun.addColorStop(1, "rgba(255,238,200,0)");
    g.fillStyle = sun;
    g.fillRect(w * 0.3, 0, w * 0.4, h * 0.5);
  };
}
