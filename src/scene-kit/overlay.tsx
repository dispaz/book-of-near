import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Object3D } from "three";

/**
 * HTML that follows points in the 3D scene: handwritten labels and the focusable pick buttons.
 * Components inside the canvas register items here; <Overlay> renders them as normal DOM next to
 * the canvas, and <OverlaySync> moves them every frame.
 */
export type OverlayItem =
  | { kind: "label"; text: string; variant?: "hand" | "small" | "hint" }
  | { kind: "pick"; label: string; pressed: boolean; onPick: () => void };

type Entry = { id: string; item: OverlayItem; anchor: RefObject<Object3D | null> };

export class OverlayStore {
  private entries: Entry[] = [];
  private listeners = new Set<() => void>();
  private els = new Map<string, HTMLElement>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = () => this.entries;

  set(id: string, item: OverlayItem, anchor: RefObject<Object3D | null>) {
    const i = this.entries.findIndex((e) => e.id === id);
    const entry = { id, item, anchor };
    this.entries = i < 0 ? [...this.entries, entry] : this.entries.map((e, k) => (k === i ? entry : e));
    this.listeners.forEach((fn) => fn());
  }
  remove(id: string) {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.els.delete(id);
    this.listeners.forEach((fn) => fn());
  }
  bind(id: string, el: HTMLElement | null) {
    if (el) this.els.set(id, el);
    else this.els.delete(id);
  }

  private v = new Vector3();
  /** Project every anchor to the screen. Called once per frame from inside the canvas. */
  project(camera: Parameters<Vector3["project"]>[0], width: number, height: number) {
    for (const e of this.entries) {
      const el = this.els.get(e.id);
      const obj = e.anchor.current;
      if (!el || !obj) continue;
      obj.getWorldPosition(this.v).project(camera);
      el.style.visibility = this.v.z > 1 ? "hidden" : "visible";
      const x = (this.v.x * 0.5 + 0.5) * width;
      const y = (-this.v.y * 0.5 + 0.5) * height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }
}

export const OverlayContext = createContext<OverlayStore | null>(null);

/** Register an overlay item that follows `anchor` while the calling component is mounted. */
export function useOverlayItem(item: OverlayItem, anchor: RefObject<Object3D | null>) {
  const store = useContext(OverlayContext);
  const id = useId();
  // The pick callback goes through a ref, so a new closure each render does not re-render the overlay.
  const onPick = useRef<() => void>(undefined);
  useLayoutEffect(() => {
    onPick.current = item.kind === "pick" ? item.onPick : undefined;
  });
  const stablePick = useCallback(() => onPick.current?.(), []);
  const key = JSON.stringify(item); // functions drop out, so this changes only when the data changes
  useEffect(() => {
    store?.set(id, item.kind === "pick" ? { ...item, onPick: stablePick } : item, anchor);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `item` is tracked through `key`
  }, [store, id, key, anchor, stablePick]);
  useEffect(() => () => store?.remove(id), [store, id]);
}

/** Inside the canvas: moves overlay items to their anchors every frame. */
export function OverlaySync() {
  const store = useContext(OverlayContext);
  useFrame(({ camera, size }) => store?.project(camera, size.width, size.height));
  return null;
}

/** Outside the canvas: the DOM for labels and pick buttons. */
export function Overlay({ store }: { store: OverlayStore }) {
  const entries = useSyncExternalStore(store.subscribe, store.snapshot);
  return (
    <div className="sk-overlay">
      {entries.map(({ id, item }) => (
        <div key={id} className="sk-anchor" ref={(el) => store.bind(id, el)}>
          {item.kind === "label" ? (
            <div
              className={`sk-label ${item.variant ?? "hand"}`}
              style={{ transform: "translate(-50%, -50%)" }}
            >
              {item.text}
            </div>
          ) : (
            <button type="button" className="sk-pick" aria-pressed={item.pressed} onClick={item.onPick}>
              <span>{item.label}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
