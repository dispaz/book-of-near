import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { registry } from "../app/registry";
import { useChainMode } from "../chain/ChainContext";
import { ModeSwitch } from "../chain/ModeSwitch";
import type { LessonManifest, SceneProps } from "../app/types";
import { BarSlot, StageBar } from "./StageBar";
import { SceneBoundary } from "./SceneBoundary";
import { TextFallback } from "./TextFallback";
import { hasWebGL, useMediaQuery, useReducedMotion } from "./hooks";
import { useSceneView } from "./view";
import { ViewSwitch } from "./ViewSwitch";
import { StageMenu } from "./StageMenu";
import { ActionSlot } from "./SceneAction";
import { fillStep } from "../app/fillVars";
import { progress } from "../progress";
import { FinishLesson, useRecordPosition } from "../progress/FinishLesson";
import { StepNote } from "./StepNote";
import { BookCover, startsClosed } from "./BookCover";
import { IntroContext, LessonIdContext, SpreadContext } from "../app/intro";
import { Summary } from "./Summary";
import { TopicCardPage } from "./TopicCard";

const sceneCache = new Map<string, ComponentType<SceneProps>>();

function sceneFor(lesson: LessonManifest): ComponentType<SceneProps> | null {
  if (!lesson.scene) return null;
  let c = sceneCache.get(lesson.id);
  if (!c) {
    c = lazy(lesson.scene);
    sceneCache.set(lesson.id, c);
  }
  return c;
}

export function LessonPage() {
  const { id = "" } = useParams();
  const lesson = registry.lessons.get(id);
  // A locked card (planned lesson or backlog topic) opens as the card on its own page.
  if (lesson?.status === "planned")
    return <TopicCardPage lesson={lesson} stage={registry.stageOf(lesson.id)!} />;
  if (!lesson) {
    return (
      <main className="page">
        <div className="page-inner">
          <h1>Lesson not found</h1>
          <p className="lede">This page is not written yet.</p>
          <Link className="btn" to="/">
            Back to contents
          </Link>
        </div>
      </main>
    );
  }
  return <Lesson key={lesson.id} lesson={lesson} />;
}

function Lesson({ lesson }: { lesson: LessonManifest }) {
  const stage = registry.stageOf(lesson.id)!;
  const [params, setParams] = useSearchParams();
  const last = lesson.steps.length - 1;
  const step = Math.min(last, Math.max(0, Number(params.get("step") ?? "1") - 1 || 0));
  const reducedMotion = useReducedMotion();
  const [flat, setFlat] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullTitle, setFullTitle] = useState(false);
  const [opened, setOpened] = useState<Set<number>>(() => new Set());
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);
  // The 3D view prints the step on its book's left page (see SpreadContext).
  const [spread, setSpread] = useState(false);
  const [bookPage, setBookPage] = useState<HTMLElement | null>(null);
  const spreadCtx = useMemo(() => ({ page: bookPage, setPrinted: setSpread }), [bookPage]);
  const [vars, setVarsState] = useState<Record<string, string>>(() => ({ ...lesson.vars }));
  const setVars = useCallback(
    (next: Record<string, string>) =>
      setVarsState((prev) =>
        Object.entries(next).every(([k, v]) => prev[k] === v) ? prev : { ...prev, ...next },
      ),
    [],
  );
  // Every learner-facing step text, with `{name}` placeholders filled from the learner's own values.
  const steps = useMemo(() => lesson.steps.map((s) => fillStep(s, vars)), [lesson.steps, vars]);
  const [root, setRoot] = useState<HTMLElement | null>(null);

  // Publish the stage bar and dock heights as CSS variables, so the step card, menu and lesson panels
  // stay clear of a stage bar that grows with a long caption (phones).
  useEffect(() => {
    if (!root || typeof ResizeObserver === "undefined") return;
    const bar = root.querySelector<HTMLElement>(".stage-bar");
    const dock = root.querySelector<HTMLElement>(".lesson-dock");
    const title = root.querySelector<HTMLElement>(".lesson-title");
    const tools = root.querySelector<HTMLElement>(".lesson-tools");
    const head = root.querySelector<HTMLElement>(".step-head");
    const update = () => {
      // --tools-h: the pill row (phones put the title under it). --title-b: where the title and pills
      // end (narrow screens put the step heading there). --head-h: where the whole header, step heading
      // included, ends, so lesson panels start below it instead of at a fixed offset.
      // Phones put the one-line title beside the mode link under the pills, so --tools-h is the pill
      // row only; a testnet notice under the pills is tall, and then the title goes below all of it.
      if (tools) {
        const pill = tools.querySelector<HTMLElement>(".pill");
        const notice = tools.querySelector(".mode-notice");
        const h = !notice && pill ? pill.offsetHeight : tools.offsetHeight;
        root.style.setProperty("--tools-h", `${h}px`);
      }
      const titleB = Math.max(
        title ? title.offsetTop + title.offsetHeight : 0,
        tools ? tools.offsetTop + tools.offsetHeight : 0,
      );
      if (titleB) root.style.setProperty("--title-b", `${titleB}px`);
      const bottom = Math.max(titleB, head ? head.offsetTop + head.offsetHeight : 0);
      if (bottom) root.style.setProperty("--head-h", `${bottom + 12}px`);
      if (bar) root.style.setProperty("--bar-h", `${bar.offsetHeight}px`);
      if (dock) root.style.setProperty("--dock-h", `${dock.offsetHeight}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    if (bar) ro.observe(bar);
    if (dock) ro.observe(dock);
    if (title) ro.observe(title);
    if (tools) ro.observe(tools);
    if (head) ro.observe(head);
    return () => ro.disconnect();
  }, [root]);
  const mode = useChainMode().active;
  const twoViews = !!lesson.views?.includes("2d") && !!lesson.views?.includes("3d");
  const glAvailable = useMemo(
    () => (lesson.needsWebGL || twoViews ? hasWebGL() : true),
    [lesson.needsWebGL, twoViews],
  );
  const webgl = lesson.needsWebGL ? glAvailable : true;
  const wide = useMediaQuery("(min-width: 900px)");
  const phone = useMediaQuery("(max-width: 560px)");
  const [chosenView, setView] = useSceneView({
    available: twoViews,
    webgl: glAvailable,
    reducedMotion,
    wide,
  });
  // The closed book. After it opens, a lesson that will show 3D first shows its 2D page for a moment,
  // then the 3D scene grows out of it (IntroContext).
  const [closed, setClosed] = useState(() => startsClosed(params.get("step")));
  const [pageFirst, setPageFirst] = useState(closed);
  const opened_ = useCallback(() => setClosed(false), []);
  useEffect(() => {
    if (closed || !pageFirst) return;
    const id = setTimeout(() => setPageFirst(false), reducedMotion ? 0 : 900);
    return () => clearTimeout(id);
  }, [closed, pageFirst, reducedMotion]);
  // 3D-only lessons are always 3D; two-view lessons fall back to 2D without WebGL.
  const wanted = lesson.needsWebGL ? "3d" : twoViews && glAvailable ? chosenView : "2d";
  const view = twoViews && pageFirst ? "2d" : wanted;
  // The 3D view grows out of the page when the learner has just seen 2D (or the book just opened).
  const [shown2d, setShown2d] = useState(closed);
  const grow = view === "3d" && shown2d;
  useEffect(() => {
    if (view === "2d") setShown2d(true);
    else {
      const id = setTimeout(() => setShown2d(false), 2000);
      return () => clearTimeout(id);
    }
  }, [view]);
  const intro = useMemo(() => ({ grow }), [grow]);

  const gated = (i: number) => !!lesson.steps[i]?.action?.gate && !opened.has(i);
  // Steps up to and including the first closed gate are reachable.
  const canNext = !gated(step);

  const goTo = useCallback(
    (n: number) => {
      const target = Math.min(last, Math.max(0, n));
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set("step", String(target + 1));
          return next;
        },
        { replace: true },
      );
    },
    [last, setParams],
  );

  const setGate = useCallback(
    (open: boolean) =>
      setOpened((prev) => {
        if (prev.has(step) === open) return prev;
        const next = new Set(prev);
        if (open) next.add(step);
        else next.delete(step);
        return next;
      }),
    [step],
  );

  // Keyboard: arrows move, Escape closes the contents menu. Ignore keys typed into form fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (closed || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight" && canNext) goTo(step + 1);
      else if (e.key === "ArrowLeft") goTo(step - 1);
      else if (e.key === "Escape") {
        setMenuOpen(false);
        root?.querySelector(".read-as-text[open]")?.removeAttribute("open");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, canNext, goTo, closed, root]);

  useRecordPosition(lesson.id, step);
  const reportEvidence = useCallback(
    (ev: Record<string, string>) => progress.reportEvidence(lesson.id, ev),
    [lesson.id],
  );

  const Scene = sceneFor(lesson);
  const sceneProps: SceneProps = {
    step,
    goTo,
    setGate,
    reducedMotion,
    view,
    flat,
    mode,
    reportEvidence,
    setVars,
  };
  const Fallback = lesson.fallback;
  const fallback = (reason: string) =>
    Fallback ? <Fallback {...sceneProps} /> : <TextFallback steps={steps} step={step} reason={reason} />;
  const current = steps[step]!;
  const finish = step === last ? <FinishLesson lesson={lesson} mode={mode} disabled={!canNext} /> : null;

  return (
    <main
      ref={setRoot}
      className="lesson"
      style={{ "--accent": stage.accent } as CSSProperties}
      data-lesson={lesson.id}
      data-spread={spread ? "" : undefined}
    >
      <LessonIdContext.Provider value={lesson.id}>
        <IntroContext.Provider value={intro}>
          <SpreadContext.Provider value={spreadCtx}>
            <BarSlot.Provider value={barSlot}>
              <ActionSlot.Provider value={slot}>
                <div className="scene-area" data-testid="scene-area" inert={closed}>
                  {!Scene ? (
                    fallback("This lesson has no scene yet. Here are its steps as text.")
                  ) : !webgl ? (
                    fallback("Your browser can't draw the 3D scene. Here are the steps as text.")
                  ) : (
                    <SceneBoundary
                      fallback={fallback("The scene could not load. Here are the steps as text.")}
                    >
                      <Suspense fallback={<p className="visually-hidden">Loading scene…</p>}>
                        <Scene {...sceneProps} />
                      </Suspense>
                    </SceneBoundary>
                  )}
                  {current.page === "summary" ? <Summary title={lesson.title} steps={steps} /> : null}
                </div>
              </ActionSlot.Provider>
            </BarSlot.Provider>
          </SpreadContext.Provider>
        </IntroContext.Provider>
      </LessonIdContext.Provider>

      <header className="lesson-title" inert={closed}>
        <p className="eyebrow">
          <Link className="home-link" to="/">
            Book of NEAR
          </Link>{" "}
          · Stage {stage.id} · {stage.name}
        </p>
        {/* Phones cut the title to one line; a tap (or Enter) on its button shows it whole (see ink.css).
            Wider screens show it whole, as plain text. */}
        <h1 title={lesson.title}>
          {phone ? (
            <button
              type="button"
              className="title-toggle"
              aria-expanded={fullTitle}
              data-full={fullTitle ? "" : undefined}
              onClick={() => setFullTitle((f) => !f)}
            >
              {lesson.title}
            </button>
          ) : (
            lesson.title
          )}
        </h1>
      </header>

      <div className="lesson-tools" inert={closed}>
        {twoViews && glAvailable ? <ViewSwitch view={view} onChange={setView} /> : null}
        {view === "3d" && (webgl || twoViews) ? (
          <button className="pill" aria-pressed={flat} onClick={() => setFlat((f) => !f)}>
            Flat view
          </button>
        ) : null}
        <ModeSwitch />
      </div>

      {/* The step's words. Normally laid out over the scene; a 3D view on a book can print them on its
          left page (data-spread), and then this box is placed there. */}
      <div className="book-page" ref={setBookPage}>
        <section className="step-head" aria-label="Current step" inert={closed}>
          <p className="step-label">
            Step {step + 1} of {lesson.steps.length}
            {current.action?.gate && !opened.has(step) ? (
              <span className="your-turn">
                {" "}
                · Your turn<span className="your-turn-what">: {current.action.label}</span>
              </span>
            ) : null}
          </p>
          <p className="step-caption" aria-live="polite" data-testid="caption">
            {current.caption}
          </p>
          <details className="read-as-text">
            <summary>Read as text</summary>
            <ol>
              {steps.map((s, i) => (
                <li key={i}>{s.caption}</li>
              ))}
            </ol>
          </details>
        </section>

        <div className="lesson-dock" inert={closed}>
          <div className="action-slot" ref={setSlot} />
          {current.explain ? (
            <StepNote
              key={step}
              text={current.explain}
              anchor={spread ? undefined : current.explainAt}
              layer={root}
              wide={wide}
              compact={phone}
            >
              {finish}
            </StepNote>
          ) : finish ? (
            <div className="note docked">{finish}</div>
          ) : null}
        </div>
      </div>

      {menuOpen ? <StageMenu currentId={lesson.id} onPick={() => setMenuOpen(false)} /> : null}

      {closed ? (
        <BookCover
          stage={`Book of NEAR · Stage ${stage.id} · ${stage.name}`}
          number={`${stage.id}.${lesson.order}`}
          title={lesson.title}
          summary={lesson.summary ?? ""}
          steps={steps.length}
          reducedMotion={reducedMotion}
          onOpened={opened_}
        />
      ) : null}

      <StageBar
        inert={closed}
        count={steps.length}
        step={step}
        canNext={canNext}
        menuOpen={menuOpen}
        onStep={goTo}
        onToggleMenu={() => setMenuOpen((o) => !o)}
        slot={setBarSlot}
      />
    </main>
  );
}
