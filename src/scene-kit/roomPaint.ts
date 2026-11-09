/**
 * Paintings of the setting round the book (Room.tsx, BookBackdrop.tsx): a desk in a window nook at sunset.
 * The back wall is the owner's painting (assets/sunset-window.jpg: a bookshelf with a trailing pothos, a
 * three-pane window onto mountains and a garden, a plant on the sill), carried on upwards to the ceiling.
 * The rest (side walls, floor, ceiling, desk) is painted here in its colours: warm wood in sunset light.
 */
import { PICTURE as PICTURE_SIZE } from "./roomLayout";

type G = CanvasRenderingContext2D;

/** A seeded random generator, so the paintings are the same on every load. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Where things are in the painting, in its own pixels (cut at the window's bottom frame). */
const PICTURE = {
  ...PICTURE_SIZE,
  /** The bookshelf on the left: one bay (a row of books and its board), to repeat up the wall. */
  shelf: { x: 0, y: 100, w: 226, h: 260 },
  /** The window's frame verticals: the outer frame and the two mullions (left edge, width). */
  frames: [
    [236, 28],
    [448, 42],
    [1286, 66],
  ] as [number, number][],
} as const;

/** The room's wood, in the shade and where the sunset catches it. */
const WOOD = { dark: "#2f1a11", mid: "#4a2a1a", frame: "#5a3322", lit: "#c9773f" };

/**
 * A canvas `w` x `h` world units, painted by `paint` with 1 unit = 1 (y runs down from the top), then
 * softened: `blur` is how many times smaller the picture is shrunk before it is blown up again.
 */
export function paintSurface(w: number, h: number, blur: number, paint: (g: G) => void): HTMLCanvasElement {
  const k = 2048 / Math.max(w, h);
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

/**
 * The back wall from the desk top to the ceiling: the painting along the bottom, and above it the window
 * carried on (sky deepening to dusk between the frames, then the window's head beam) and the bookshelf
 * carried on to the ceiling. `picH` is the share of the wall's height the painting fills (0..1).
 */
export function backWall(img: HTMLImageElement, picH: number): HTMLCanvasElement {
  const P = PICTURE;
  const W = P.width;
  const H = Math.round(P.height / picH);
  const E = H - P.height;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = WOOD.dark;
  g.fillRect(0, 0, W, H);
  // The window carried on above the painting: its top rows stretched up, deepening to dusk violet.
  const winX = P.frames[0]![0];
  const head = Math.max(0, E - Math.min(E, P.height * 0.5));
  g.drawImage(img, winX, 0, W - winX, 6, winX, head, W - winX, E - head + 2);
  const dusk = g.createLinearGradient(0, head, 0, E);
  dusk.addColorStop(0, "rgba(92,84,170,0.9)");
  dusk.addColorStop(0.6, "rgba(160,110,170,0.35)");
  dusk.addColorStop(1, "rgba(255,180,140,0)");
  g.fillStyle = dusk;
  g.fillRect(winX, head, W - winX, E - head + 2);
  for (const [x, w] of P.frames) {
    g.fillStyle = WOOD.frame;
    g.fillRect(x, head, w, E - head + 2);
    g.fillStyle = "rgba(255,170,90,0.35)";
    g.fillRect(x + w - 3, head, 3, E - head + 2);
  }
  // The window's head beam, and the wall above it.
  g.fillStyle = WOOD.mid;
  g.fillRect(winX - 20, head - 34, W - winX + 20, 34);
  g.fillStyle = "rgba(255,170,90,0.4)";
  g.fillRect(winX - 20, head - 3, W - winX + 20, 3);
  // The bookshelf carried on up to the ceiling.
  const s = P.shelf;
  for (let y = E - s.h; y > -s.h; y -= s.h) g.drawImage(img, s.x, s.y, s.w, s.h, 0, y, s.w, s.h);
  g.fillStyle = WOOD.mid;
  g.fillRect(s.w, 0, 14, E);
  // The painting, its bottom on the desk.
  g.drawImage(img, 0, E);
  // Dim the top, where the sunset does not reach.
  const top = g.createLinearGradient(0, 0, 0, head);
  top.addColorStop(0, "rgba(20,10,6,0.55)");
  top.addColorStop(1, "rgba(20,10,6,0)");
  g.fillStyle = top;
  g.fillRect(0, 0, W, head);
  return soften(c, 2);
}

/** The x (in world units across a wall `w` wide) of the painting's window frames, for their shadows on the desk. */
export function frameXs(w: number): number[] {
  return PICTURE.frames.map(([x, fw]) => ((x + fw / 2) / PICTURE.width) * w);
}

/** A wall in the evening: warm and dark, lit orange towards the window (`litFrom`), a skirting board. */
function dimWall(g: G, w: number, h: number, litFrom: "left" | "right" | "none") {
  g.fillStyle = "#4a2c1d";
  g.fillRect(0, 0, w, h);
  if (litFrom !== "none") {
    const x0 = litFrom === "left" ? 0 : w;
    const lit = g.createLinearGradient(x0, 0, w - x0, 0);
    lit.addColorStop(0, "rgba(240,130,60,0.5)");
    lit.addColorStop(0.5, "rgba(240,130,60,0.1)");
    lit.addColorStop(1, "rgba(240,130,60,0)");
    g.fillStyle = lit;
    g.fillRect(0, 0, w, h);
  }
  const top = g.createLinearGradient(0, 0, 0, h * 0.4);
  top.addColorStop(0, "rgba(15,8,5,0.5)");
  top.addColorStop(1, "rgba(15,8,5,0)");
  g.fillStyle = top;
  g.fillRect(0, 0, w, h * 0.4);
  g.fillStyle = WOOD.dark;
  g.fillRect(0, h - 4, w, 4);
}

/**
 * The wall on the reader's left (canvas right is the back, by the window): bookshelves from the floor to
 * the ceiling, the painting's own shelves repeated, fading into shadow away from the window.
 */
export function leftWall(img: HTMLImageElement | null, w: number, h: number): (g: G) => void {
  return (g) => {
    dimWall(g, w, h, "right");
    if (!img) return;
    const s = PICTURE.shelf;
    const th = 27;
    const tw = (th * s.w) / s.h;
    const span = Math.min(w * 0.45, 70);
    for (let x = w - span; x < w; x += tw)
      for (let y = h - th; y > -th; y -= th) g.drawImage(img, s.x, s.y, s.w, s.h, x, y, tw, th);
    const shade = g.createLinearGradient(w - span, 0, w, 0);
    shade.addColorStop(0, "rgba(20,10,6,0.75)");
    shade.addColorStop(1, "rgba(20,10,6,0)");
    g.fillStyle = shade;
    g.fillRect(w - span, 0, span, h);
  };
}

/** The wall on the reader's right (canvas left is the back, by the window): warm wood, lit near the window. */
export function rightWall(w: number, h: number): (g: G) => void {
  return (g) => dimWall(g, w, h, "left");
}

/** The wall behind the reader: dark, rarely seen. */
export function frontWall(w: number, h: number): (g: G) => void {
  return (g) => dimWall(g, w, h, "none");
}

/** The wall below the desk top, behind the desk: in shadow. */
export function underWall(w: number, h: number): (g: G) => void {
  return (g) => {
    g.fillStyle = WOOD.dark;
    g.fillRect(0, 0, w, h);
  };
}

/** The ceiling: dark warm wood, catching a little sunset near the window (canvas top is the back). */
export function ceiling(w: number, h: number): (g: G) => void {
  return (g) => {
    g.fillStyle = "#3a2117";
    g.fillRect(0, 0, w, h);
    const lit = g.createLinearGradient(0, 0, 0, h * 0.5);
    lit.addColorStop(0, "rgba(240,130,60,0.25)");
    lit.addColorStop(1, "rgba(240,130,60,0)");
    g.fillStyle = lit;
    g.fillRect(0, 0, w, h);
  };
}

/** The floor: dark warm boards (canvas top is the back of the room). */
export function floor(w: number, h: number): (g: G) => void {
  return (g) => {
    const rnd = seededRandom(83);
    g.fillStyle = "#5a321f";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5) {
      g.fillStyle = `rgba(${90 + rnd() * 40},${45 + rnd() * 20},25,${0.1 + rnd() * 0.12})`;
      g.fillRect(0, y, w, 5);
      g.fillStyle = "rgba(30,15,8,0.45)";
      g.fillRect(0, y, w, 0.25);
    }
  };
}

/** The wood of the desk top: warm planks along x with fine grain, as in the painting. Tiles. */
export function deskWood(): HTMLCanvasElement {
  const n = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d")!;
  const rnd = seededRandom(29);
  g.fillStyle = "#c2703f";
  g.fillRect(0, 0, n, n);
  const planks = 4;
  const ph = n / planks;
  for (let p = 0; p < planks; p++) {
    const top = p * ph;
    g.fillStyle = `rgba(${150 + rnd() * 30},${60 + rnd() * 20},30,${0.1 + rnd() * 0.08})`;
    g.fillRect(0, top, n, ph);
    for (let k = 0; k < 70; k++) {
      const y0 = top + rnd() * ph;
      const amp = 2 + rnd() * 7;
      const freq = (1 + Math.floor(rnd() * 3)) * ((2 * Math.PI) / n);
      const phase = rnd() * 6;
      g.strokeStyle = `rgba(95,40,18,${0.05 + rnd() * 0.12})`;
      g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      for (let x = 0; x <= n; x += 16) {
        const yy = y0 + Math.sin(x * freq + phase) * amp;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    g.fillStyle = "rgba(70,28,12,0.45)";
    g.fillRect(0, top, n, 2);
  }
  return c;
}

/**
 * Low sun through the window, on the desk (`w` x `d`, canvas top is the back, against the window): bright
 * warm bands through the panes and the long dark shadows of the frames (`bars`, x in the same units)
 * stretching towards the reader and leaning right, as in the painting.
 */
export function deskLight(w: number, d: number, bars: number[]): (g: G) => void {
  return (g) => {
    const lean = d * 0.45;
    const glow = g.createLinearGradient(0, 0, 0, d);
    glow.addColorStop(0, "rgba(255,150,70,0.45)");
    glow.addColorStop(0.6, "rgba(255,150,70,0.2)");
    glow.addColorStop(1, "rgba(255,150,70,0.05)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, d);
    // Thin shadows of the glazing bars between the frames, then the frames' own wide shadows.
    const band = (x: number, half: number, fill: string) => {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(x - half, 0);
      g.lineTo(x + half, 0);
      g.lineTo(x + half * 2.2 + lean, d);
      g.lineTo(x - half * 2.2 + lean, d);
      g.closePath();
      g.fill();
    };
    const edges = [-lean, ...bars, w];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i]!;
      const b = edges[i + 1]!;
      for (let x = a + (b - a) / 3; x < b - 1; x += (b - a) / 3) band(x, 0.5, "rgba(90,35,12,0.18)");
    }
    for (const x of bars) band(x, 1.6, "rgba(80,28,10,0.45)");
    // The sill's shadow along the back of the desk.
    const sill = g.createLinearGradient(0, 0, 0, 3);
    sill.addColorStop(0, "rgba(60,22,8,0.5)");
    sill.addColorStop(1, "rgba(60,22,8,0)");
    g.fillStyle = sill;
    g.fillRect(0, 0, w, 3);
  };
}
