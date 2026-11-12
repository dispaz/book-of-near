import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { IntroContext } from "../app/intro";
import { CameraControls } from "./CameraControls";
import { CameraRig } from "./CameraRig";
import { recallView } from "./viewMemory";
import { PopClock, PopContext, PopGroup, usePopDriver } from "./PopUp";
import { StageContext } from "./context";
import { Overlay, OverlayContext, OverlayStore, OverlaySync } from "./overlay";
import type { DeskBox } from "./book";
import type { CameraView } from "./motion";
import { ROOM, type CameraBox } from "./roomLayout";
import { PAGE } from "./theme";
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
  /** Key (the lesson id) under which the learner's own view is kept while the 3D view is closed. */
  viewMemory?: string;
  /** The open book's footprint (`bookFootprint`): the pan may take the camera anywhere over it. */
  panBounds?: DeskBox;
  /** The room the camera must stay inside (`cameraRoom(roomForSpread(spread))`). */
  cameraBounds?: CameraBox;
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
  viewMemory,
  panBounds,
  cameraBounds,
  children,
}: InkStageProps) {
  const store = useMemo(() => new OverlayStore(), []);
  // Growing out of the 2D page: start top-down with everything pressed flat, then tilt the camera and
  // let the objects rise. Decided once, when the stage mounts.
  const intro = useContext(IntroContext);
  const [growing] = useState(() => intro.grow && !reducedMotion);
  // The learner's own camera kept from before (2D and back): the objects still rise, but the camera
  // starts where they left it instead of top-down (a top-down start would flatten their view).
  const [pressed, setPressed] = useState(() => growing && !(viewMemory && recallView(viewMemory)));
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
      data-pan-bounds={
        panBounds
          ? [panBounds.minX, panBounds.maxX, panBounds.minZ, panBounds.maxZ]
              .map((n) => n.toFixed(2))
              .join(",")
          : undefined
      }
    >
      <p className="visually-hidden">{description}</p>
      <StageContext.Provider value={settings}>
        <OverlayContext.Provider value={store}>
          <Canvas
            // Draw only when something asks for a frame (frames.ts, #44): an idle scene costs nothing.
            frameloop="demand"
            dpr={[1, 2]}
            flat
            camera={{ fov: 34, near: 0.1, far: ROOM.far, position: [...view.position] }}
            gl={{ antialias: true, alpha: true }}
            onPointerMissed={(e) => {
              if (e.type === "click") onMiss?.();
            }}
          >
            <PopContext.Provider value={pop.frame}>
              <DrawOnRender />
              <PopClock tick={pop.tick} />
              {backdrop ?? (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
                  <planeGeometry args={[80, 80]} />
                  <meshBasicMaterial color={PAGE} />
                </mesh>
              )}
              <CameraRig
                view={view}
                flat={looksFlat}
                reducedMotion={reducedMotion}
                minDistance={minDistance}
                maxDistance={maxDistance}
                keep={keepView}
                memory={viewMemory}
                panBounds={panBounds}
                room={cameraBounds}
                reset={reset}
                onMotion={(m) => wrap.current?.setAttribute("data-camera", m)}
                onUserView={setUserView}
                onPose={(p, inside) => {
                  wrap.current?.setAttribute("data-camera-pose", p);
                  if (inside !== null)
                    wrap.current?.setAttribute("data-camera-inside", inside ? "yes" : "no");
                }}
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

/** Inside the canvas: one frame after every render of the stage (new step, new props), as a safety net. */
function DrawOnRender() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  });
  return null;
}
