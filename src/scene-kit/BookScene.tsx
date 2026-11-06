/**
 * The book scene standard (docs/book-scene.md): a lesson's 3D view as a living pop-up book. The figure
 * stands on the right page, wide screens print the step on the left page, each step turns the page and
 * the play button in the stage bar runs a captioned camera tour. A lesson supplies only its figure, its
 * spread, its framing and its tour; everything else lives here.
 */
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { SpreadContext } from "../app/intro";
import { BarSlot } from "../ui/StageBar";
import { BookBackdrop } from "./BookBackdrop";
import type { Spread, TextBlock } from "./book";
import {
  activeCursor,
  folios,
  freeFrame,
  nextShot,
  readingShot,
  SHOT_SECONDS,
  toggleTour,
  type Chrome,
  type FreeFrame,
  type Shot,
  type TourCursor,
} from "./bookLayout";
import { frameCamera, type Focus, type Frame } from "./framing";
import { InkStage, type InkStageProps } from "./InkStage";
import { PrintOnPage } from "./PrintOnPage";
import { ViewOffset } from "./ViewOffset";

// ---------- the camera tour ----------

export interface Tour<T> {
  shots: Shot<T>[];
  /** The shot the camera is on, or null when no tour runs (the reading shot). */
  shot: Shot<T> | null;
  playing: boolean;
  toggle: () => void;
}

/**
 * The play button's camera tour of the current figure: each shot holds a few seconds, then the camera
 * returns to the reading shot. Pause holds the shot. A new page (step) ends the tour. The tour only
 * moves the camera; it never acts for the learner.
 */
export function useTour<T>(shots: Shot<T>[], page: number | string): Tour<T> {
  const [cursor, setCursor] = useState<TourCursor | null>(null);
  const count = shots.length;
  const active = activeCursor(cursor, page, count);
  useEffect(() => {
    if (!active?.playing) return;
    const id = setTimeout(() => setCursor((c) => (c ? nextShot(c, count) : null)), SHOT_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [active, count]);
  return {
    shots,
    shot: active ? shots[active.i]! : null,
    playing: !!active?.playing,
    toggle: () => setCursor(toggleTour(active, page)),
  };
}

/** Play / pause and the caption of the current shot, in the stage bar (`BarSlot`). */
export function TourControls<T>({ tour, idle }: { tour: Tour<T>; idle: string }) {
  const slot = useContext(BarSlot);
  if (!slot || !tour.shots.length) return null;
  return createPortal(
    <div className="tour" role="group" aria-label="Tour of the figure">
      <button
        type="button"
        className="tour-play"
        aria-label={tour.playing ? "Pause the tour" : "Play the tour"}
        onClick={tour.toggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {tour.playing ? <path d="M8 5v14M16 5v14" /> : <path className="fill" d="M8 5.5 19 12 8 18.5z" />}
        </svg>
      </button>
      <p className="tour-caption" aria-live="polite" data-testid="tour-caption">
        {tour.shot?.caption ?? idle}
      </p>
    </div>,
    slot,
  );
}

// ---------- the free part of the canvas ----------

const CHROME = [".lesson-title", ".step-head", ".lesson-dock", ".stage-bar", ".lesson-panel"];

export interface FreeFrameState extends Omit<FreeFrame, "vars"> {
  size: { width: number; height: number };
}

/**
 * Measures the free part of the canvas (see `freeFrame`) and keeps it up to date as the lesson page's
 * chrome, the status note or the scene's panel change size. Sets `--book-t/l/r/b/sh` on `root`, which
 * place `.book-scene .sk-status` and `.book-scene-panel` (scene-kit.css). `panel` is the scene's own
 * panel of forms and results, if it has one.
 */
export function useFreeFrame(
  root: RefObject<HTMLDivElement | null>,
  panel: RefObject<HTMLDivElement | null> | null,
  { summary, printMinWidth }: { summary: boolean; printMinWidth?: number },
): FreeFrameState {
  const [state, setState] = useState<FreeFrameState>({
    frame: { left: 0, top: 0, right: 1, bottom: 1 },
    size: { width: 1, height: 1 },
    wide: true,
    print: false,
  });
  const measure = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    measure.current = () => {
      const el = root.current;
      const lesson = el?.closest(".lesson");
      if (!el || !lesson) return;
      const R = el.getBoundingClientRect();
      const rect = (sel: string) => lesson.querySelector(sel)?.getBoundingClientRect() ?? null;
      const title = rect(".lesson-title");
      const head = rect(".step-head");
      const dock = rect(".lesson-dock");
      const bar = rect(".stage-bar");
      const side = rect(".lesson-panel");
      const chrome: Chrome = {
        width: R.width,
        height: R.height,
        titleBottom: title ? title.bottom - R.top : null,
        headBottom: head ? head.bottom - R.top : null,
        dockTop: dock ? dock.top - R.top : null,
        dockRight: dock ? dock.right - R.left : null,
        barTop: bar ? bar.top - R.top : null,
        sideLeft: side ? side.left - R.left : null,
        statusHeight: 0,
        panelHeight: 0,
      };
      const set = (v: FreeFrame["vars"]) => {
        el.style.setProperty("--book-t", `${v.t}px`);
        el.style.setProperty("--book-l", `${v.l}px`);
        el.style.setProperty("--book-r", `${v.r}px`);
        el.style.setProperty("--book-b", `${v.b}px`);
        el.style.setProperty("--book-sh", `${v.sh}px`);
      };
      // Place the note and panel first: their height depends on the width they get.
      const opts = { summary, printMinWidth };
      set(freeFrame(chrome, opts).vars);
      const status = el.querySelector<HTMLElement>(".sk-status");
      chrome.statusHeight = status?.textContent ? status.offsetHeight : 0;
      chrome.panelHeight = panel?.current?.offsetHeight ?? 0;
      const f = freeFrame(chrome, opts);
      set(f.vars);
      const next: FreeFrameState = {
        frame: f.frame,
        size: { width: R.width, height: R.height },
        wide: f.wide,
        print: f.print,
      };
      setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure.current();
  });
  useEffect(() => {
    const el = root.current;
    const lesson = el?.closest(".lesson");
    if (!el || !lesson) return;
    const ro = new ResizeObserver(() => measure.current());
    const watched = new Set<Element>();
    const watch = () => {
      const els = [
        el,
        ...CHROME.map((sel) => lesson.querySelector(sel)),
        panel?.current ?? null,
        el.querySelector(".sk-status"),
      ];
      for (const t of els)
        if (t && !watched.has(t)) {
          watched.add(t);
          ro.observe(t);
        }
    };
    watch();
    // The lesson page swaps its chrome (the step heading, the dock) in and out: watch the new elements
    // and measure again, or the frame keeps a stale heading height.
    const mo = new MutationObserver(() => {
      watch();
      measure.current();
    });
    mo.observe(lesson, { childList: true, subtree: true });
    // Web fonts change how the title and heading wrap after the first measure.
    let live = true;
    void document.fonts?.ready.then(() => live && measure.current());
    return () => {
      live = false;
      ro.disconnect();
      mo.disconnect();
    };
  }, [root, panel]);
  return state;
}

// ---------- the book scene ----------

export interface BookSceneProps<T> extends Pick<
  InkStageProps,
  "flat" | "reducedMotion" | "state" | "description" | "status" | "onMiss" | "minDistance" | "maxDistance"
> {
  /** Turns the page and pops the figure up again when it changes: usually the step. */
  page: number | string;
  /**
   * Which spread the book is open at: sets the page numbers. Steps that share one picture (the quiz
   * and the honest take) share a sheet.
   */
  sheet: number;
  /** The open book, sized for the figure: `spreadBeside` when words are printed, else `spreadFor`. */
  spread: Spread;
  /** Running heads (left page, right page). Leave out when the printed step heads the left page. */
  heads?: [string, string];
  /** Figure caption at the foot of the right page ("Fig. 3  …"); also the tour's caption at rest. */
  caption?: string;
  /** Where the step's words are printed on the left page; null keeps them docked (narrow, summary). */
  text: TextBlock | null;
  /** What the camera keeps in view for this step (the figure, without the printed words). */
  focus: Focus;
  /** The free part of the canvas (`useFreeFrame`, inset by the step's reserve). */
  frame: Frame;
  size: { width: number; height: number };
  /** This step's camera tour; none hides the play button. */
  shots?: Shot<T>[];
  /** What the camera looks at for one tour shot. */
  shotFocus?: (target: T) => Focus;
  /** How much of the frame the focus fills (frameCamera). */
  fill?: number;
  readingElevation?: number;
  /** Page number of the first sheet's left page. */
  firstFolio?: number;
  children: ReactNode;
}

/**
 * A lesson's 3D view standing on an open pop-up book. Prints the step on the left page while `text` is
 * set, the tour is at rest and the page is on screen; otherwise the lesson page docks the words as usual,
 * so the step's text and controls are never lost. Frames the camera on the reading shot (figure and
 * words) or the tour's shot.
 */
export function BookScene<T>({
  page,
  sheet,
  spread,
  heads,
  caption,
  text,
  focus,
  frame,
  size,
  shots = [],
  shotFocus,
  fill = 0.9,
  readingElevation,
  firstFolio,
  reducedMotion,
  children,
  ...stage
}: BookSceneProps<T>) {
  const tour = useTour(shots, page);
  const { page: words, setPrinted } = useContext(SpreadContext);
  const [pageInView, setPageInView] = useState(true);
  const printed = !!text && !tour.shot && pageInView;
  useEffect(() => {
    setPrinted(printed);
    return () => setPrinted(false);
  }, [printed, setPrinted]);
  const reading = text ? readingShot(focus, text, readingElevation) : focus;
  const shot = tour.shot && shotFocus ? shotFocus(tour.shot.target) : reading;
  const view = frameCamera(shot, frame, size.width, size.height, fill);
  return (
    <>
      <InkStage
        {...stage}
        view={view}
        reducedMotion={reducedMotion}
        page={page}
        backdrop={
          <>
            <BookBackdrop
              spread={spread}
              heads={heads}
              folios={folios(sheet, firstFolio)}
              caption={caption}
            />
            {text ? <PrintOnPage block={text} el={words} place={printed} onInView={setPageInView} /> : null}
          </>
        }
      >
        <ViewOffset frame={frame} reducedMotion={reducedMotion} />
        {children}
      </InkStage>
      <TourControls tour={tour} idle={caption ?? ""} />
    </>
  );
}
