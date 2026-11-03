import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { IntroContext } from "../app/intro";
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
  /** What the scene stands on, in place of the plain paper ground (for example a BookBackdrop). */
  backdrop?: ReactNode;
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
              onMotion={(m) => wrap.current?.setAttribute("data-camera", m)}
            />
            <OverlaySync />
            {growing ? <Rise start={0.35}>{children}</Rise> : children}
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

/** Raises its children from pressed flat on the ground to full height, starting `start` seconds in. */
function Rise({ start, children }: { start: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const u = Math.min(1, Math.max(0, (clock.elapsedTime - t0.current - start) / 1.1));
    // Ease out with a small overshoot, like paper popping up.
    const e = u >= 1 ? 1 : 1 + 1.4 * Math.pow(u - 1, 3) + 0.4 * Math.pow(u - 1, 2);
    g.scale.y = Math.max(0.02, e);
  });
  return (
    <group ref={ref} scale={[1, 0.02, 1]}>
      {children}
    </group>
  );
}
