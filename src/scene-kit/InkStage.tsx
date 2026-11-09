import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { IntroContext } from "../app/intro";
import { CameraControls } from "./CameraControls";
import { CameraRig } from "./CameraRig";
import { PopClock, PopContext, PopGroup, usePopDriver } from "./PopUp";
import { StageContext } from "./context";
import { Overlay, OverlayContext, OverlayStore, OverlaySync } from "./overlay";
import type { CameraView } from "./motion";
import { GROUND } from "./theme";
import "./scene-kit.css";

export interface InkStageProps {
  /** Camera preset for the current step. Change it and the rig moves there. */
  view: CameraView;
  /** Top-down camera (from SceneProps). */
  flat: boolean;
  /** No tweening: the camera and travellers jump to their end states (from SceneProps). */
  reducedMotion: boolean;
  /** Short machine-readable state, exposed as `data-scene-state` for tests. */
  state: string;
  /** What the scene shows, in one sentence, for screen readers. */
  description: string;
  /** Handwritten note at the top right, read out politely when it changes (for example the selection). */
  status?: string;
  /** Called when a click hits nothing pickable. */
  onMiss?: () => void;
  minDistance?: number;
  maxDistance?: number;
  /** What the scene stands on, in place of the plain paper ground (for example a BookBackdrop). */
  backdrop?: ReactNode;
  /**
   * The page the figure is printed on (for example the step). When it changes, the book's page turns
   * and the figure folds flat and pops up again as a drawing that fills in (not under reduced motion).
   */
  page?: number | string;
  /**
   * Keep the learner's own camera across steps (the book scene): once they turn, zoom or slide it, new
   * views leave it be until Reset view. Also shows the camera cluster (Controls, Reset view).
   */
  keepView?: boolean;
  /** Change it to drop the learner's own view (for example when a camera tour starts). */
  viewReset?: string | number;
  children: ReactNode;
}

/**
 * The canvas for a 3D lesson scene: paper ground, camera rig with orbit, overlay labels and
 * focusable pick buttons. Import the kit only from a lazy Scene module, never from a manifest.
 */
export function InkStage({
  view,
  flat,
  reducedMotion,
  state,
  description,
  status,
  onMiss,
  minDistance,
  maxDistance,
  backdrop,
  page,
  keepView = false,
  viewReset,
  children,
}: InkStageProps) {
  const store = useMemo(() => new OverlayStore(), []);
  // Growing out of the 2D page: start top-down with everything pressed flat, then tilt the camera and
  // let the objects rise. Decided once, when the stage mounts.
  const intro = useContext(IntroContext);
  const [growing] = useState(() => intro.grow && !reducedMotion);
  const [pressed, setPressed] = useState(growing);
  useEffect(() => {
    if (!pressed) return;
    const id = setTimeout(() => setPressed(false), 450);
    return () => clearTimeout(id);
  }, [pressed]);
  const looksFlat = flat || pressed;
  const settings = useMemo(() => ({ reducedMotion, flat }), [reducedMotion, flat]);
  const wrap = useRef<HTMLDivElement>(null);
  const pop = usePopDriver({ page, grow: growing, reducedMotion, wrap });
  const [userView, setUserView] = useState(false);
  const [resets, setResets] = useState(0);
  // Reset view, the Flat view pill and the lesson's own reset (a tour) all hand the camera back.
  const reset = `${viewReset ?? ""}|${resets}|${flat ? "flat" : "3d"}`;
  return (
    <div
      ref={wrap}
      className="sk-stage"
      data-scene-state={state}
      data-view={flat ? "flat" : "3d"}
      data-camera="moving"
      data-camera-user={userView ? "on" : "off"}
    >
      <p className="visually-hidden">{description}</p>
      <StageContext.Provider value={settings}>
        <OverlayContext.Provider value={store}>
          <Canvas
            dpr={[1, 2]}
            flat
            camera={{ fov: 34, near: 0.1, far: 200, position: [...view.position] }}
            gl={{ antialias: true, alpha: true }}
            onPointerMissed={(e) => {
              if (e.type === "click") onMiss?.();
            }}
          >
            <PopContext.Provider value={pop.frame}>
              <PopClock tick={pop.tick} />
              {backdrop ?? (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
                  <planeGeometry args={[80, 80]} />
                  <meshBasicMaterial color={GROUND} />
                </mesh>
              )}
              <CameraRig
                view={view}
                flat={looksFlat}
                reducedMotion={reducedMotion}
                minDistance={minDistance}
                maxDistance={maxDistance}
                keep={keepView}
                reset={reset}
                onMotion={(m) => wrap.current?.setAttribute("data-camera", m)}
                onUserView={setUserView}
                onPose={(p) => wrap.current?.setAttribute("data-camera-pose", p)}
              />
              <OverlaySync />
              <PopGroup>{children}</PopGroup>
            </PopContext.Provider>
          </Canvas>
          <Overlay store={store} />
        </OverlayContext.Provider>
      </StageContext.Provider>
      <p className="sk-status" data-testid="scene-status" aria-live="polite">
        {status ?? ""}
      </p>
      {keepView ? <CameraControls userView={userView} onReset={() => setResets((n) => n + 1)} /> : null}
    </div>
  );
}
