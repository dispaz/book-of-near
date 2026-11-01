import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Sprite, type SpriteMaterial } from "three";
import { arcPoint, easeInOut, type Vec3 } from "./motion";
import { glowTexture } from "./materials";
import { useStage } from "./context";
import { COLORS } from "./theme";

const TRAIL = 14;

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
  const hop = useRef<{ from: Vec3; to: Vec3; t0: number } | null>(null);
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
    hop.current = { from: [g.position.x, g.position.y, g.position.z], to: target, t0: -1 };
  }, [x, y, z, reducedMotion]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const h = hop.current;
    if (h) {
      if (h.t0 < 0) h.t0 = clock.elapsedTime;
      const u = Math.min(1, (clock.elapsedTime - h.t0) / duration);
      g.position.set(...arcPoint(h.from, h.to, arc, easeInOut(u)));
      if (u >= 1) {
        hop.current = null;
        arrive.current?.();
      }
    }
    // Each trail dot chases the one before it; dots that have caught up are hidden.
    const dots = trail.current;
    dots[0]?.position.lerp(g.position, reducedMotion ? 1 : 0.5);
    for (let i = 1; i < dots.length; i++) {
      const prev = dots[i - 1];
      if (prev) dots[i]?.position.lerp(prev.position, reducedMotion ? 1 : 0.35);
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
