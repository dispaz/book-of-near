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
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Object3D } from "three";
import type { PickNote } from "./reaction";

/**
 * HTML that follows points in the 3D scene: handwritten labels and the focusable pick buttons.
 * Components inside the canvas register items here; <Overlay> renders them as normal DOM next to
 * the canvas, and <OverlaySync> moves them every frame.
 */
export type OverlayItem =
  | { kind: "label"; text: string; variant?: "hand" | "small" | "hint" }
  | {
      kind: "pick";
      label: string;
      pressed: boolean;
      onPick: () => void;
      /** Keyboard focus on the button counts as hovering the object (rule 10a). */
      onHover?: (on: boolean) => void;
      /** Test hooks and the note bubble (Pickable, rule 10a). */
      hover?: boolean;
      playing?: boolean;
      note?: PickNote | null;
    };

type Entry = { id: string; item: OverlayItem; anchor: RefObject<Object3D | null> };

export class OverlayStore {
  private entries: Entry[] = [];
  private listeners = new Set<() => void>();
  private els = new Map<string, HTMLElement>();
  /** Set by OverlaySync: asks the canvas for a frame (it draws on demand), so a new item is placed. */
  requestFrame: () => void = () => undefined;

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
    this.requestFrame();
  }
  remove(id: string) {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.els.delete(id);
    this.listeners.forEach((fn) => fn());
  }
  bind(id: string, el: HTMLElement | null) {
    if (el) {
      this.els.set(id, el);
      this.requestFrame();
    } else this.els.delete(id);
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
  // The callbacks go through a ref, so a new closure each render does not re-render the overlay.
  const calls = useRef<{ onPick?: () => void; onHover?: (on: boolean) => void }>({});
  useLayoutEffect(() => {
    calls.current = item.kind === "pick" ? { onPick: item.onPick, onHover: item.onHover } : {};
  });
  const stablePick = useCallback(() => calls.current.onPick?.(), []);
  const stableHover = useCallback((on: boolean) => calls.current.onHover?.(on), []);
  const key = JSON.stringify(item); // functions drop out, so this changes only when the data changes
  useEffect(() => {
    store?.set(
      id,
      item.kind === "pick" ? { ...item, onPick: stablePick, onHover: stableHover } : item,
      anchor,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `item` is tracked through `key`
  }, [store, id, key, anchor, stablePick, stableHover]);
  useEffect(() => () => store?.remove(id), [store, id]);
}

/** Inside the canvas: moves overlay items to their anchors every frame. */
export function OverlaySync() {
  const store = useContext(OverlayContext);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!store) return;
    store.requestFrame = () => invalidate();
    return () => {
      store.requestFrame = () => undefined;
    };
  }, [store, invalidate]);
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
            <>
              <button
                type="button"
                className="sk-pick"
                aria-pressed={item.pressed}
                onClick={item.onPick}
                onFocus={() => item.onHover?.(true)}
                onBlur={() => item.onHover?.(false)}
                data-hover={item.hover ? "on" : "off"}
                data-pick={item.playing ? "playing" : "idle"}
                data-hint={item.note?.kind === "hint" ? item.note.text : undefined}
                data-detail={item.note?.kind === "detail" ? item.note.text : undefined}
                aria-describedby={`${id}-note`}
              >
                <span>{item.label}</span>
              </button>
              {/* Always mounted and empty until a pick: a live region that appears already filled may
                  not be read out, so only its text changes. */}
              <p
                id={`${id}-note`}
                className={`sk-pick-note${item.note ? ` ${item.note.kind}` : ""}`}
                role="status"
                aria-live="polite"
              >
                {item.note?.text ?? ""}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
