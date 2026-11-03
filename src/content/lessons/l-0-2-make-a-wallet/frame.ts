import { useEffect, useState, type RefObject } from "react";
import type { Frame } from "../../../scene-kit/framing";
import { NOTE_MARGIN_RIGHT } from "../../../ui/StepNote";

type Box = Pick<DOMRect, "left" | "top" | "right" | "bottom">;

const GAP = 12;
/** On wide screens the left page margin holds the step's note (StepNote), so the picture starts after it. */
const NOTE_MARGIN = NOTE_MARGIN_RIGHT + 24;

/** The narrowest picture worth drawing between the note margin and the panel. */
const MIN_PAGE = 300;

type Parts = { head?: Box; panel?: Box; dock?: Box; bar?: Box };

/** Where the picture starts on wide screens: right of the note margin (or the docked card). */
const pageLeft = (dock?: Box) => Math.max(dock ? dock.right : 0, NOTE_MARGIN) + 24;

/**
 * Whether the page between the note margin and the panel is wide enough for the picture. If not
 * (tablets), the step's note stays docked and the picture takes the left column instead.
 */
export function hasNoteRoom(W: number, { panel, dock }: Parts): boolean {
  if (!panel || panel.left <= W / 2) return true;
  return panel.left - 24 - pageLeft(dock) >= MIN_PAGE;
}

/**
 * The free part of the screen that the lesson's header (title, pills, step heading), the panel, the
 * docked controls and the stage bar leave open. The 3D view fits its picture there, so objects never
 * hide behind the cards or the note. All boxes are relative to the scene (width W, height H).
 */
export function freeFrame(W: number, H: number, parts: Parts): Frame {
  const { head, panel, dock, bar } = parts;
  const top = (head ? head.bottom : 0) + GAP;
  const bottom = (bar ? bar.top : H) - GAP;
  if (panel && panel.left > W / 2) {
    if (!hasNoteRoom(W, parts))
      // Tablets: the note docks bottom left, so the picture gets the column above it.
      return { left: GAP, top, right: panel.left - 24, bottom: dock ? dock.top - GAP : bottom };
    // Wide screens: the note margin on the left, the panel on the right, the page in between.
    const left = pageLeft(dock);
    return { left, top, right: Math.max(left + 80, panel.left - 24), bottom };
  }
  // Narrow screens: everything is stacked, so the picture gets the band between panel and step card.
  const t = panel ? Math.max(top, panel.bottom + GAP) : top;
  return { left: GAP, top: t, right: W - GAP, bottom: Math.min(bottom, dock ? dock.top - GAP : bottom) };
}

/** The free frame inside a scene of `width` x `height` pixels. */
export interface Measured {
  frame: Frame;
  width: number;
  height: number;
  /** Room for the step note in the left margin beside the picture (see hasNoteRoom). */
  noteRoom: boolean;
}

/** Watches the lesson's cards and returns the free frame inside `root`. Re-measures when they move. */
export function useFreeFrame(root: RefObject<HTMLElement | null>, deps: unknown[]): Measured | null {
  const [frame, setFrame] = useState<Measured | null>(null);
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
      const bottom = Math.max(
        ...[".lesson-title", ".lesson-tools", ".step-head"].map((sel) => rel(pick(sel))?.bottom ?? 0),
      );
      const parts = {
        head: { left: 0, top: 0, right: r.width, bottom },
        panel: rel(pick(".lesson-panel", el)),
        dock: rel(pick(".lesson-dock")),
        bar: rel(pick(".stage-bar")),
      };
      const f = freeFrame(r.width, r.height, parts);
      const noteRoom = hasNoteRoom(r.width, parts);
      setFrame((prev) =>
        prev &&
        prev.noteRoom === noteRoom &&
        Math.abs(prev.width - r.width) < 1 &&
        Math.abs(prev.height - r.height) < 1 &&
        (["left", "top", "right", "bottom"] as const).every((k) => Math.abs(prev.frame[k] - f[k]) < 1)
          ? prev
          : { frame: f, width: r.width, height: r.height, noteRoom },
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
