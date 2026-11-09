/**
 * Paintings of the setting round the book (Room.tsx, BookBackdrop.tsx): a desk under a wide window at
 * sunset, a garden and mountains outside, a bookshelf with a trailing pothos, a plant on the desk.
 * Each surface is painted on a canvas in world units, then blurred by scaling it down and up again
 * (works in every browser, unlike `ctx.filter`), so the setting reads as out of focus behind the book.
 * The light is a warm sunset; the greens are NEAR's (theme.ts NEAR), and so are the book's cover and ribbon.
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
 * Transparent where nothing is painted (window panes, round the plant).
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

/** Sunset light. */
const SUN = {
  gold: "#ffd27a",
  orange: "#f39a4f",
  pink: "#ec8aa8",
  violet: "#6d63b5",
  dusk: "#4f4c9a",
};
/** The room's wood, in the shade and where the sunset catches it. */
const ROOMWOOD = { dark: "#3d2216", mid: "#5c3420", lit: "#c9773f" };
/** Leaves: NEAR's greens in the shade, warm yellow-greens where the sun catches them. */
const LEAF = [NEAR.forest, NEAR.deep, "#2f7d55", "#5e9a3e"];
const LIT_LEAF = ["#b8c24a", "#d6cf5a", "#9db446"];
const BOOKS = ["#e9e1d3", "#d9cfc0", "#c9bca8", "#7a5a48", "#3f3a44", NEAR.forest, "#b8735a", "#f0ead9"];
const BLOSSOM = ["#f27ca8", "#e86b9a", "#f9a8c4", "#fbd0de"];

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

/** A pointed leaf (like a pothos or a peace lily) from (x, y), pointing along angle `a`. */
function leaf(g: G, x: number, y: number, len: number, a: number, fill: string) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.45, -len * 0.42, len, 0);
  g.quadraticCurveTo(len * 0.45, len * 0.42, 0, 0);
  g.fill();
  g.strokeStyle = "rgba(30,50,20,0.35)";
  g.lineWidth = len * 0.04;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(len * 0.9, 0);
  g.stroke();
  g.restore();
}

/** A trailing vine hanging from (x, y), `n` leaves long, swaying a little. */
function vine(g: G, x: number, y: number, n: number, size: number, rnd: Rnd) {
  let vx = x;
  let vy = y;
  g.strokeStyle = "#4d6b2a";
  g.lineWidth = size * 0.08;
  for (let i = 0; i < n; i++) {
    const nx = vx + (rnd() - 0.5) * size * 0.8;
    const ny = vy + size * 0.9;
    g.beginPath();
    g.moveTo(vx, vy);
    g.lineTo(nx, ny);
    g.stroke();
    const side = i % 2 ? 1 : -1;
    const fill = rnd() < 0.45 ? pick(LIT_LEAF, rnd) : pick(LEAF, rnd);
    leaf(g, nx, ny, size * (0.8 + rnd() * 0.4), Math.PI / 2 + side * 0.9, fill);
    vx = nx;
    vy = ny;
  }
}

// ---------- outside ----------

/**
 * The view out of the window at sunset, on a plane `w` x `h` far behind the window. `horizon` is the
 * eye-level line, in units from the top. A low sun over purple mountains with a snowy peak, green hills,
 * a garden with stepping stones, a tree leaning in on the left and a pink blossom tree on the right.
 */
export function landscape(w: number, h: number, horizon: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(101);
    const cx = w / 2;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, SUN.dusk);
    sky.addColorStop(0.35, SUN.violet);
    sky.addColorStop(0.62, SUN.pink);
    sky.addColorStop(0.84, SUN.orange);
    sky.addColorStop(1, SUN.gold);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, horizon + 10);
    // The sun, low over the mountains a little left of the middle, with a wide glow.
    const sx = cx - 18;
    const sy = horizon - 14;
    const glow = g.createRadialGradient(sx, sy, 2, sx, sy, 110);
    glow.addColorStop(0, "rgba(255,240,190,0.95)");
    glow.addColorStop(0.15, "rgba(255,210,140,0.55)");
    glow.addColorStop(1, "rgba(255,180,120,0)");
    g.fillStyle = glow;
    g.fillRect(sx - 110, sy - 110, 220, 220);
    blob(g, sx, sy, 8, 8, "#fff6d8");
    // Pink and orange clouds in long streaks: orange near the sun, pink higher up.
    for (let i = 0; i < 26; i++) {
      const y = horizon - 40 - rnd() * 90;
      const x = rnd() * w;
      const len = 18 + rnd() * 50;
      const col = horizon - y < 60 ? "rgba(255,170,120,0.75)" : "rgba(240,130,170,0.7)";
      for (let k = 0; k < 4; k++)
        blob(g, x + k * len * 0.22, y - rnd() * 2.5, len * 0.32, 2 + rnd() * 2.5, col);
    }
    const ridge = (base: number, peaks: [number, number][], fill: string) => {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(0, base);
      for (const [px, py] of peaks) g.lineTo(px, py);
      g.lineTo(w, base);
      g.lineTo(w, base + 60);
      g.lineTo(0, base + 60);
      g.closePath();
      g.fill();
    };
    // Far mountains: lilac ridges.
    const far: [number, number][] = [];
    for (let x = 0; x <= w; x += 22) far.push([x, horizon - 10 - rnd() * 16]);
    ridge(horizon, far, "#a585bf");
    // The big snowy peak right of the middle.
    const px = cx + 50;
    const top = horizon - 58;
    g.fillStyle = "#8f73b3";
    g.beginPath();
    g.moveTo(px - 95, horizon);
    g.lineTo(px - 30, top + 22);
    g.lineTo(px, top);
    g.lineTo(px + 22, top + 14);
    g.lineTo(px + 34, top + 8);
    g.lineTo(px + 110, horizon);
    g.closePath();
    g.fill();
    g.fillStyle = "#f1e6f2";
    g.beginPath();
    g.moveTo(px - 18, top + 12);
    g.lineTo(px, top);
    g.lineTo(px + 22, top + 14);
    g.lineTo(px + 34, top + 8);
    g.lineTo(px + 46, top + 18);
    g.lineTo(px + 26, top + 20);
    g.lineTo(px + 12, top + 15);
    g.lineTo(px - 4, top + 20);
    g.closePath();
    g.fill();
    // Nearer ridges, purple fading into the green of the hills.
    const mid: [number, number][] = [];
    for (let x = 0; x <= w; x += 16) mid.push([x, horizon - 2 - Math.sin(x / 40) * 6 - rnd() * 5]);
    ridge(horizon + 4, mid, "#7a6198");
    const hills: [number, number][] = [];
    for (let x = 0; x <= w; x += 12) hills.push([x, horizon + 8 - Math.sin(x / 55 + 1) * 5 - rnd() * 3]);
    ridge(horizon + 14, hills, "#4f6e5a");
    // Forest along the hills: round dark crowns in NEAR greens, some lit gold on top.
    for (let x = 0; x < w; x += 3 + rnd() * 3) {
      const y = horizon + 14 + rnd() * 6;
      const r = 3 + rnd() * 4;
      blob(g, x, y, r, r * 1.1, pick([NEAR.forest, "#2f5e43", "#3c6d4a"], rnd));
      if (rnd() < 0.5) blob(g, x - r * 0.3, y - r * 0.5, r * 0.5, r * 0.35, "rgba(214,207,90,0.55)");
    }
    // The garden: warm lawn, stepping stones leading away, flowering bushes.
    const lawn = g.createLinearGradient(0, horizon + 20, 0, h);
    lawn.addColorStop(0, "#8fae4e");
    lawn.addColorStop(0.4, "#6f9a42");
    lawn.addColorStop(1, "#4d7a35");
    g.fillStyle = lawn;
    g.fillRect(0, horizon + 20, w, h - horizon - 20);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const y = horizon + 26 + t * t * 120;
      const x = cx + Math.sin(i * 0.9) * (8 + t * 30) - 10;
      const s = 3 + t * 12;
      blob(g, x, y + s * 0.15, s * 1.25, s * 0.42, "rgba(40,50,30,0.35)");
      blob(g, x, y, s * 1.2, s * 0.38, pick(["#c9b8c4", "#bfaebb", "#d6c6cd"], rnd));
    }
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w;
      const y = horizon + 22 + rnd() * 90;
      const s = 2 + ((y - horizon) / 90) * 9;
      blob(g, x, y, s * 1.4, s, pick([NEAR.forest, "#3f7a40", "#5e9a3e"], rnd));
      if (rnd() < 0.6)
        for (let k = 0; k < 5; k++)
          blob(
            g,
            x + (rnd() - 0.5) * s * 2,
            y - rnd() * s,
            s * 0.22,
            s * 0.22,
            pick([...BLOSSOM, "#fff2f4"], rnd),
          );
    }
    blob(g, cx + 70, horizon + 40, 16, 7, "#a99aa8");
    blob(g, cx + 68, horizon + 37, 13, 5, "#c2b3c0");
    // A tree leaning in from the left, its leaves lit gold by the sun.
    g.strokeStyle = "#4a3326";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(cx - 150, h);
    g.quadraticCurveTo(cx - 160, horizon, cx - 120, horizon - 70);
    g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - 140, horizon - 40);
    g.quadraticCurveTo(cx - 100, horizon - 85, cx - 60, horizon - 95);
    g.stroke();
    for (let i = 0; i < 140; i++) {
      const x = cx - 220 + rnd() * 190;
      const y = horizon - 130 + rnd() * 90;
      const fill = rnd() < 0.5 ? pick(LIT_LEAF, rnd) : pick(LEAF, rnd);
      blob(g, x, y, 4 + rnd() * 6, 3 + rnd() * 4, fill, rnd() * 3);
    }
    // A pink blossom tree on the right.
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(cx + 175, h);
    g.quadraticCurveTo(cx + 168, horizon + 10, cx + 150, horizon - 40);
    g.stroke();
    for (let i = 0; i < 120; i++) {
      const x = cx + 110 + rnd() * 120;
      const y = horizon - 80 + rnd() * 70;
      blob(g, x, y, 3 + rnd() * 5, 2.5 + rnd() * 4, pick(BLOSSOM, rnd));
    }
    // Warm haze along the horizon.
    const haze = g.createLinearGradient(0, horizon - 30, 0, horizon + 40);
    haze.addColorStop(0, "rgba(255,200,140,0)");
    haze.addColorStop(0.5, "rgba(255,200,140,0.22)");
    haze.addColorStop(1, "rgba(255,200,140,0)");
    g.fillStyle = haze;
    g.fillRect(0, horizon - 30, w, 70);
  };
}

// ---------- inside ----------

/** A wall of the room in the evening: warm and dim, lit orange from the window's side. */
function dimWall(g: G, w: number, h: number, litFrom: "left" | "right" | "none") {
  rect(g, 0, 0, w, h, "#6e432d");
  if (litFrom !== "none") {
    const x0 = litFrom === "left" ? 0 : w;
    const lit = g.createLinearGradient(x0, 0, w - x0, 0);
    lit.addColorStop(0, "rgba(240,140,70,0.55)");
    lit.addColorStop(0.6, "rgba(240,140,70,0.08)");
    lit.addColorStop(1, "rgba(240,140,70,0)");
    g.fillStyle = lit;
    g.fillRect(0, 0, w, h);
  }
  const top = g.createLinearGradient(0, 0, 0, h * 0.3);
  top.addColorStop(0, "rgba(30,15,10,0.35)");
  top.addColorStop(1, "rgba(30,15,10,0)");
  g.fillStyle = top;
  g.fillRect(0, 0, w, h * 0.3);
  rect(g, 0, h - 4, w, 4, ROOMWOOD.dark);
}

/** A tall bookshelf in warm wood, its shelves full of pale books, a pot on top and a vine trailing down. */
function bookshelf(g: G, x: number, w: number, floor: number, height: number, rnd: Rnd) {
  const top = floor - height;
  rect(g, x, top, w, height, ROOMWOOD.mid);
  rect(g, x + 1, top + 1, w - 2, height - 2, ROOMWOOD.dark);
  const shelf = height / 6;
  for (let s = 0; s < 6; s++) {
    const sy = top + s * shelf;
    let bx = x + 1.4;
    while (bx < x + w - 2.5) {
      const bw = 1 + rnd() * 1.4;
      const bh = shelf * (0.6 + rnd() * 0.3);
      if (rnd() < 0.1) {
        bx += bw * 2;
        continue;
      }
      rect(g, bx, sy + shelf - bh - 0.8, bw - 0.15, bh, pick(BOOKS, rnd));
      bx += bw;
    }
    // The shelf board, its front edge catching the sunset.
    rect(g, x + 1, sy + shelf - 0.9, w - 2, 0.9, ROOMWOOD.lit);
  }
  roundRect(g, x + w * 0.55, top - 5, 6, 5, 1, "#e8e1d4");
  vine(g, x + w * 0.62, top - 3, 22, 2.6, rnd);
  vine(g, x + w * 0.8, top - 3, 14, 2.4, rnd);
}

/**
 * The window wall behind the desk (facing the reader), `w` x `h` with y down from the ceiling. The
 * window's panes (`win`: x0, y0, x1, y1 in the same units) are left transparent, so the landscape far
 * behind shows through. Dark wood frames: a narrow pane on the left, a wide one in the middle, and a
 * pane with a transom on the right. A bookshelf with a trailing pothos stands left of the window.
 * Returns the x of the mullions too, for the shadows on the desk (see `mullions`).
 */
export function windowWall(w: number, h: number, win: [number, number, number, number]): (g: G) => void {
  return (g) => {
    const rnd = seeded(7);
    dimWall(g, w, h, "none");
    const [x0, y0, x1, y1] = win;
    const ww = x1 - x0;
    const wh = y1 - y0;
    // Sunset spilling round the window onto the wall.
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const spill = g.createRadialGradient(mx, my, wh * 0.3, mx, my, ww * 0.8);
    spill.addColorStop(0, "rgba(255,160,80,0.55)");
    spill.addColorStop(1, "rgba(255,160,80,0)");
    g.fillStyle = spill;
    g.fillRect(0, 0, w, h);
    g.clearRect(x0, y0, ww, wh);
    const t = 2.4;
    const [left, right] = mullions(x0, x1);
    const transom = y0 + wh * 0.2;
    rect(g, x0 - t, y0 - t, ww + 2 * t, t, ROOMWOOD.dark);
    rect(g, x0 - t, y1, ww + 2 * t, t * 0.6, ROOMWOOD.dark);
    rect(g, x0 - t, y0 - t, t, wh + 2 * t, ROOMWOOD.dark);
    rect(g, x1, y0 - t, t, wh + 2 * t, ROOMWOOD.dark);
    rect(g, left - t / 2, y0, t, wh, ROOMWOOD.dark);
    rect(g, right - t / 2, y0, t, wh, ROOMWOOD.dark);
    rect(g, right, transom - t / 2, x1 - right, t, ROOMWOOD.dark);
    // A latch on the middle pane, and the sun catching the frames' edges.
    rect(g, left + t / 2 + 0.6, y0 + wh * 0.42, 0.8, 4, "#8a6a4a");
    g.fillStyle = "rgba(255,170,90,0.6)";
    for (const x of [left + t / 2, right + t / 2, x0]) g.fillRect(x - 0.35, y0, 0.35, wh);
    g.fillRect(x0, y1 - 0.35, ww, 0.35);
    // Bookshelf on the left of the window, a pothos trailing over the window's top left corner.
    const sw = Math.min(30, x0 - 6);
    if (sw > 10) bookshelf(g, x0 - t - sw - 1, sw, h, h - 6, rnd);
    vine(g, x0 + 2, y0 - 1, 9, 2.6, rnd);
    vine(g, x0 + 6, y0 - 1, 6, 2.4, rnd);
  };
}

/** The x of the window's two mullions, for a window from x0 to x1: a narrow left pane, a wide middle one. */
export function mullions(x0: number, x1: number): [number, number] {
  const ww = x1 - x0;
  return [x0 + ww * 0.17, x0 + ww * 0.72];
}

/** The wall on the reader's left (canvas right is the back): a bookshelf by the window and a picture. */
export function leftWall(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(41);
    dimWall(g, w, h, "right");
    bookshelf(g, w - 34, 30, h, h - 6, rnd);
    rect(g, w * 0.4, h - 70, 18, 22, ROOMWOOD.dark);
    rect(g, w * 0.4 + 1.5, h - 68.5, 15, 19, "#d9a26c");
  };
}

/** The wall on the reader's right (canvas left is the back): lit near the window, a picture and a floor plant. */
export function rightWall(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(23);
    dimWall(g, w, h, "left");
    rect(g, w * 0.45, h - 72, 22, 16, ROOMWOOD.dark);
    rect(g, w * 0.45 + 1.5, h - 70.5, 19, 13, "#e8b07a");
    for (let i = 0; i < 18; i++)
      leaf(g, w * 0.75, h - 12, 8 + rnd() * 6, -Math.PI / 2 + (rnd() - 0.5) * 2.4, pick(LEAF, rnd));
    roundRect(g, w * 0.75 - 4, h - 14, 8, 10, 1.5, "#e8e1d4");
  };
}

/** The wall behind the reader: dim, rarely seen. */
export function frontWall(w: number, h: number): (g: G) => void {
  return (g) => dimWall(g, w, h, "none");
}

/** The ceiling: dim warm wood, catching a little sunset near the window. */
export function ceiling(w: number, h: number): (g: G) => void {
  return (g) => {
    rect(g, 0, 0, w, h, "#4e2e1f");
    const lit = g.createLinearGradient(0, h, 0, 0);
    lit.addColorStop(0, "rgba(240,140,70,0.25)");
    lit.addColorStop(1, "rgba(240,140,70,0)");
    g.fillStyle = lit;
    g.fillRect(0, 0, w, h);
  };
}

/** The floor: dark warm boards. */
export function floor(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(83);
    rect(g, 0, 0, w, h, "#6b3e26");
    for (let y = 0; y < h; y += 5) {
      rect(g, 0, y, w, 5, `rgba(${90 + rnd() * 40},${45 + rnd() * 20},25,${0.1 + rnd() * 0.12})`);
      rect(g, 0, y, w, 0.25, "rgba(30,15,8,0.45)");
    }
  };
}

/** The wood of the desk top: warm planks along x with fine grain. Tiles. */
export function deskWood(): HTMLCanvasElement {
  const n = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d")!;
  const rnd = seeded(29);
  g.fillStyle = "#c98c5c";
  g.fillRect(0, 0, n, n);
  const planks = 4;
  const ph = n / planks;
  for (let p = 0; p < planks; p++) {
    const top = p * ph;
    g.fillStyle = `rgba(${140 + rnd() * 30},${70 + rnd() * 20},35,${0.08 + rnd() * 0.08})`;
    g.fillRect(0, top, n, ph);
    for (let k = 0; k < 70; k++) {
      const y0 = top + rnd() * ph;
      const amp = 2 + rnd() * 7;
      const freq = (1 + Math.floor(rnd() * 3)) * ((2 * Math.PI) / n);
      const phase = rnd() * 6;
      g.strokeStyle = `rgba(100,50,22,${0.05 + rnd() * 0.12})`;
      g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      for (let x = 0; x <= n; x += 16) {
        const yy = y0 + Math.sin(x * freq + phase) * amp;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    g.fillStyle = "rgba(70,32,15,0.4)";
    g.fillRect(0, top, n, 2);
  }
  return c;
}

/**
 * Low sun through the window, on the desk (`w` x `d`, canvas top is the back, against the window): an
 * orange glow strongest by the window, crossed by the long shadows of the window's mullions (`bars`,
 * x positions in the same units) stretching towards the reader.
 */
export function deskLight(w: number, d: number, bars: number[]): (g: G) => void {
  return (g) => {
    const glow = g.createLinearGradient(0, 0, 0, d);
    glow.addColorStop(0, "rgba(255,140,60,0.6)");
    glow.addColorStop(0.55, "rgba(255,140,60,0.3)");
    glow.addColorStop(1, "rgba(255,140,60,0.08)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, d);
    // Bright patches of sun through the panes, long and leaning like the shadows.
    const edges = [0, ...bars, w];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i]! + 3;
      const b = edges[i + 1]! - 3;
      if (b - a < 4) continue;
      const sun = g.createLinearGradient(0, 0, 0, d);
      sun.addColorStop(0, "rgba(255,214,150,0.45)");
      sun.addColorStop(1, "rgba(255,214,150,0)");
      g.fillStyle = sun;
      g.beginPath();
      g.moveTo(a, 0);
      g.lineTo(b, 0);
      g.lineTo(b + d * 0.3, d);
      g.lineTo(a + d * 0.3, d);
      g.closePath();
      g.fill();
    }
    // The sun is a little left of the middle, so the shadows lean right as they come forward.
    g.fillStyle = "rgba(70,25,10,0.42)";
    for (const x of bars) {
      g.beginPath();
      g.moveTo(x - 1.4, 0);
      g.lineTo(x + 1.4, 0);
      g.lineTo(x + 1.4 + d * 0.3 + 3, d);
      g.lineTo(x - 1.4 + d * 0.3 - 3, d);
      g.closePath();
      g.fill();
    }
  };
}

/** A plant in a white pot for the desk, `w` x `h`, the pot standing on the bottom edge. Transparent round it. */
export function deskPlant(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seeded(61);
    const cx = w / 2;
    const potH = h * 0.28;
    const potW = w * 0.4;
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
      const len = h * (0.35 + rnd() * 0.3);
      const bx = cx + (rnd() - 0.5) * potW * 0.4;
      const by = h - potH;
      g.strokeStyle = "#4d6b2a";
      g.lineWidth = 0.35;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a) * len * 0.5, by + Math.sin(a) * len * 0.5);
      g.stroke();
      const lit = Math.cos(a) < -0.1 && rnd() < 0.7;
      const fill = lit ? pick(LIT_LEAF, rnd) : pick(LEAF, rnd);
      leaf(g, bx + Math.cos(a) * len * 0.45, by + Math.sin(a) * len * 0.45, len * 0.6, a, fill);
    }
    g.fillStyle = "#ece6dc";
    g.beginPath();
    g.moveTo(cx - potW / 2, h - potH);
    g.lineTo(cx + potW / 2, h - potH);
    g.lineTo(cx + potW * 0.4, h);
    g.lineTo(cx - potW * 0.4, h);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,170,90,0.35)";
    g.fillRect(cx - potW / 2, h - potH, potW * 0.25, potH);
    rect(g, cx - potW * 0.52, h - potH - 0.6, potW * 1.04, 0.9, "#f4efe7");
  };
}
