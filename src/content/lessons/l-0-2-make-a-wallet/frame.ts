import { useEffect, useState, type RefObject } from "react";

/** A rectangle in the scene's own coordinates (px from its top-left corner). */
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Box = Pick<DOMRect, "left" | "top" | "right" | "bottom">;

const GAP = 12;
const area = (f: Frame) => Math.max(0, f.w) * Math.max(0, f.h);

/**
 * The biggest free part of the screen that the lesson's title, panel, step card and stage bar leave
 * open. The 3D view centres its picture there, so objects never hide behind the cards.
 * All boxes are relative to the scene (width W, height H).
 */
export function freeFrame(
  W: number,
  H: number,
  parts: { title?: Box; panel?: Box; dock?: Box; bar?: Box },
): Frame {
  const { title, panel, dock, bar } = parts;
  const top = (title ? title.bottom : 0) + GAP;
  const bottom = (bar ? bar.top : H) - GAP;
  const dockTop = dock ? dock.top - GAP : bottom;
  if (panel && panel.left > W / 2) {
    // Wide screens: the panel stands on the right, the step card at the bottom left.
    const right = panel.left - GAP;
    const above: Frame = { x: GAP, y: top, w: right - GAP, h: Math.min(bottom, dockTop) - top };
    const beside: Frame = dock
      ? { x: dock.right + GAP, y: top, w: right - dock.right - GAP, h: bottom - top }
      : above;
    return area(beside) > area(above) ? beside : above;
  }
  // Narrow screens: everything is stacked, so the picture gets the band between panel and step card.
  const t = panel ? Math.max(top, panel.bottom + GAP) : top;
  return { x: GAP, y: t, w: W - 2 * GAP, h: Math.min(bottom, dockTop) - t };
}

/** Watches the lesson's cards and returns the free frame inside `root`. Re-measures when they move. */
export function useFreeFrame(root: RefObject<HTMLElement | null>, deps: unknown[]): Frame | null {
  const [frame, setFrame] = useState<Frame | null>(null);
  useEffect(() => {
    const el = root.current;
    const lesson = el?.closest(".lesson");
    if (!el || !lesson || typeof ResizeObserver === "undefined") return;
    const pick = (sel: string, scope: Element = lesson) => scope.querySelector<HTMLElement>(sel) ?? undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const rel = (e?: HTMLElement): Box | undefined => {
        if (!e) return undefined;
        const b = e.getBoundingClientRect();
        return {
          left: b.left - r.left,
          right: b.right - r.left,
          top: b.top - r.top,
          bottom: b.bottom - r.top,
        };
      };
      const title = rel(pick(".lesson-title"));
      const tools = rel(pick(".lesson-tools"));
      const head = rel(pick(".step-head"));
      const bottom = Math.max(title?.bottom ?? 0, tools?.bottom ?? 0, head?.bottom ?? 0);
      const next = freeFrame(r.width, r.height, {
        title: title ? { ...title, bottom } : title,
        panel: rel(pick(".lesson-panel", el)),
        dock: rel(pick(".lesson-dock")),
        bar: rel(pick(".stage-bar")),
      });
      setFrame((prev) =>
        prev &&
        ["x", "y", "w", "h"].every((k) => Math.abs(prev[k as keyof Frame] - next[k as keyof Frame]) < 1)
          ? prev
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const e of [
      el,
      pick(".lesson-panel", el),
      pick(".lesson-dock"),
      pick(".lesson-tools"),
      pick(".step-head"),
    ])
      if (e) ro.observe(e);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure when the caller's step or view changes
  }, [root, ...deps]);
  return frame;
}
