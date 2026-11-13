/**
 * Stage 5's hardware enclave, in 3D: a dark chip with pins and a padlock, inside a low perimeter wall
 * that lights in the stage accent once `lit`. Lessons 5.1 (where a prompt goes) and 5.2 (where an agent
 * runs and makes its key) both draw it; each lesson wraps it in its own Pickable.
 */
import { COLORS, INK, Label, Outline, SoftShadow, useInk } from "../../../scene-kit";
import stage from "./stage";

export function EnclaveBox({ lit, label }: { lit: boolean; label?: string }) {
  const chip = useInk(INK);
  const pin = useInk(COLORS.slab);
  const accent = useInk(stage.accent);
  const rim = useInk(lit ? stage.accent : COLORS.paper);
  return (
    <group>
      <SoftShadow position={[0, 0, 0.2]} size={[2.4, 1.8]} />
      {/* The sealed perimeter: a low wall all round. */}
      {(
        [
          [0, -0.85, 2.0, 0.12],
          [0, 0.85, 2.0, 0.12],
          [-1.0, 0, 0.12, 1.82],
          [1.0, 0, 0.12, 1.82],
        ] as const
      ).map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} position={[x, 0.12, z]} material={rim}>
          <boxGeometry args={[w, 0.24, d]} />
          <Outline />
        </mesh>
      ))}
      {/* The chip and its pins. */}
      <mesh position={[0, 0.2, 0]} material={chip}>
        <boxGeometry args={[1.2, 0.25, 1.0]} />
        <Outline />
      </mesh>
      {[-0.4, -0.13, 0.13, 0.4].map((x) =>
        [-0.58, 0.58].map((z) => (
          <mesh key={`${x},${z}`} position={[x, 0.12, z]} material={pin}>
            <boxGeometry args={[0.08, 0.06, 0.16]} />
          </mesh>
        )),
      )}
      {/* A padlock on the chip. */}
      <mesh position={[0, 0.48, 0]} material={accent}>
        <boxGeometry args={[0.38, 0.3, 0.2]} />
        <Outline />
      </mesh>
      <mesh position={[0, 0.66, 0]} material={chip}>
        <torusGeometry args={[0.12, 0.035, 8, 20, Math.PI]} />
      </mesh>
      {label ? (
        <Label position={[0, 0.05, 1.2]} variant="small">
          {label}
        </Label>
      ) : null}
    </group>
  );
}
