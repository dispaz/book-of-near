import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Html, RoundedBox } from "@react-three/drei";
import { AdditiveBlending, DoubleSide, type Mesh, type Object3D } from "three";
import { glowTexture, hullMaterial, inkMaterial, shadowTexture } from "./materials";
import { useOverlayItem } from "./overlay";
import { isClick, type Vec3 } from "./motion";
import { COLORS, INK } from "./theme";
import { useStage } from "./context";

/** The ink material for a colour at the canvas pixel ratio. */
export function useInk(color: string, faceted = false) {
  const dpr = useThree((s) => s.viewport.dpr);
  return useMemo(() => inkMaterial(color, dpr, faceted), [color, dpr, faceted]);
}

const noRaycast = () => undefined;

/**
 * Black ink outline for the parent mesh. `edges` draws its hard edges (boxes, slabs);
 * `hull` draws a silhouette around curved shapes (coins, rings). Use both on rounded shapes.
 */
export function Outline({
  mode = "edges",
  threshold = 25,
  width = 1.6,
  thickness = 0.035,
  dashed = false,
}: {
  mode?: "edges" | "hull";
  threshold?: number;
  width?: number;
  thickness?: number;
  /** Dashed edges: something that does not exist yet. */
  dashed?: boolean;
}) {
  const hull = useRef<Mesh>(null);
  useLayoutEffect(() => {
    const m = hull.current;
    const parent = m?.parent as Mesh | null | undefined;
    if (m && parent?.geometry) m.geometry = parent.geometry;
  });
  if (mode === "edges")
    return dashed ? (
      <Edges threshold={threshold} lineWidth={width} color={INK} dashed dashSize={0.09} gapSize={0.07} />
    ) : (
      <Edges threshold={threshold} lineWidth={width} color={INK} />
    );
  return <mesh ref={hull} material={hullMaterial(thickness)} raycast={noRaycast} />;
}

/** Soft contact shadow: an ink blot on the ground under an object. */
export function SoftShadow({
  position = [0, 0, 0],
  size = [3, 1.8],
}: {
  position?: Vec3;
  size?: [number, number];
}) {
  return (
    <mesh
      position={[position[0], 0.012, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={noRaycast}
      renderOrder={-1}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} />
    </mesh>
  );
}

/** A handwritten label that follows a point in the scene (local to its parent). */
export function Label({
  position = [0, 0, 0],
  variant = "hand",
  children,
}: {
  position?: Vec3;
  variant?: "hand" | "small" | "hint";
  children: string;
}) {
  const anchor = useRef<Object3D>(null);
  useOverlayItem({ kind: "label", text: children, variant }, anchor);
  return <object3D ref={anchor} position={position} />;
}

/** A name above an object. In flat view it moves behind the object, so it shows above it on screen. */
export function NameLabel({ height, depth, children }: { height: number; depth: number; children: string }) {
  const { flat } = useStage();
  return <Label position={flat ? [0, height - 0.9, -depth * 0.85] : [0, height, 0]}>{children}</Label>;
}

export interface PickProps {
  /** Makes the object clickable. Also adds a focusable button named `pickLabel` for keyboards and tests. */
  onPick?: () => void;
  /** Accessible name of the pick button. Defaults to the object's name. */
  pickLabel?: string;
  /** Draws the selection ring under the object. */
  selected?: boolean;
}

/**
 * Wraps a pickable object. A click is a press whose pointer never went `CLICK_PX` (6 px) from where it
 * began; anything further, even if it comes back, is a camera drag (CameraRig counts the same way) and
 * picks nothing. `anchor` is where the pick button sits, local to the object.
 */
export function Pickable({
  label,
  selected = false,
  onPick,
  anchor = [0, 1, 0],
  children,
}: {
  label: string;
  selected?: boolean;
  onPick: () => void;
  anchor?: Vec3;
  children: ReactNode;
}) {
  const ref = useRef<Object3D>(null);
  const [hover, setHover] = useState(false);
  /** The furthest the pointer went from where this press began (px): the camera rig counts the same. */
  const travel = useRef(0);
  useOverlayItem({ kind: "pick", label, pressed: selected, onPick }, ref);
  useLayoutEffect(() => {
    if (!hover) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);
  return (
    <group
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        // Follow the whole press, not just where it ends: out 7 px and back is a drag (the camera rig
        // takes it as a camera move), never also a pick.
        const { clientX: x0, clientY: y0, pointerId: id } = e.nativeEvent;
        travel.current = 0;
        const move = (ev: PointerEvent) => {
          if (ev.pointerId === id)
            travel.current = Math.max(travel.current, Math.hypot(ev.clientX - x0, ev.clientY - y0));
        };
        const up = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return;
          window.removeEventListener("pointermove", move, true);
          window.removeEventListener("pointerup", up, true);
          window.removeEventListener("pointercancel", up, true);
        };
        window.addEventListener("pointermove", move, true);
        window.addEventListener("pointerup", up, true);
        window.addEventListener("pointercancel", up, true);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!isClick(Math.max(e.delta, travel.current))) return;
        e.stopPropagation();
        onPick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      {children}
      <object3D ref={ref} position={anchor} />
    </group>
  );
}

/** Draws a ring under a selected object. */
export function SelectRing({
  selected,
  radius,
  color,
  children,
}: {
  selected: boolean;
  radius: number;
  color: string;
  children: ReactNode;
}) {
  return (
    <>
      {selected && radius > 0 ? (
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <mesh raycast={noRaycast}>
            <circleGeometry args={[radius, 48]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.45}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh raycast={noRaycast}>
            <ringGeometry args={[radius, radius + 0.1, 48]} />
            <meshBasicMaterial color={INK} side={DoubleSide} />
          </mesh>
        </group>
      ) : null}
      {children}
    </>
  );
}

export function maybePickable(pick: PickProps, name: string, anchorY: number, node: ReactNode) {
  if (!pick.onPick) return node;
  return (
    <Pickable
      label={pick.pickLabel ?? name}
      selected={pick.selected}
      onPick={pick.onPick}
      anchor={[0, anchorY, 0]}
    >
      {node}
    </Pickable>
  );
}

interface BlockProps extends PickProps {
  position?: Vec3;
  /** Handwritten name above the block. Also the default pick label. */
  name: string;
  color?: string;
  /** Edge length of the block. */
  size?: number;
  /** Extra text under the name, for example a balance. */
  note?: string;
  /** Coins stacked on top. */
  coins?: number;
}

/** An inked, slightly rounded block with a soft shadow. Base for the other blocks. */
function InkBlock({ size, height = size, color }: { size: number; height?: number; color: string }) {
  const ink = useInk(color, true);
  return (
    <RoundedBox
      args={[size, height, size]}
      radius={0.08}
      smoothness={1}
      position={[0, height / 2, 0]}
      material={ink}
    >
      <Outline mode="hull" thickness={0.03} />
      <Outline threshold={20} />
    </RoundedBox>
  );
}

function CoinStack({ count, y }: { count: number; y: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, k) => (
        <Coin key={k} position={[0, y + 0.07 + k * 0.15, 0]} />
      ))}
    </>
  );
}

/** An account: a named place on the chain that holds coins. */
export function AccountBlock({
  position = [0, 0, 0],
  name,
  note,
  color = COLORS.orange,
  size = 1.7,
  coins = 0,
  ...pick
}: BlockProps) {
  const block = (
    <SelectRing selected={!!pick.selected} radius={size * 0.8} color={color}>
      <InkBlock size={size} color={color} />
      <CoinStack count={coins} y={size} />
      <NameLabel height={size + 0.9 + coins * 0.15} depth={size}>
        {note ? `${name} · ${note}` : name}
      </NameLabel>
    </SelectRing>
  );
  return (
    <group position={position}>
      <SoftShadow position={[0, 0, 0.3]} size={[size * 1.9, size * 1.2]} />
      {maybePickable(pick, name, size / 2, block)}
    </group>
  );
}

/** A contract: an account that also holds code. Drawn as a block with a lid and a code plate. */
export function ContractBlock({
  position = [0, 0, 0],
  name,
  note,
  color = COLORS.contract,
  size = 1.7,
  ...pick
}: Omit<BlockProps, "coins">) {
  const lid = useInk(COLORS.paper);
  const block = (
    <SelectRing selected={!!pick.selected} radius={size * 0.8} color={color}>
      <InkBlock size={size} color={color} />
      <mesh position={[0, size + 0.08, 0]} material={lid}>
        <boxGeometry args={[size * 1.08, 0.16, size * 1.08]} />
        <Outline />
      </mesh>
      <mesh position={[0, size * 0.55, size / 2 + 0.01]}>
        <planeGeometry args={[size * 0.55, size * 0.32]} />
        <meshBasicMaterial color={COLORS.paper} />
        <Outline />
      </mesh>
      <Label position={[0, size * 0.55, size / 2 + 0.05]} variant="small">
        {"{ code }"}
      </Label>
      <NameLabel height={size + 1} depth={size}>
        {note ? `${name} · ${note}` : name}
      </NameLabel>
    </SelectRing>
  );
  return (
    <group position={position}>
      <SoftShadow position={[0, 0, 0.3]} size={[size * 1.9, size * 1.2]} />
      {maybePickable(pick, name, size / 2, block)}
    </group>
  );
}

/** A shard: one long slab of the chain. Blocks and accounts sit on it. */
export function ShardSlab({
  position = [0, 0, 0],
  name,
  length = 12.6,
  depth = 2.5,
  color = COLORS.slab,
  ...pick
}: PickProps & { position?: Vec3; name: string; length?: number; depth?: number; color?: string }) {
  const ink = useInk(color);
  const slab = (
    <SelectRing selected={!!pick.selected} radius={0} color={color}>
      <mesh position={[0, 0.16, 0]} material={ink}>
        <boxGeometry args={[length, 0.32, depth]} />
        <Outline />
      </mesh>
      <Label position={[-length / 2 + 0.9, 0.34, depth / 2 + 0.35]} variant="small">
        {name}
      </Label>
    </SelectRing>
  );
  return (
    <group position={position}>
      <SoftShadow position={[0.6, 0, 0.5]} size={[length * 1.2, depth * 1.7]} />
      {maybePickable(pick, name, 0.4, slab)}
    </group>
  );
}

/** Another blockchain (Ethereum, Bitcoin...): three linked blocks on a base. */
export function ChainBlock({
  position = [0, 0, 0],
  name,
  note,
  color = COLORS.chain,
  ...pick
}: Omit<BlockProps, "coins" | "size">) {
  const ink = useInk(color);
  const link = useInk(INK);
  const block = (
    <SelectRing selected={!!pick.selected} radius={1.6} color={color}>
      {[-0.95, 0, 0.95].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]} material={ink}>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <Outline />
        </mesh>
      ))}
      {[-0.475, 0.475].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]} material={link}>
          <boxGeometry args={[0.28, 0.08, 0.08]} />
        </mesh>
      ))}
      <Label position={[0, 1.5, 0]}>{note ? `${name} · ${note}` : name}</Label>
    </SelectRing>
  );
  return (
    <group position={position}>
      <SoftShadow position={[0, 0, 0.2]} size={[3.6, 1.4]} />
      {maybePickable(pick, name, 0.4, block)}
    </group>
  );
}

/** A coin, lying flat. */
export function Coin({ position = [0, 0, 0], color = COLORS.gold }: { position?: Vec3; color?: string }) {
  const ink = useInk(color);
  return (
    <mesh position={position} material={ink}>
      <cylinderGeometry args={[0.42, 0.42, 0.13, 32]} />
      <Outline mode="hull" thickness={0.03} />
      <Outline />
    </mesh>
  );
}

/** A key: a ring, a shaft and two teeth. Stands upright; turn it with `rotation`. */
export function Key({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = COLORS.gold,
  name,
  ...pick
}: PickProps & { position?: Vec3; rotation?: Vec3; color?: string; name?: string }) {
  const ink = useInk(color);
  const key = (
    <group rotation={rotation}>
      <mesh position={[-0.55, 0, 0]} material={ink}>
        <torusGeometry args={[0.3, 0.1, 12, 32]} />
        <Outline mode="hull" thickness={0.025} />
      </mesh>
      <mesh position={[0.2, 0, 0]} material={ink}>
        <boxGeometry args={[0.95, 0.14, 0.14]} />
        <Outline />
      </mesh>
      {[0.42, 0.6].map((x) => (
        <mesh key={x} position={[x, -0.13, 0]} material={ink}>
          <boxGeometry args={[0.1, 0.16, 0.12]} />
          <Outline />
        </mesh>
      ))}
      {name ? <Label position={[0, 0.7, 0]}>{name}</Label> : null}
    </group>
  );
  return <group position={position}>{name && pick.onPick ? maybePickable(pick, name, 0, key) : key}</group>;
}

/** A glow sprite, for travellers and highlights. */
export function Glow({
  color,
  scale = 2.6,
  opacity = 0.9,
}: {
  color: string;
  scale?: number;
  opacity?: number;
}) {
  return (
    <sprite scale={[scale, scale, 1]}>
      <spriteMaterial
        map={glowTexture()}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </sprite>
  );
}

/**
 * A point in the scene that a step's explanation points at (`explainAt` in the manifest). Renders an
 * invisible HTML marker with `data-explain="<name>"` that follows the point on screen.
 */
export function Anchor({ name, position = [0, 0, 0] }: { name: string; position?: Vec3 }) {
  return (
    <Html position={[...position]} zIndexRange={[0, 0]} style={{ pointerEvents: "none" }}>
      <span
        data-explain={name}
        style={{ display: "block", width: 8, height: 8, transform: "translate(-50%, -50%)" }}
      />
    </Html>
  );
}
