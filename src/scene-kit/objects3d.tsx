/**
 * The scene objects in 3D (docs/scene-objects.md): one shape per concept. Account = mailbox,
 * transaction = parcel with a stamp (the signature) and action cards inside, contract = scroll with a
 * gear, function-call key = key with a tag. Every object takes a `state` (ok, pending, failed, gone) and
 * draws it the same way, so lessons never restyle objects.
 */
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { MeshBasicMaterial, Shape, type Group } from "three";
import {
  Coin,
  Key,
  Label,
  NameLabel,
  Outline,
  SelectRing,
  SoftShadow,
  maybePickable,
  useInk,
  type PickProps,
} from "./primitives";
import { useStage } from "./context";
import type { Vec3 } from "./motion";
import { COLORS, INK } from "./theme";
import {
  itemSlots,
  lookOf,
  mailboxDims,
  parcelDims,
  ribbonOutline,
  screenDims,
  scrollDims,
  slipDims,
  type ObjectLook,
  type ObjectState,
} from "./objects";

const HIDDEN = new MeshBasicMaterial({ visible: false });

/** Fill of a secondary part: its own colour, grey when gone, none when pending. */
function partFill(look: ObjectLook, own: string): string | null {
  if (look.fill === null) return null;
  if (look.struck) return COLORS.slab;
  return own;
}

/** One inked part. Without a fill it is a dashed outline only (an object that does not exist yet). */
function Part({
  fill,
  dashed,
  position,
  rotation,
  hull = false,
  threshold = 20,
  children,
}: {
  fill: string | null;
  dashed: boolean;
  position?: Vec3;
  rotation?: Vec3;
  hull?: boolean;
  threshold?: number;
  children: ReactNode;
}) {
  const ink = useInk(fill ?? COLORS.paper);
  return (
    <mesh position={position} rotation={rotation} material={fill ? ink : HIDDEN}>
      {children}
      {hull && !dashed ? <Outline mode="hull" thickness={0.025} /> : null}
      <Outline threshold={threshold} dashed={dashed} />
    </mesh>
  );
}

/** A red cross in front of an object: refused or failed. (x, y, z) is its middle. */
export function Cross({ at, size }: { at: Vec3; size: number }) {
  const red = useInk(COLORS.red);
  return (
    <group position={at}>
      {[Math.PI / 4, -Math.PI / 4].map((r) => (
        <mesh key={r} rotation={[0, 0, r]} material={red}>
          <boxGeometry args={[size, size * 0.12, 0.05]} />
          <Outline />
        </mesh>
      ))}
    </group>
  );
}

/** An ink line through an object: deleted or revoked. */
export function Strike({ at, size }: { at: Vec3; size: number }) {
  const ink = useInk(INK);
  return (
    <mesh position={at} rotation={[0, 0, Math.PI / 9]} material={ink}>
      <boxGeometry args={[size, size * 0.06, 0.04]} />
    </mesh>
  );
}

/** The marks a state adds on top of the object. */
function StateMarks({ look, at, size }: { look: ObjectLook; at: Vec3; size: number }) {
  if (look.cross) return <Cross at={at} size={size} />;
  if (look.struck) return <Strike at={at} size={size * 1.2} />;
  return null;
}

interface ObjectProps extends PickProps {
  position?: Vec3;
  state?: ObjectState;
  /** Accent: the stage colour or the colour that marks "this one matters now". */
  color?: string;
}

// ---------- account: a mailbox ----------

/**
 * An account: a mailbox on a post, its name above it. `flag` raises the flag (something arrived).
 * `coins` stand on the ground beside the post. Pending: a dashed outline (not created yet).
 */
export function Mailbox({
  position = [0, 0, 0],
  name,
  note,
  size = 1.6,
  color = COLORS.orange,
  coins = 0,
  flag = false,
  state = "ok",
  ...pick
}: ObjectProps & { name: string; note?: string; size?: number; coins?: number; flag?: boolean }) {
  const d = mailboxDims(size);
  const look = lookOf(state, color);
  const dashed = look.dashed;
  const r = d.width / 2;
  const post = size * 0.1;
  const flagUp = flag && state === "ok";
  const box = (
    <SelectRing selected={!!pick.selected} radius={size * 0.55} color={color}>
      {/* Post. */}
      <Part fill={partFill(look, COLORS.paper)} dashed={dashed} position={[0, d.post / 2, 0]}>
        <boxGeometry args={[post, d.post, post]} />
      </Part>
      {/* Box and its round roof. */}
      <Part fill={look.fill} dashed={dashed} position={[0, d.bodyY, 0]}>
        <boxGeometry args={[d.width, d.body, d.depth]} />
      </Part>
      <Part
        fill={look.fill}
        dashed={dashed}
        position={[0, d.post + d.body, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        hull
        threshold={30}
      >
        <cylinderGeometry args={[r, r, d.depth, 20, 1, false, -Math.PI / 2, Math.PI]} />
      </Part>
      {/* The door: a paper plate on the front. */}
      <Part
        fill={partFill(look, COLORS.paper)}
        dashed={dashed}
        position={[0, d.bodyY + d.body * 0.15, d.depth / 2 + 0.012]}
      >
        <boxGeometry args={[d.width * 0.72, d.body * 0.55, 0.02]} />
      </Part>
      {/* The flag on the right side: up when something arrived. */}
      <group position={[r + 0.03, d.bodyY, -d.depth * 0.15]} rotation={[flagUp ? 0 : Math.PI / 2, 0, 0]}>
        <Part fill={partFill(look, COLORS.red)} dashed={dashed} position={[0, d.body * 0.9, 0]}>
          <boxGeometry args={[0.03, d.body * 1.8, 0.05]} />
        </Part>
        <Part fill={partFill(look, COLORS.red)} dashed={dashed} position={[0, d.body * 1.55, d.depth * 0.12]}>
          <boxGeometry args={[0.03, d.body * 0.55, d.depth * 0.22]} />
        </Part>
      </group>
      {Array.from({ length: coins }, (_, k) => (
        <group key={k} scale={0.7}>
          <Coin position={[(d.width * 0.9) / 0.7, (0.07 + k * 0.15) / 0.7, (d.depth * 0.25) / 0.7]} />
        </group>
      ))}
      <StateMarks look={look} at={[0, d.bodyY, d.depth / 2 + 0.06]} size={d.width * 1.1} />
      <NameLabel height={d.height + 0.7} depth={d.depth}>
        {note ? `${name} · ${note}` : name}
      </NameLabel>
    </SelectRing>
  );
  return (
    <group position={position}>
      {dashed ? null : <SoftShadow position={[0, 0, 0.2]} size={[size * 1.2, size * 0.9]} />}
      {maybePickable(pick, name, d.bodyY, box)}
    </group>
  );
}

// ---------- signature: a stamp ----------

/**
 * A stamp, lying in the x-y plane (facing +z): the sender's mark. A coloured square with a paper middle
 * and an ink postmark ring across it. `broken` tears it: the parcel was changed after it was stamped.
 */
export function Stamp({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size = 0.34,
  color = COLORS.orange,
  broken = false,
}: {
  position?: Vec3;
  rotation?: Vec3;
  size?: number;
  color?: string;
  broken?: boolean;
}) {
  const ink = useInk(INK);
  return (
    <group position={position} rotation={rotation}>
      <Part fill={broken ? COLORS.red : color} dashed={false}>
        <boxGeometry args={[size, size * 1.15, 0.015]} />
      </Part>
      <Part fill={COLORS.paper} dashed={false} position={[0, 0, 0.01]}>
        <boxGeometry args={[size * 0.7, size * 0.8, 0.01]} />
      </Part>
      <mesh position={[size * 0.28, -size * 0.2, 0.025]} material={ink}>
        <torusGeometry args={[size * 0.36, size * 0.035, 6, 28]} />
      </mesh>
      {broken ? <Strike at={[0, 0, 0.04]} size={size * 1.2} /> : null}
    </group>
  );
}

// ---------- transaction: a parcel ----------

/** What happened to one action of a transaction. */
export type ActionFate = "idle" | "done" | "undone" | "failed" | "skipped";

export const FATE_FILL: Record<ActionFate, string> = {
  idle: COLORS.paper,
  done: COLORS.greenTint,
  undone: COLORS.slab,
  failed: COLORS.redTint,
  skipped: COLORS.slab,
};

/** A mark after an action's name: done, undone, failed, never ran. */
export const FATE_MARK: Record<ActionFate, string> = {
  idle: "",
  done: "✓",
  undone: "↺",
  failed: "✗",
  skipped: "–",
};

export interface ParcelItem {
  key: string;
  text: string;
  fate: ActionFate;
}

/**
 * A transaction: a parcel addressed to one receiver (`to`), stamped when signed, with its actions packed
 * inside. `open` lifts the flaps and stands the action cards above the box, first action on top, so the
 * learner can see what it carries. Failed: a red cross.
 */
export function Parcel({
  position = [0, 0, 0],
  size = 1.2,
  color = COLORS.orange,
  to,
  stamped = false,
  stampBroken = false,
  open = false,
  items = [],
  maxItems = 4,
  state = "ok",
  name = "transaction",
  ...pick
}: ObjectProps & {
  size?: number;
  /** The address label: the receiver. */
  to?: string;
  stamped?: boolean;
  /** The parcel was changed after it was stamped: the signature no longer matches. */
  stampBroken?: boolean;
  open?: boolean;
  items?: ParcelItem[];
  maxItems?: number;
  name?: string;
}) {
  const { reducedMotion } = useStage();
  const d = parcelDims(size);
  const look = lookOf(state, COLORS.kraft);
  const dashed = look.dashed;
  const flaps = useRef<[Group | null, Group | null]>([null, null]);
  const target = open ? Math.PI * 0.72 : 0;
  useLayoutEffect(() => {
    if (!reducedMotion) return;
    flaps.current.forEach((f, i) => f && (f.rotation.z = i === 0 ? target : -target));
  }, [reducedMotion, target]);
  useFrame((_, dt) => {
    flaps.current.forEach((f, i) => {
      if (!f) return;
      const goal = i === 0 ? target : -target;
      const k = reducedMotion ? 1 : Math.min(1, dt * 8);
      f.rotation.z += (goal - f.rotation.z) * k;
    });
  });
  const slots = open ? itemSlots(items.length, maxItems) : [];
  const tape = partFill(look, color);
  const body = (
    <SelectRing selected={!!pick.selected} radius={size * 0.75} color={color}>
      <Part fill={look.fill} dashed={dashed} position={[0, d.height / 2, 0]}>
        <boxGeometry args={[d.width, d.height, d.depth]} />
      </Part>
      {/* Two flaps on top, hinged at the long edges. */}
      {[-1, 1].map((side, i) => (
        <group
          key={side}
          position={[(side * d.width) / 2, d.height + 0.012, 0]}
          ref={(g) => {
            flaps.current[i] = g;
          }}
        >
          <Part fill={look.fill} dashed={dashed} position={[(-side * d.width) / 4, 0, 0]}>
            <boxGeometry args={[d.width / 2, 0.025, d.depth]} />
          </Part>
        </group>
      ))}
      {/* Tape across the closed lid. */}
      {!open ? (
        <Part fill={tape} dashed={dashed} position={[0, d.height + 0.03, 0]}>
          <boxGeometry args={[size * 0.14, 0.02, d.depth + 0.01]} />
        </Part>
      ) : null}
      {/* The address label on the front. */}
      {to ? (
        <>
          <Part
            fill={partFill(look, COLORS.paper)}
            dashed={dashed}
            position={[-d.width * 0.12, d.height * 0.45, d.depth / 2 + 0.01]}
          >
            <boxGeometry args={[d.width * 0.56, d.height * 0.36, 0.015]} />
          </Part>
          <Label position={[-d.width * 0.12, d.height * 0.45, d.depth / 2 + 0.05]} variant="small">
            {`to ${to}`}
          </Label>
        </>
      ) : null}
      {stamped && !dashed ? (
        <Stamp
          position={[d.width * 0.32, d.height * 0.66, d.depth / 2 + 0.012]}
          size={size * 0.26}
          color={color}
          broken={stampBroken}
        />
      ) : null}
      {slots.map((s, i) => (
        <ActionCard
          key={items[i]!.key}
          position={[0, d.height + s.y, s.z]}
          width={d.width * 1.15}
          item={items[i]!}
          number={i + 1}
        />
      ))}
      {open && items.length > maxItems ? (
        <Label position={[0, d.height + itemSlots(maxItems, maxItems)[0]!.y + 0.38, 0]} variant="small">
          {`+${items.length - maxItems} more`}
        </Label>
      ) : null}
      <StateMarks look={look} at={[0, d.height / 2, d.depth / 2 + 0.08]} size={d.height} />
    </SelectRing>
  );
  return (
    <group position={position}>
      {dashed ? null : <SoftShadow position={[0, 0, 0.2]} size={[size * 1.7, size * 1.1]} />}
      {maybePickable(pick, name, d.height / 2, body)}
    </group>
  );
}

/** One action packed in a parcel: a card standing up, coloured by its fate, its name on it. */
export function ActionCard({
  position,
  width,
  item,
  number,
}: {
  position: Vec3;
  width: number;
  item: ParcelItem;
  number: number;
}) {
  const ink = useInk(FATE_FILL[item.fate]);
  const mark = FATE_MARK[item.fate];
  return (
    <group position={position}>
      <mesh material={ink}>
        <boxGeometry args={[width, 0.32, 0.04]} />
        <Outline />
      </mesh>
      <Label position={[0, 0, 0.04]} variant="small">
        {`${number} ${item.text}${mark ? ` ${mark}` : ""}`}
      </Label>
    </group>
  );
}

// ---------- contract: a scroll that runs code ----------

/**
 * A contract: a scroll standing on the page, with lines of rules on it and a gear on its seal (the sign
 * that it runs as code). `running` turns the gear. Failed: red cross (the call panicked).
 */
export function Scroll({
  position = [0, 0, 0],
  name,
  note,
  size = 1.6,
  color = COLORS.contract,
  running = false,
  state = "ok",
  ...pick
}: ObjectProps & { name: string; note?: string; size?: number; running?: boolean }) {
  const d = scrollDims(size);
  const look = lookOf(state, color);
  const dashed = look.dashed;
  const { reducedMotion } = useStage();
  const gear = useRef<Group>(null);
  useFrame((_, dt) => {
    if (gear.current && running && !reducedMotion) gear.current.rotation.z -= dt * 2.2;
  });
  const sheetH = d.height - d.roller * 4;
  const lines = [0.26, 0.12, -0.02, -0.16].map((f) => f * d.height);
  const body = (
    <SelectRing selected={!!pick.selected} radius={size * 0.55} color={color}>
      <group rotation={[-0.12, 0, 0]}>
        {/* The sheet. */}
        <Part fill={partFill(look, COLORS.paper)} dashed={dashed} position={[0, d.height / 2, 0]}>
          <boxGeometry args={[d.width, sheetH, 0.03]} />
        </Part>
        {/* Rollers top and bottom. */}
        {[d.roller, d.height - d.roller].map((y) => (
          <Part
            key={y}
            fill={look.fill}
            dashed={dashed}
            position={[0, y, 0]}
            rotation={[0, 0, Math.PI / 2]}
            hull
            threshold={40}
          >
            <cylinderGeometry args={[d.roller, d.roller, d.width * 1.14, 16]} />
          </Part>
        ))}
        {/* Lines of rules. */}
        {dashed
          ? null
          : lines.map((y, i) => (
              <Part key={y} fill={INK} dashed={false} position={[-d.width * 0.04, d.height / 2 + y, 0.02]}>
                <boxGeometry args={[d.width * (i === 3 ? 0.4 : 0.66), 0.025, 0.005]} />
              </Part>
            ))}
        {/* The gear on the seal: it turns while the contract runs. */}
        <group position={[d.width * 0.22, d.height * 0.34, 0.05]}>
          <group ref={gear}>
            <Part fill={partFill(look, COLORS.gold)} dashed={dashed} rotation={[Math.PI / 2, 0, 0]} hull>
              <cylinderGeometry args={[d.gear, d.gear, 0.05, 20]} />
            </Part>
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k / 8) * Math.PI * 2;
              return (
                <Part
                  key={k}
                  fill={partFill(look, COLORS.gold)}
                  dashed={dashed}
                  position={[Math.cos(a) * d.gear * 1.12, Math.sin(a) * d.gear * 1.12, 0]}
                  rotation={[0, 0, a]}
                >
                  <boxGeometry args={[d.gear * 0.4, d.gear * 0.32, 0.05]} />
                </Part>
              );
            })}
          </group>
        </group>
        <StateMarks look={look} at={[0, d.height / 2, 0.1]} size={d.width} />
      </group>
      <NameLabel height={d.height + 0.75} depth={0.4}>
        {note ? `${name} · ${note}` : name}
      </NameLabel>
    </SelectRing>
  );
  return (
    <group position={position}>
      {dashed ? null : <SoftShadow position={[0, 0, 0.2]} size={[size * 1.2, size * 0.7]} />}
      {maybePickable(pick, name, d.height / 2, body)}
    </group>
  );
}

// ---------- function-call key: a key with a tag ----------

/**
 * A function-call key: a key with a paper tag on a string. The tag names what the key may call (`tag`)
 * and shows the allowance left as a gauge (`share`, 0..1). Gone: grey and struck out (revoked).
 */
export function TaggedKey({
  position = [0, 0, 0],
  rotation = [0, 0.3, -0.2],
  color = COLORS.gold,
  tag,
  share = 1,
  name,
  state = "ok",
  ...pick
}: ObjectProps & { rotation?: Vec3; tag: string; share?: number; name?: string }) {
  const look = lookOf(state, color);
  const keyColor = look.struck ? COLORS.slab : color;
  const ring: Vec3 = [-0.55, 0, 0];
  const tagAt: Vec3 = [-0.6, -0.78, 0.1];
  const w = 0.62;
  const bar = Math.max(0, Math.min(1, share));
  const ink = useInk(INK);
  const node = (
    <group>
      <Key rotation={rotation} color={keyColor} />
      <Line points={[ring, [tagAt[0], tagAt[1] + 0.2, tagAt[2]]]} color={INK} lineWidth={1.4} />
      <group position={tagAt}>
        <Part fill={COLORS.paper} dashed={false}>
          <boxGeometry args={[w + 0.12, 0.4, 0.02]} />
        </Part>
        <mesh position={[0, 0.2, 0.012]} material={ink}>
          <circleGeometry args={[0.03, 12]} />
        </mesh>
        {/* The allowance gauge. */}
        <Part fill={COLORS.slab} dashed={false} position={[0, -0.09, 0.015]}>
          <boxGeometry args={[w, 0.07, 0.01]} />
        </Part>
        {bar > 0 ? (
          <Part fill={color} dashed={false} position={[(-w * (1 - bar)) / 2, -0.09, 0.022]}>
            <boxGeometry args={[w * bar, 0.07, 0.01]} />
          </Part>
        ) : null}
        <Label position={[0, 0.06, 0.04]} variant="small">
          {tag}
        </Label>
      </group>
      <StateMarks look={look} at={[0, -0.2, 0.2]} size={1.2} />
      {name ? <Label position={[0, 0.7, 0]}>{name}</Label> : null}
    </group>
  );
  return <group position={position}>{name && pick.onPick ? maybePickable(pick, name, 0, node) : node}</group>;
}

// ---------- app: a screen on a stand ----------

/**
 * An app: a screen on a small stand, with a title bar in the accent colour and a few lines of content.
 * The thing that can hold a key and sign with it (a game, a website, a bot). Hacked: red cross.
 */
export function AppScreen({
  position = [0, 0, 0],
  name,
  note,
  size = 1.6,
  color = COLORS.blue,
  state = "ok",
  ...pick
}: ObjectProps & { name: string; note?: string; size?: number }) {
  const d = screenDims(size);
  const look = lookOf(state, color);
  const dashed = look.dashed;
  const y = d.stand + d.height / 2;
  const body = (
    <SelectRing selected={!!pick.selected} radius={size * 0.55} color={color}>
      {/* Stand: a foot and a neck. */}
      <Part fill={partFill(look, COLORS.paper)} dashed={dashed} position={[0, 0.03, 0]}>
        <boxGeometry args={[d.width * 0.5, 0.06, size * 0.3]} />
      </Part>
      <Part fill={partFill(look, COLORS.paper)} dashed={dashed} position={[0, d.stand / 2, -0.04]}>
        <boxGeometry args={[size * 0.08, d.stand, size * 0.06]} />
      </Part>
      <group position={[0, y, 0]} rotation={[-0.12, 0, 0]}>
        {/* Frame and screen. */}
        <Part fill={partFill(look, INK)} dashed={dashed}>
          <boxGeometry args={[d.width, d.height, 0.08]} />
        </Part>
        <Part fill={partFill(look, COLORS.paper)} dashed={dashed} position={[0, -d.height * 0.06, 0.045]}>
          <boxGeometry args={[d.width * 0.9, d.height * 0.72, 0.01]} />
        </Part>
        {/* Title bar. */}
        <Part fill={look.fill} dashed={dashed} position={[0, d.height * 0.37, 0.045]}>
          <boxGeometry args={[d.width * 0.9, d.height * 0.14, 0.012]} />
        </Part>
        {dashed
          ? null
          : [0.12, -0.06, -0.24].map((f, i) => (
              <Part
                key={f}
                fill={COLORS.slab}
                dashed={false}
                position={[-d.width * (i === 2 ? 0.17 : 0.05), d.height * f, 0.055]}
              >
                <boxGeometry args={[d.width * (i === 2 ? 0.45 : 0.7), d.height * 0.08, 0.008]} />
              </Part>
            ))}
        <StateMarks look={look} at={[0, 0, 0.12]} size={d.height * 0.9} />
      </group>
      <NameLabel height={d.total + 0.7} depth={0.4}>
        {note ? `${name} · ${note}` : name}
      </NameLabel>
    </SelectRing>
  );
  return (
    <group position={position}>
      {dashed ? null : <SoftShadow position={[0, 0, 0.2]} size={[size * 1.3, size * 0.7]} />}
      {maybePickable(pick, name, y, body)}
    </group>
  );
}

// ---------- receipt: a delivery slip ----------

/**
 * A receipt: a small delivery slip standing on the page, a stripe of the accent colour across its top and
 * its top right corner folded over. What an action becomes when it moves on to another account (and
 * maybe another shard). `refund` is the slip that carries unused gas back: it shows a return arrow and a
 * plain stripe. `fate` tints it like an action card (done ✓, failed ✗). `label` is a short tag above it.
 */
export function ReceiptSlip({
  position = [0, 0, 0],
  size = 0.8,
  color = COLORS.pink,
  refund = false,
  fate = "idle",
  label,
  state = "ok",
  ...pick
}: ObjectProps & { size?: number; refund?: boolean; fate?: ActionFate; label?: string }) {
  const d = slipDims(size);
  const look = lookOf(state, color);
  const dashed = look.dashed;
  const y = d.height / 2 + 0.02;
  const mark = refund ? "↩" : FATE_MARK[fate];
  const tag = [label, mark].filter(Boolean).join(" ");
  const name = pick.pickLabel ?? (refund ? "Refund receipt" : "Receipt");
  const body = (
    <SelectRing selected={!!pick.selected} radius={size * 0.45} color={color}>
      <group position={[0, y, 0]} rotation={[-0.18, 0, 0]}>
        <Part fill={partFill(look, FATE_FILL[fate])} dashed={dashed}>
          <boxGeometry args={[d.width, d.height, d.depth]} />
        </Part>
        {/* The stripe: the accent colour, plain grey on a refund. */}
        <Part
          fill={partFill(look, refund ? COLORS.slab : (look.fill ?? color))}
          dashed={dashed}
          position={[-d.fold / 2, d.height * 0.3, d.depth / 2 + 0.004]}
        >
          <boxGeometry args={[d.width - d.fold - 0.02, d.height * 0.14, 0.006]} />
        </Part>
        {/* Two lines of writing. */}
        {dashed
          ? null
          : [-0.02, -0.24].map((f) => (
              <Part
                key={f}
                fill={COLORS.slab}
                dashed={false}
                position={[0, d.height * f, d.depth / 2 + 0.004]}
              >
                <boxGeometry args={[d.width * 0.7, d.height * 0.07, 0.004]} />
              </Part>
            ))}
        {/* The folded corner. */}
        <Part
          fill={partFill(look, COLORS.paper)}
          dashed={dashed}
          position={[d.width / 2 - d.fold / 2, d.height / 2 - d.fold / 2, d.depth / 2 + 0.008]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <boxGeometry args={[d.fold * 0.7, d.fold * 0.7, 0.006]} />
        </Part>
        <StateMarks look={look} at={[0, 0, d.depth + 0.04]} size={d.height * 0.9} />
      </group>
      {tag ? (
        <Label position={[0, d.height + 0.22, 0]} variant="small">
          {tag}
        </Label>
      ) : null}
    </SelectRing>
  );
  return (
    <group position={position}>
      {dashed ? null : <SoftShadow position={[0, 0, 0.08]} size={[d.width * 1.3, d.width * 0.5]} />}
      {maybePickable(pick, name, y, body)}
    </group>
  );
}

// ---------- shard: a ribbon ----------

/**
 * A shard: one ribbon lying flat on the page along x, a swallowtail notch at its left end where its name
 * is written. A section of the book: each row of chunks sits on its shard's ribbon. `color` is the
 * ribbon's cloth (the accent for the shards that matter now); `selected` lifts it a little.
 */
export function ShardRibbon({
  position = [0, 0, 0],
  length,
  width,
  name,
  color = COLORS.slab,
  ...pick
}: PickProps & { position?: Vec3; length: number; width: number; name: string; color?: string }) {
  const shape = useMemo(() => {
    const s = new Shape();
    ribbonOutline(length, width).forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    s.closePath();
    return s;
  }, [length, width]);
  const ink = useInk(color);
  const lift = pick.selected ? 0.05 : 0;
  const notch = Math.min(width * 0.6, length * 0.1);
  const body = (
    <group position={[0, lift, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ink}>
        <extrudeGeometry args={[shape, { depth: 0.025, bevelEnabled: false }]} />
        <Outline threshold={30} />
      </mesh>
      {/* The name is centred on its point: keep it clear of the notch. */}
      <Label position={[-length / 2 + notch + 0.5, 0.06, 0]} variant="small">
        {name}
      </Label>
    </group>
  );
  return <group position={position}>{maybePickable(pick, name, 0.1, body)}</group>;
}
