import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const GAP = 56;
const W = 380;

const area = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

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
 * Where the note goes. With a `margin` column (the page margin the scene keeps free) and the element to
 * its right, the note sits in the margin level with the element, so it never covers the scene. Otherwise
 * beside the element, on the side with room, clear of the dock. Exported for tests.
 */
export function placeNote(
  anchor: Rect,
  size: { w: number; h: number },
  free: Rect,
  avoid: Rect[],
  margin?: Rect,
) {
  const { w, h } = size;
  const ax = (anchor.left + anchor.right) / 2;
  const ay = (anchor.top + anchor.bottom) / 2;
  if (margin && fitsMargin(anchor, size, margin)) {
    const x = margin.left;
    const y = Math.min(margin.bottom - h, Math.max(margin.top, ay - h / 2));
    return arrowFor(anchor, { left: x, top: y, right: x + w, bottom: y + h });
  }
  const tries: [number, number][] = [
    [anchor.right + GAP, ay - h / 2],
    [anchor.left - GAP - w, ay - h / 2],
    [ax - w / 2, anchor.bottom + GAP],
    [ax - w / 2, anchor.top - GAP - h],
    [anchor.right + GAP, anchor.bottom + GAP / 2],
    [anchor.left - GAP - w, anchor.bottom + GAP / 2],
    [anchor.right + GAP, anchor.top - GAP / 2 - h],
    [anchor.left - GAP - w, anchor.top - GAP / 2 - h],
  ];
  const pad = {
    left: anchor.left - 10,
    top: anchor.top - 10,
    right: anchor.right + 10,
    bottom: anchor.bottom + 10,
  };
  let best: { x: number; y: number; cost: number } | null = null;
  tries.forEach(([x0, y0], i) => {
    const x = Math.min(free.right - w, Math.max(free.left, x0));
    const y = Math.min(free.bottom - h, Math.max(free.top, y0));
    const r = { left: x, top: y, right: x + w, bottom: y + h };
    // Covering the element is worst, then the dock; a small bias keeps the preferred order.
    const cost = area(r, pad) * 4 + avoid.reduce((s, a) => s + area(r, a), 0) + i;
    if (!best || cost < best.cost) best = { x, y, cost };
  });
  const { x, y } = best!;
  return arrowFor(anchor, { left: x, top: y, right: x + w, bottom: y + h });
}

/** The note at `card` and a hand-drawn arrow from it to the element. */
function arrowFor(anchor: Rect, card: Rect) {
  const pad = {
    left: anchor.left - 10,
    top: anchor.top - 10,
    right: anchor.right + 10,
    bottom: anchor.bottom + 10,
  };
  const x = card.left;
  const y = card.top;
  const w = card.right - card.left;
  const h = card.bottom - card.top;
  const [ex, ey] = edgePoint(pad, x + w / 2, y + h / 2);
  const [sx, sy] = edgePoint(card, ex, ey);
  // An arc that bows upwards, like a hand-drawn arrow, so it tends to pass over the objects in between.
  const len = Math.hypot(ex - sx, ey - sy);
  const mx = (sx + ex) / 2;
  const my = Math.min(sy, ey) - len * 0.12;
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
 * The explanation of the current step. On wide screens with `anchor`, a note beside that scene element
 * with an arrow to it (it follows the element as the 3D camera moves); the learner can fold it into a
 * small button. Otherwise (phones, no anchor, element not drawn) it renders in place: the dock.
 */
export function StepNote({
  text,
  anchor,
  layer,
  wide,
  children,
}: {
  text: string;
  anchor?: string;
  /** The lesson root: where the note looks for the element and draws itself. */
  layer: HTMLElement | null;
  wide: boolean;
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
      const free: Rect = {
        left: 16,
        top: num("--head-h", 110),
        right: L.width - 16,
        bottom: L.height - num("--bar-h", 56) - 32,
      };
      const dock = layer.querySelector(".action-slot:not(:empty)");
      const avoid = dock ? [rel(dock.getBoundingClientRect())] : [];
      // The left margin of the page, above the scene's own controls (the action slot).
      const margin: Rect = {
        left: 16,
        top: free.top,
        right: 16 + (c.offsetWidth || W),
        bottom: (dock ? rel(dock.getBoundingClientRect()).top : free.bottom) - 14,
      };
      const size = { w: c.offsetWidth || W, h: c.offsetHeight || 120 };
      // The note lives in the margin or in the dock, never on top of the page. If the element is not
      // right of the margin (or the margin is too short), treat it like a missing element: dock.
      if (!fitsMargin(rel(a), size, margin)) {
        if (++misses > 20 && last !== "none") {
          last = "none";
          setGeo(null);
        }
        return;
      }
      const g = placeNote(rel(a), size, free, avoid, margin);
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
      <div className="note docked">
        {body}
        {children}
      </div>
    );
  }
  return (
    <>
      {geo === null ? (
        // Not placed yet (or the element is missing): show it in the dock meanwhile.
        <div className="note docked">
          {body}
          {children}
        </div>
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
