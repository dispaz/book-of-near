import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { TextBlock } from "./book";
import { homography, matrix3d, type Quad } from "./homography";

const STYLES = ["transform", "width", "height", "--print-k"] as const;
/** Pixels a corner may stick out of the canvas and still count as on screen. */
const SLACK = 4;

/**
 * Prints an HTML element on the book's page: while `place` is on, every frame `el` is transformed (CSS
 * matrix3d) so its box lands exactly on the rectangle `block` of the page (y = 0), and follows the page
 * when the camera moves or the learner orbits. The element stays real HTML: readable, selectable,
 * focusable and clickable. It must be positioned at the top left of the canvas (`position: absolute;
 * left: 0; top: 0`) with `transform-origin: 0 0`. Its CSS size is set to the block's size on screen, so
 * type prints at about 1:1; when its words overflow, `--print-k` (1 down to 0.72) shrinks them a little.
 *
 * `onInView` reports whether the whole block is on screen. When it is not (a close-up, the learner
 * orbiting away), the caller should stop placing the words there and lay them out normally, so the
 * step's text and controls are never lost.
 */
export function PrintOnPage({
  block,
  el,
  place,
  onInView,
  minWidth = 340,
}: {
  block: TextBlock;
  el: HTMLElement | null;
  place: boolean;
  onInView: (inView: boolean) => void;
  minWidth?: number;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new Vector3(), []);
  const st = useRef({ w: 0, h: 0, k: 1, n: 0, inView: null as boolean | null });
  // Not placing (or gone): give the element back its normal layout.
  useEffect(() => {
    if (!el || place) return;
    for (const p of STYLES) el.style.removeProperty(p);
    st.current.w = 0;
  }, [el, place]);
  useEffect(
    () => () => {
      if (el) for (const p of STYLES) el.style.removeProperty(p);
    },
    [el],
  );
  useFrame(() => {
    const s = st.current;
    const proj = (x: number, z: number): [number, number] | null => {
      v.set(x, 0, z).project(camera);
      if (v.z > 1 || v.z < -1) return null;
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
    };
    const { x0, x1, z0, z1 } = block;
    const q = [proj(x0, z0), proj(x1, z0), proj(x1, z1), proj(x0, z1)];
    const inView = q.every(
      (p) =>
        !!p && p[0] >= -SLACK && p[0] <= size.width + SLACK && p[1] >= -SLACK && p[1] <= size.height + SLACK,
    );
    if (inView !== s.inView) {
      s.inView = inView;
      onInView(inView);
    }
    if (!el || !place || q.some((p) => !p)) return;
    if (s.n++ % 12 === 0 || !s.w) {
      // As many CSS pixels wide as the block is across its middle on screen.
      const zm = (z0 + z1) / 2;
      const a = proj(x0, zm)!;
      const b = proj(x1, zm)!;
      const w = Math.max(minWidth, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
      if (!s.w || Math.abs(w - s.w) / s.w > 0.05) {
        s.w = w;
        s.h = Math.round((w * (z1 - z0)) / (x1 - x0));
        el.style.width = `${s.w}px`;
        el.style.height = `${s.h}px`;
      }
      // Fit the words: a little smaller when they overflow, back up when there is room again.
      if (el.scrollHeight > el.clientHeight + 2 && s.k > 0.72) s.k = +(s.k - 0.04).toFixed(2);
      else if (el.scrollHeight < el.clientHeight * 0.82 && s.k < 1) s.k = +(s.k + 0.04).toFixed(2);
      el.style.setProperty("--print-k", String(s.k));
    }
    el.style.transform = matrix3d(homography(s.w, s.h, q as Quad));
  });
  return null;
}
