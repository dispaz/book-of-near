import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Sprite, type SpriteMaterial } from "three";
import { arcPoint, easeInOut, type Vec3 } from "./motion";
import { glowTexture } from "./materials";
import { useStage } from "./context";
import { COLORS } from "./theme";

const TRAIL = 14;
/** Longest time step one frame may advance a hop, in seconds. */
const MAX_STEP = 1 / 20;

/**
 * Something that travels: a coin, a transaction, a receipt. It sits at `to`. When `to` changes it
 * hops there along an arc with a glowing trail, then calls `onArrive`. Under reduced motion it
 * jumps at once. The first placement never animates. `onArrive` fires every time it comes to rest
 * at a new `to`, including the first placement, so a scene can always rely on it.
 *
 * Place it directly in the scene (not inside a moved group): the trail lives in its parent's space.
 */
export function Traveller({
  to,
  arc = 2.5,
  duration = 1.2,
  color = COLORS.orange,
  glow = true,
  onArrive,
  children,
}: {
  to: Vec3;
  /** Height of the hop at its middle. */
  arc?: number;
  /** Seconds per hop. */
  duration?: number;
  /** Colour of the glow and trail. */
  color?: string;
  glow?: boolean;
  onArrive?: () => void;
  children: ReactNode;
}) {
  const { reducedMotion } = useStage();
  const group = useRef<Group>(null);
  const glowRef = useRef<Sprite>(null);
  const trail = useRef<(Sprite | null)[]>([]);
  const hop = useRef<{ from: Vec3; to: Vec3; elapsed: number } | null>(null);
  const placed = useRef(false);
  const arrive = useRef(onArrive);
  useLayoutEffect(() => {
    arrive.current = onArrive;
  });

  const [x, y, z] = to;
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    const target: Vec3 = [x, y, z];
    const p = g.position;
    if (placed.current && !hop.current && p.x === x && p.y === y && p.z === z) return;
    if (!placed.current || reducedMotion) {
      placed.current = true;
      hop.current = null;
      g.position.set(x, y, z);
      trail.current.forEach((s) => s?.position.set(x, y, z));
      arrive.current?.();
      return;
    }
    hop.current = { from: [g.position.x, g.position.y, g.position.z], to: target, elapsed: 0 };
  }, [x, y, z, reducedMotion]);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const h = hop.current;
    if (h) {
      // Advance by the frame time, capped at MAX_STEP: a slow or stalled frame (busy phone, background
      // tab) slows the hop down instead of skipping it, so the learner always sees the coin travel.
      h.elapsed += Math.min(delta, MAX_STEP);
      const u = Math.min(1, h.elapsed / duration);
      g.position.set(...arcPoint(h.from, h.to, arc, easeInOut(u)));
      if (u >= 1) {
        hop.current = null;
        arrive.current?.();
      }
    }
    // Each trail dot chases the one before it; dots that have caught up are hidden.
    // The chase rates are per 60 Hz frame, scaled by the frame time so fast screens do not shorten the trail.
    const dots = trail.current;
    const per = (k: number) => (reducedMotion ? 1 : 1 - Math.pow(1 - k, Math.min(delta, MAX_STEP) * 60));
    dots[0]?.position.lerp(g.position, per(0.5));
    for (let i = 1; i < dots.length; i++) {
      const prev = dots[i - 1];
      if (prev) dots[i]?.position.lerp(prev.position, per(0.35));
    }
    for (const d of dots) if (d) d.visible = d.position.distanceToSquared(g.position) > 0.01;
    // The glow pulses while travelling and dims at rest.
    const glowSprite = glowRef.current;
    if (glowSprite) {
      const moving = !!hop.current;
      (glowSprite.material as SpriteMaterial).opacity = !moving
        ? 0.4
        : reducedMotion
          ? 0.9
          : 0.75 + 0.25 * Math.sin(clock.elapsedTime * 5.5);
      glowSprite.scale.setScalar(moving ? 2.6 : 1.9);
    }
  });

  return (
    <>
      <group ref={group}>
        {children}
        {glow ? (
          <sprite ref={glowRef} scale={[2.6, 2.6, 1]}>
            <spriteMaterial
              map={glowTexture()}
              color={color}
              transparent
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </sprite>
        ) : null}
      </group>
      {glow
        ? Array.from({ length: TRAIL }, (_, i) => (
            <sprite
              key={i}
              ref={(s) => {
                trail.current[i] = s;
              }}
              scale={[1.5 * (1 - i / 18), 1.5 * (1 - i / 18), 1]}
            >
              <spriteMaterial
                map={glowTexture()}
                color={color}
                transparent
                opacity={0.5 * (1 - i / TRAIL)}
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </sprite>
          ))
        : null}
    </>
  );
}
