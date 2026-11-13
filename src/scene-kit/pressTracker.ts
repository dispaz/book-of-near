type PointerLike = { pointerId: number; clientX: number; clientY: number };

/**
 * Follows one press of one pointer on `target` (the window, in capture phase) until it is released:
 * `move` gets the furthest distance travelled so far (px), `end` the release or cancel. Returns `stop`,
 * which removes the listeners: call it on release (done for you) and when the object unmounts mid-press.
 */
export function trackPress(
  target: EventTarget,
  start: PointerLike,
  on: { move: (travelPx: number) => void; end: () => void },
): () => void {
  let travel = 0;
  let live = true;
  const move = (e: Event) => {
    const p = e as unknown as PointerLike;
    if (p.pointerId !== start.pointerId) return;
    travel = Math.max(travel, Math.hypot(p.clientX - start.clientX, p.clientY - start.clientY));
    on.move(travel);
  };
  const up = (e: Event) => {
    if ((e as unknown as PointerLike).pointerId !== start.pointerId) return;
    stop();
    on.end();
  };
  const stop = () => {
    if (!live) return;
    live = false;
    target.removeEventListener("pointermove", move, true);
    target.removeEventListener("pointerup", up, true);
    target.removeEventListener("pointercancel", up, true);
  };
  target.addEventListener("pointermove", move, true);
  target.addEventListener("pointerup", up, true);
  target.addEventListener("pointercancel", up, true);
  return stop;
}
