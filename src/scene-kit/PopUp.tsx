import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { REVEAL } from "./materials";
import { popState, POP_DONE, type PopFrame, type PopKind } from "./pop";

/** The pop-up book's current frame (figure height, fill, turning page), updated every frame. */
export const PopContext = createContext<RefObject<PopFrame>>({ current: POP_DONE });
export const usePop = () => useContext(PopContext);

/**
 * Runs the pop-up book (see pop.ts): when `page` changes the page turns and the figure pops up again;
 * `grow` pops it up once on mount without a turn. Writes the phase to `wrap`'s `data-pop` for CSS:
 * "turn" (page turning), "rise" (outlines rising), "fill" (hatching in), none when done.
 */
export function usePopDriver({
  page,
  grow,
  reducedMotion,
  wrap,
}: {
  page: unknown;
  grow: boolean;
  reducedMotion: boolean;
  wrap: RefObject<HTMLElement | null>;
}) {
  const frame = useRef<PopFrame>(grow && !reducedMotion ? popState(0, "grow") : POP_DONE);
  const run = useRef<{ kind: PopKind; t0: number | null } | null>(
    grow && !reducedMotion ? { kind: "grow", t0: null } : null,
  );
  // Compare with the page last seen (not "skip the first run"): effects may run twice on mount.
  const shown = useRef(page);
  useLayoutEffect(() => {
    if (Object.is(shown.current, page)) return;
    shown.current = page;
    if (!reducedMotion) run.current = { kind: "turn", t0: null };
  }, [page, reducedMotion]);
  useEffect(
    () => () => {
      REVEAL.value = 1;
    },
    [],
  );
  const phase = useRef<string | null>(null);
  const tick = (now: number) => {
    const r = run.current;
    let next = POP_DONE;
    if (r && !reducedMotion) {
      r.t0 ??= now;
      next = popState(now - r.t0, r.kind);
      if (next.done) run.current = null;
    }
    frame.current = next;
    // REVEAL is shared by every ink material, but each canvas runs its frame callbacks and then renders
    // before the next canvas does (R3F's loop), so writing it EVERY frame, first (priority -1), keeps
    // two stages from showing each other's fill. Do not skip the write when the value is unchanged.
    REVEAL.value = next.reveal;
    const p = next.phase;
    if (p !== phase.current) {
      phase.current = p;
      if (p) wrap.current?.setAttribute("data-pop", p);
      else wrap.current?.removeAttribute("data-pop");
    }
  };
  return { frame, tick };
}

/** Inside the canvas: advances the pop-up driver once per frame. */
export function PopClock({ tick }: { tick: (now: number) => void }) {
  useFrame(({ clock }) => tick(clock.elapsedTime), -1);
  return null;
}

/** The figure: pressed flat while the page turns, then popping up to full height. */
export function PopGroup({ children }: { children: ReactNode }) {
  const pop = usePop();
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.scale.y = pop.current.scale;
  }, [pop]);
  useFrame(() => {
    if (ref.current) ref.current.scale.y = pop.current.scale;
  });
  return <group ref={ref}>{children}</group>;
}
