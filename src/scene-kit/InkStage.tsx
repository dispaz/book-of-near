import { useMemo, useRef, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraRig } from "./CameraRig";
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
  children,
}: InkStageProps) {
  const store = useMemo(() => new OverlayStore(), []);
  const settings = useMemo(() => ({ reducedMotion, flat }), [reducedMotion, flat]);
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={wrap}
      className="sk-stage"
      data-scene-state={state}
      data-view={flat ? "flat" : "3d"}
      data-camera="moving"
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
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
              <planeGeometry args={[80, 80]} />
              <meshBasicMaterial color={GROUND} />
            </mesh>
            <CameraRig
              view={view}
              flat={flat}
              reducedMotion={reducedMotion}
              minDistance={minDistance}
              maxDistance={maxDistance}
              onMotion={(m) => wrap.current?.setAttribute("data-camera", m)}
            />
            <OverlaySync />
            {children}
          </Canvas>
          <Overlay store={store} />
        </OverlayContext.Provider>
      </StageContext.Provider>
      <p className="sk-status" data-testid="scene-status" aria-live="polite">
        {status ?? ""}
      </p>
    </div>
  );
}
