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
import { StageBar } from "./StageBar";
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
  if (!lesson || lesson.status === "planned") {
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
  const [opened, setOpened] = useState<Set<number>>(() => new Set());
  const [slot, setSlot] = useState<HTMLElement | null>(null);
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
    const update = () => {
      // --tools-h: the pill row (phones put the title under it); --head-h: where the header ends, so
      // lesson panels start below the title instead of at a fixed offset.
      if (tools) root.style.setProperty("--tools-h", `${tools.offsetHeight}px`);
      const bottom = Math.max(
        title ? title.offsetTop + title.offsetHeight : 0,
        tools ? tools.offsetTop + tools.offsetHeight : 0,
      );
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
  const [chosenView, setView] = useSceneView({
    available: twoViews,
    webgl: glAvailable,
    reducedMotion,
    wide,
  });
  // 3D-only lessons are always 3D; two-view lessons fall back to 2D without WebGL.
  const view = lesson.needsWebGL ? "3d" : twoViews && glAvailable ? chosenView : "2d";

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
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowRight" && canNext) goTo(step + 1);
      else if (e.key === "ArrowLeft") goTo(step - 1);
      else if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, canNext, goTo]);

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

  return (
    <main
      ref={setRoot}
      className="lesson"
      style={{ "--accent": stage.accent } as CSSProperties}
      data-lesson={lesson.id}
    >
      <ActionSlot.Provider value={slot}>
        <div className="scene-area" data-testid="scene-area">
          {!Scene ? (
            fallback("This lesson has no scene yet. Here are its steps as text.")
          ) : !webgl ? (
            fallback("Your browser can't draw the 3D scene. Here are the steps as text.")
          ) : (
            <SceneBoundary fallback={fallback("The scene could not load. Here are the steps as text.")}>
              <Suspense fallback={<p className="visually-hidden">Loading scene…</p>}>
                <Scene {...sceneProps} />
              </Suspense>
            </SceneBoundary>
          )}
        </div>
      </ActionSlot.Provider>

      <header className="lesson-title">
        <p className="eyebrow">
          <Link className="home-link" to="/">
            Book of NEAR
          </Link>{" "}
          · Stage {stage.id} · {stage.name}
        </p>
        <h1>{lesson.title}</h1>
      </header>

      <div className="lesson-tools">
        {twoViews && glAvailable ? <ViewSwitch view={view} onChange={setView} /> : null}
        {view === "3d" && (webgl || twoViews) ? (
          <button className="pill" aria-pressed={flat} onClick={() => setFlat((f) => !f)}>
            Flat view
          </button>
        ) : null}
        <ModeSwitch />
      </div>

      <div className="lesson-dock">
        <div className="action-slot" ref={setSlot} />
        <section className="lesson-card" aria-label="Step details">
          <p className="step-label">
            Step {step + 1} of {lesson.steps.length}
            {current.action?.gate && !opened.has(step) ? ` · Your turn: ${current.action.label}` : ""}
          </p>
          {current.explain ? <p data-testid="explain">{current.explain}</p> : null}
          {step === last ? <FinishLesson lesson={lesson} mode={mode} disabled={!canNext} /> : null}
          <details className="read-as-text">
            <summary>Read as text</summary>
            <ol>
              {steps.map((s, i) => (
                <li key={i}>{s.caption}</li>
              ))}
            </ol>
          </details>
        </section>
      </div>

      {menuOpen ? <StageMenu currentId={lesson.id} onPick={() => setMenuOpen(false)} /> : null}

      <StageBar
        steps={steps}
        step={step}
        canNext={canNext}
        menuOpen={menuOpen}
        onStep={goTo}
        onToggleMenu={() => setMenuOpen((o) => !o)}
      />
    </main>
  );
}
