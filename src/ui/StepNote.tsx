import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
interface Geo {
  x: number;
  y: number;
  /** The arrow from the note to the element: start, bend and end, in lesson coordinates. */
  path: string;
  head: string;
  tip: [number, number];
}

/** The floating note's width (`.note.floating` in ink.css) and its distance from the page's left edge. */
const W = 380;
const LEFT = 16;
/** Where the note margin ends on wide screens. Scenes start their picture right of it. */
export const NOTE_MARGIN_RIGHT = LEFT + W;

/** The point on a rectangle's border nearest to (x, y). */
function edgePoint(r: Rect, x: number, y: number): [number, number] {
  const cx = Math.min(r.right, Math.max(r.left, x));
  const cy = Math.min(r.bottom, Math.max(r.top, y));
  if (cx !== x || cy !== y) return [cx, cy];
  // Inside: go to the nearest side.
  const d = [x - r.left, r.right - x, y - r.top, r.bottom - y];
  const m = Math.min(...d);
  if (m === d[0]) return [r.left, y];
  if (m === d[1]) return [r.right, y];
  if (m === d[2]) return [x, r.top];
  return [x, r.bottom];
}

/** Whether the note can sit in the `margin` column beside the element (the element is right of it). */
export function fitsMargin(anchor: Rect, size: { w: number; h: number }, margin: Rect): boolean {
  return anchor.left > margin.right + 24 && margin.bottom - margin.top >= size.h;
}

/**
 * Where the note goes: in the `margin` column (the page margin the scene keeps free), level with the
 * element, so it never covers the scene. Call it only when `fitsMargin` holds; otherwise the note docks.
 * Exported for tests.
 */
export function placeNote(anchor: Rect, size: { w: number; h: number }, margin: Rect, blocked?: Blocked) {
  const { w, h } = size;
  const ay = (anchor.top + anchor.bottom) / 2;
  const x = margin.left;
  const y = Math.min(margin.bottom - h, Math.max(margin.top, ay - h / 2));
  return arrowFor(anchor, { left: x, top: y, right: x + w, bottom: y + h }, blocked);
}

/** Whether a point (lesson coordinates) is on something the arrow should not cross: a card, a label. */
export type Blocked = (x: number, y: number) => boolean;

/** How far an arc bows (a share of its length): up first, then more, then down. */
const BOWS = [0.12, 0.3, 0.55, 0.8, -0.3, -0.55];

/**
 * The note at `card` and a hand-drawn arrow from it to the element. The arrow is an arc that bows
 * upwards, like a hand-drawn one. With `blocked`, it tries a few arcs (bowing more, or downwards, or
 * landing on the element's top or bottom) and takes the one that crosses the fewest cards and labels;
 * the gentle default wins every tie. Exported for tests.
 */
export function arrowFor(anchor: Rect, card: Rect, blocked?: Blocked) {
  const pad = {
    left: anchor.left - 10,
    top: anchor.top - 10,
    right: anchor.right + 10,
    bottom: anchor.bottom + 10,
  };
  const x = card.left;
  const y = card.top;
  const cx = (card.left + card.right) / 2;
  const cy = (card.top + card.bottom) / 2;
  const midX = (pad.left + pad.right) / 2;
  const ends: [number, number][] = [edgePoint(pad, cx, cy), [midX, pad.top], [midX, pad.bottom]];
  const arc = ([ex, ey]: [number, number], bow: number) => {
    const [sx, sy] = edgePoint(card, ex, ey);
    const len = Math.hypot(ex - sx, ey - sy);
    const mx = (sx + ex) / 2;
    const my = bow >= 0 ? Math.min(sy, ey) - len * bow : Math.max(sy, ey) - len * bow;
    return { sx, sy, mx, my, ex, ey };
  };
  type Arc = ReturnType<typeof arc>;
  const cost = (a: Arc, isBlocked: Blocked) => {
    // The share of the arc (outside the note and the element) that lies on something.
    let n = 0;
    let seen = 0;
    for (let i = 1; i < 24; i++) {
      const t = i / 24;
      const u = 1 - t;
      const px = u * u * a.sx + 2 * u * t * a.mx + t * t * a.ex;
      const py = u * u * a.sy + 2 * u * t * a.my + t * t * a.ey;
      const inside = (r: Rect) => px > r.left && px < r.right && py > r.top && py < r.bottom;
      if (inside(card) || inside(pad)) continue;
      seen++;
      if (py < 0 || isBlocked(px, py)) n++;
    }
    return seen ? n / seen : 0;
  };
  let best = arc(ends[0]!, BOWS[0]!);
  if (blocked) {
    let least = cost(best, blocked);
    for (const end of ends) {
      for (const bow of BOWS) {
        if (least === 0) break;
        if (end === ends[0] && bow === BOWS[0]) continue; // the default, already costed
        const a = arc(end, bow);
        const c = cost(a, blocked);
        if (c < least) {
          least = c;
          best = a;
        }
      }
    }
  }
  const { sx, sy, mx, my, ex, ey } = best;
  const ang = Math.atan2(ey - my, ex - mx);
  const p = (a: number) => `${ex - 12 * Math.cos(ang + a)},${ey - 12 * Math.sin(ang + a)}`;
  return {
    x,
    y,
    path: `M${sx},${sy} Q${mx},${my} ${ex},${ey}`,
    head: `M${p(0.45)} L${ex},${ey} L${p(-0.45)}`,
    tip: [ex, ey] as [number, number],
  };
}

/**
 * Whether the arrow should go around this element: a card or label (it has a border or its own text),
 * a control, or a small shape or text in an SVG drawing. Page backgrounds, bands and the 3D canvas are
 * open space.
 */
function isContent(el: Element): boolean {
  if (el instanceof SVGElement) {
    if (el.tagName === "svg") return false;
    if (el.tagName === "text" || el.tagName === "tspan") return true;
    const svg = el.ownerSVGElement?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return !!svg && r.width * r.height < (svg.width * svg.height) / 4;
  }
  if (el.closest(".step-head, .lesson-tools, .stage-bar, .lesson-dock")) return true;
  if (/^(CANVAS|HTML|BODY|MAIN)$/.test(el.tagName)) return false;
  if (/^(BUTTON|INPUT|SELECT|TEXTAREA|IMG|CODE)$/.test(el.tagName)) return true;
  for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) return true;
  const css = getComputedStyle(el);
  return Number.parseFloat(css.borderTopWidth) > 0 || Number.parseFloat(css.borderLeftWidth) > 0;
}

/**
 * The explanation of the current step. On wide screens with `anchor`, a note beside that scene element
 * with an arrow to it (it follows the element as the 3D camera moves); the learner can fold it into a
 * small button. Otherwise (phones, no anchor, element not drawn) it renders in place: the dock.
 */
export function StepNote({
  text,
  anchor,
  layer,
  wide,
  compact = false,
  children,
}: {
  text: string;
  anchor?: string;
  /** The lesson root: where the note looks for the element and draws itself. */
  layer: HTMLElement | null;
  wide: boolean;
  /** Phones: the docked note shows two lines and opens over the scene on demand (see DockedNote). */
  compact?: boolean;
  /** Extra content under the text (only in the docked note). */
  children?: React.ReactNode;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [folded, setFolded] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const floating = wide && !!anchor && !!layer;
  useEffect(() => setFolded(false), [text]);

  useLayoutEffect(() => {
    if (!floating || !layer) {
      setGeo(null);
      return;
    }
    let raf = 0;
    let last = "";
    let placed = "";
    let idle = 0;
    let misses = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = layer.querySelector(`[data-explain="${anchor}"]`);
      const c = card.current;
      const a = el?.getBoundingClientRect();
      // A scene without room for margin notes at this size marks itself data-notes="dock"; an element
      // hidden by CSS has no size. Both keep the note in the dock.
      const hidden = !a || (a.width === 0 && a.height === 0);
      if (hidden || !c || layer.querySelector('[data-notes="dock"]')) {
        // Give the scene a moment to draw the element; then fall back to the dock.
        if (++misses > 20 && last !== "none") {
          last = "none";
          placed = "";
          setGeo(null);
        }
        return;
      }
      misses = 0;
      const L = layer.getBoundingClientRect();
      const rel = (r: DOMRect): Rect => ({
        left: r.left - L.left,
        top: r.top - L.top,
        right: r.right - L.left,
        bottom: r.bottom - L.top,
      });
      const css = getComputedStyle(layer);
      const num = (v: string, d: number) => Number.parseFloat(css.getPropertyValue(v)) || d;
      const dock = layer.querySelector(".action-slot:not(:empty)");
      // The left margin of the page, under the header and above the scene's own controls (the action
      // slot) or the stage bar.
      const margin: Rect = {
        left: LEFT,
        top: num("--head-h", 110),
        right: LEFT + (c.offsetWidth || W),
        bottom:
          (dock
            ? rel(dock.getBoundingClientRect()).top
            : L.height - (2 * num("--bar-gap", 16) + num("--bar-h", 56))) - 14,
      };
      const size = { w: c.offsetWidth || W, h: c.offsetHeight || 120 };
      // The note lives in the margin or in the dock, never on top of the page. If the element is not
      // right of the margin (or the margin is too short), treat it like a missing element: dock.
      if (!fitsMargin(rel(a), size, margin)) {
        if (++misses > 20 && last !== "none") {
          last = "none";
          placed = "";
          setGeo(null);
        }
        return;
      }
      // Route the arrow when the element, the note or the page moved, and twice a second for cards
      // that appear around it (routing probes the page, so not on every frame).
      const ar = rel(a);
      const where = [ar.left, ar.top, ar.right, ar.bottom, size.w, size.h, margin.top, margin.bottom, L.width]
        .map(Math.round)
        .join(",");
      if (where === placed && ++idle < 30) return;
      placed = where;
      idle = 0;
      // The scene's other marked elements are things too: a 3D scene marks its objects with small
      // anchors (the canvas itself reads as open space), so give a small mark the size of an object.
      const others = [...layer.querySelectorAll("[data-explain]")]
        .filter((o) => o !== el && !o.contains(el!) && !el!.contains(o))
        .map((o) => {
          const r = rel(o.getBoundingClientRect());
          const grow = r.right - r.left < 30 && r.bottom - r.top < 30 ? 36 : 0;
          return { left: r.left - grow, top: r.top - grow, right: r.right + grow, bottom: r.bottom + grow };
        })
        .filter((r) => r.right > r.left);
      const blocked: Blocked = (x, y) => {
        if (others.some((r) => x > r.left && x < r.right && y > r.top && y < r.bottom)) return true;
        const hit = document.elementFromPoint(x + L.left, y + L.top);
        return !!hit && !el!.contains(hit) && !c.contains(hit) && isContent(hit);
      };
      const g = placeNote(ar, size, margin, blocked);
      const key = `${Math.round(g.x)},${Math.round(g.y)},${g.path}`;
      if (key !== last) {
        last = key;
        setGeo(g);
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [floating, layer, anchor, text]);

  const body = (
    <p className="note-text" data-testid="explain">
      {text}
    </p>
  );
  if (!floating) {
    return (
      <DockedNote body={body} compact={compact}>
        {children}
      </DockedNote>
    );
  }
  return (
    <>
      {geo === null ? (
        // Not placed yet (or the element is missing): show it in the dock meanwhile.
        <DockedNote body={body} compact={compact}>
          {children}
        </DockedNote>
      ) : (
        children
      )}
      {createPortal(
        <div className="note-layer" aria-hidden={geo === null || folded ? true : undefined}>
          {geo && !folded ? (
            <svg className="note-arrow" aria-hidden="true">
              <path className="halo" d={geo.path} />
              <path d={geo.path} />
              <path d={geo.head} />
              <circle className="tip" cx={geo.tip[0]} cy={geo.tip[1]} r={16} />
            </svg>
          ) : null}
          <div
            ref={card}
            className={`note floating${folded ? " folded" : ""}`}
            style={{
              left: geo?.x ?? -9999,
              top: geo?.y ?? 0,
              visibility: geo ? "visible" : "hidden",
            }}
          >
            {folded ? (
              <button className="note-open" onClick={() => setFolded(false)} aria-label="Show the note">
                ✎
              </button>
            ) : (
              <>
                <button className="note-fold" onClick={() => setFolded(true)} aria-label="Fold the note away">
                  –
                </button>
                {geo ? body : null}
              </>
            )}
          </div>
        </div>,
        layer,
      )}
    </>
  );
}

/**
 * The note in the dock. On phones (`compact`) the dock must not eat the scene, so the text shows two
 * lines and a "Read more" button. Opened, the note lies over the scene like a sheet, growing upwards from
 * the same spot: the dock keeps its folded height, so the scene does not jump or reframe.
 */
function DockedNote({
  body,
  compact,
  children,
}: {
  body: React.ReactNode;
  compact: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const [foldedH, setFoldedH] = useState<number | null>(null);
  const [sheet, setSheet] = useState<CSSProperties | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const less = useRef<HTMLButtonElement>(null);
  // Whether focus goes back to "Read more" once the note folds (not after a tap elsewhere).
  const refocus = useRef(false);
  const id = useId();
  // Only offer "Read more" when the folded text is actually cut.
  useLayoutEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(".note-text");
    if (!compact || open || !el) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, open]);

  const close = useCallback((restoreFocus: boolean) => {
    refocus.current = restoreFocus;
    setOpen(false);
  }, []);

  // Open: the sheet sits above the step's controls (they stay usable), below the step heading and inside
  // the lesson page. Escape or a tap outside folds it.
  useLayoutEffect(() => {
    if (!open) {
      setSheet(null);
      if (refocus.current) more.current?.focus();
      refocus.current = false;
      return;
    }
    less.current?.focus();
    const place = () => {
      const w = wrap.current;
      const lesson = w?.closest(".lesson");
      if (!w || !lesson) return;
      const W = w.getBoundingClientRect();
      const L = lesson.getBoundingClientRect();
      const head = lesson.querySelector(".step-head")?.getBoundingClientRect();
      const slot = lesson.querySelector(".action-slot");
      const S = slot && slot.childElementCount > 0 ? slot.getBoundingClientRect() : null;
      const floor = Math.min(S && S.top < W.top ? S.top - 8 : W.bottom, L.bottom - 8);
      const ceiling = Math.max(head ? head.bottom + 8 : 0, L.top + 8);
      setSheet({ bottom: W.bottom - floor, maxHeight: Math.max(80, floor - ceiling) });
    };
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close(false);
    };
    window.addEventListener("resize", place);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  if (!compact) {
    return (
      <div className="note docked">
        {body}
        {children}
      </div>
    );
  }
  return (
    <div ref={wrap} className="note-wrap" style={open && foldedH ? { height: foldedH } : undefined}>
      <div
        ref={box}
        id={id}
        className={`note docked compact${open ? " open" : ""}`}
        style={open && sheet ? sheet : undefined}
      >
        {open ? (
          // At the top of the sheet, so it folds without scrolling to the end.
          <button
            ref={less}
            type="button"
            className="note-more"
            aria-expanded="true"
            aria-controls={id}
            onClick={() => close(true)}
          >
            Show less
          </button>
        ) : null}
        <div className="note-clip">
          {body}
          {long && !open ? (
            <button
              ref={more}
              type="button"
              className="note-more"
              aria-expanded="false"
              aria-controls={id}
              onClick={() => {
                setFoldedH(box.current?.getBoundingClientRect().height ?? null);
                setOpen(true);
              }}
            >
              Read more
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
