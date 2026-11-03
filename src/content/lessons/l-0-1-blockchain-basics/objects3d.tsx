/**
 * 3D objects of lesson 0.1, built from the scene kit's ink pieces: ledgers (notebooks of balances),
 * ledger blocks with a lid, and the hash links between blocks. Loaded only with the 3D view.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Html, RoundedBox } from "@react-three/drei";
import { CanvasTexture, DoubleSide, ExtrudeGeometry, Shape, SRGBColorSpace, type Group } from "three";
import {
  COLORS,
  INK,
  Label,
  Outline,
  Pickable,
  SoftShadow,
  useInk,
  useStage,
  type Vec3,
} from "../../../scene-kit";

// ---------- layout (world units) ----------
export const CHAIN_Z = 1.4;
export const PITCH = 3;
export const BW = 1.5;
export const BH = 0.95;
export const BD = 1.1;
const LID = 0.2;
export const chainX = (i: number, pitch = PITCH) => (i - 1.5) * pitch;

const PAPER = COLORS.paper;
const RED_PAPER = "#f7d3cd";

const noRaycast = () => undefined;

export type TagPlace = "below" | "above" | "left" | "right" | "center";

/** An HTML tag that follows a point. `place` says which side of the point it hangs on. */
export function Tag({
  position,
  place = "below",
  className = "",
  children,
}: {
  position: Vec3;
  place?: TagPlace;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Html position={[...position]} zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
      <div className={`bb3-tag ${place} ${className}`}>{children}</div>
    </Html>
  );
}

/** easeOutBounce, for blocks landing on the chain. */
function bounce(u: number) {
  const n = 7.5625;
  const d = 2.75;
  if (u < 1 / d) return n * u * u;
  if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75;
  if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375;
  return n * (u -= 2.625 / d) * u + 0.984375;
}

/** A ring on the ground under a selected or edited object. */
function Ring({ radius, color = COLORS.orange }: { radius: number; color?: string }) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <mesh raycast={noRaycast}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh raycast={noRaycast}>
        <ringGeometry args={[radius, radius + 0.08, 48]} />
        <meshBasicMaterial color={INK} side={DoubleSide} />
      </mesh>
    </group>
  );
}

/** A gentle up-and-down bob for the object the learner should click next. */
function useBob(on: boolean, reducedMotion: boolean) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = on && !reducedMotion ? 0.12 + Math.sin(clock.elapsedTime * 4) * 0.1 : 0;
  });
  return ref;
}

// ---------- ledgers ----------

/** Size of a ledger (a notebook of balances) at scale 1, in world units. */
export const LEDGER_W = 1.9;
export const LEDGER_D = 1.45;
const LEDGER_H = 0.24;
const OPEN_ANGLE = Math.PI * 0.96;
/** Ledgers lean back on a stand, so their pages face the camera. */
const TILT = 0.5;
const STAND_H = LEDGER_D * Math.sin(TILT);
/** Height of a ledger with its name above it, for framing. */
export const LEDGER_TALL = STAND_H + LEDGER_H + 0.9;

/** One line on a ledger's page. `hot` marks a line that just changed. */
export interface PageRow {
  name: string;
  value: number;
  hot?: boolean;
}

const PAGE_PX = 512;
const PAGE_PY = Math.round((PAGE_PX * LEDGER_D) / LEDGER_W);

/** Draws a ledger's first page: ruled paper with "Balances" and one line per person. */
function drawPage(canvas: HTMLCanvasElement, rows: PageRow[] | null) {
  const c = canvas.getContext("2d");
  if (!c) return;
  const W = canvas.width;
  const H = canvas.height;
  c.fillStyle = PAPER;
  c.fillRect(0, 0, W, H);
  const top = 70;
  const rowH = (H - top - 8) / 3;
  c.fillStyle = "rgba(77,107,255,0.28)";
  for (let k = 0; k <= 3; k++) c.fillRect(0, top + k * rowH - 2, W, 3);
  c.fillStyle = "rgba(255,95,162,0.55)";
  c.fillRect(64, 0, 3, H);
  if (!rows) return;
  c.fillStyle = INK;
  c.textBaseline = "alphabetic";
  c.font = '600 52px "Caveat", cursive';
  c.fillText("Balances", 84, top - 16);
  rows.slice(0, 3).forEach((r, k) => {
    const y = top + k * rowH;
    if (r.hot) {
      c.fillStyle = "rgba(255,138,61,0.45)";
      c.fillRect(68, y + 4, W - 84, rowH - 8);
    }
    c.fillStyle = INK;
    c.textAlign = "left";
    c.font = '600 92px "Caveat", cursive';
    c.fillText(r.name, 84, y + rowH - 18);
    c.textAlign = "right";
    c.font = '700 80px "Newsreader", Georgia, serif';
    c.fillText(String(r.value), W - 36, y + rowH - 18);
  });
  c.textAlign = "left";
}

/** The page as a texture, redrawn when its lines change and once the handwriting font has loaded. */
function usePageTexture(rows: PageRow[] | null) {
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_PX;
    canvas.height = PAGE_PY;
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  const [fonts, setFonts] = useState(0);
  useEffect(() => {
    let live = true;
    const f = typeof document !== "undefined" ? document.fonts : undefined;
    Promise.all([f?.load('600 92px "Caveat"'), f?.load('700 80px "Newsreader"')])
      .then(() => live && setFonts(1))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const key = JSON.stringify(rows);
  useLayoutEffect(() => {
    drawPage(tex.image as HTMLCanvasElement, rows);
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `rows`
  }, [tex, key, fonts]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** The stand a ledger leans on: a wedge as wide as the book, rising from front to back. */
function useStandGeometry() {
  return useMemo(() => {
    const run = LEDGER_D * Math.cos(TILT);
    // Drawn in the y-z plane (shape x = -z), then turned so the extrusion runs along x.
    const shape = new Shape();
    shape.moveTo(-LEDGER_D / 2, 0);
    shape.lineTo(-LEDGER_D / 2 + run, 0);
    shape.lineTo(-LEDGER_D / 2 + run, STAND_H);
    shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth: LEDGER_W * 0.9, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.translate(-LEDGER_W * 0.45, 0, 0);
    return g;
  }, []);
}

/**
 * A person's ledger: a notebook whose first page lists everyone's balances. Its cover swings open to
 * the left and the book slides so the open spread stays centred on `position`. The owner's name
 * floats above it. `rows` is what the page says (null: a blank page).
 */
export function Ledger({
  owner,
  position,
  scale = 1,
  open,
  rows,
  hint = false,
  reducedMotion,
  pick,
}: {
  owner: string;
  position: Vec3;
  scale?: number;
  open: boolean;
  rows: PageRow[] | null;
  hint?: boolean;
  reducedMotion: boolean;
  pick?: { label: string; onPick: () => void };
}) {
  const { flat } = useStage();
  const pages = useInk(PAPER);
  const cover = useInk(COLORS.orange);
  const spine = useInk(INK);
  const page = usePageTexture(rows);
  const standGeo = useStandGeometry();
  const stand = useInk(COLORS.slab);
  const hinge = useRef<Group>(null);
  const slide = useRef<Group>(null);
  const bob = useBob(hint, reducedMotion);
  const W = LEDGER_W;
  const D = LEDGER_D;
  useFrame(() => {
    const h = hinge.current;
    if (!h) return;
    const goal = open ? OPEN_ANGLE : 0;
    const r =
      reducedMotion || Math.abs(goal - h.rotation.z) < 0.002
        ? goal
        : h.rotation.z + (goal - h.rotation.z) * 0.14;
    h.rotation.z = r;
    if (slide.current) slide.current.position.x = (W / 2) * (r / OPEN_ANGLE);
  });
  // The book leans back on its front edge (pivot), resting on the stand.
  const book = (
    <group ref={bob}>
      <mesh geometry={standGeo} material={stand}>
        <Outline />
      </mesh>
      <group position={[0, 0, LEDGER_D / 2]} rotation={[TILT, 0, 0]}>
        <group position={[0, 0, -LEDGER_D / 2]}>
          <mesh position={[0, LEDGER_H * 0.45, 0]} material={pages}>
            <boxGeometry args={[W, LEDGER_H * 0.9, D]} />
            <Outline />
          </mesh>
          <mesh position={[0, LEDGER_H * 0.9 + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <planeGeometry args={[W * 0.97, D * 0.96]} />
            <meshBasicMaterial map={page} toneMapped={false} />
          </mesh>
          <mesh position={[-W / 2 - 0.04, LEDGER_H * 0.5, 0]} material={spine}>
            <boxGeometry args={[0.09, LEDGER_H + 0.02, D + 0.05]} />
          </mesh>
          <group ref={hinge} position={[-W / 2, LEDGER_H + 0.01, 0]}>
            <mesh position={[W / 2, 0.02, 0]} material={cover}>
              <boxGeometry args={[W + 0.05, 0.05, D + 0.05]} />
              <Outline />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
  return (
    <group position={position} scale={scale}>
      <group ref={slide}>
        <SoftShadow position={[-W * 0.25, 0, 0.12]} size={[W * 2.6, D * 1.5]} />
        {pick && open ? <Ring radius={W * 0.62} /> : null}
        {pick ? (
          <Pickable label={pick.label} selected={open} onPick={pick.onPick} anchor={[0, STAND_H, 0]}>
            {book}
          </Pickable>
        ) : (
          book
        )}
      </group>
      <Label
        position={flat ? [0, 0, -D / 2 - 0.45] : [0, STAND_H + LEDGER_H + 0.55, -D * 0.35]}
      >{`${owner}'s ledger`}</Label>
    </group>
  );
}

// ---------- ledger blocks ----------

/**
 * A block of the ledger: a paper box with an orange lid. `open` lifts the lid, `bad` turns it red (its
 * stored link is broken), `drop` makes it fall onto the chain when it first appears.
 */
export function LedgerBlock({
  position,
  scale = 1,
  open = false,
  bad = false,
  ring = false,
  hint = false,
  drop = false,
  reducedMotion,
  pick,
  children,
}: {
  position: Vec3;
  scale?: number;
  open?: boolean;
  bad?: boolean;
  ring?: boolean;
  hint?: boolean;
  drop?: boolean;
  reducedMotion: boolean;
  pick?: { label: string; onPick: () => void; selected: boolean };
  /** Tags that hang off the block (its card). */
  children?: ReactNode;
}) {
  const body = useInk(bad ? RED_PAPER : PAPER, true);
  const lidInk = useInk(bad ? COLORS.red : COLORS.orange);
  const lid = useRef<Group>(null);
  const fall = useRef<Group>(null);
  const bob = useBob(hint, reducedMotion);
  // Remember whether to drop at mount only: later renders never restart the fall.
  const [falling] = useState(() => drop && !reducedMotion);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const l = lid.current;
    if (l) {
      // The lid swings open on its back edge.
      const r = open ? -1.9 : 0;
      l.rotation.x += (r - l.rotation.x) * (reducedMotion ? 1 : 0.15);
    }
    const f = fall.current;
    if (f && falling) {
      if (t0.current === null) t0.current = clock.elapsedTime;
      const u = Math.min(1, (clock.elapsedTime - t0.current) / 0.8);
      f.position.y = 5 * (1 - bounce(u));
    }
  });
  const edge = bad ? COLORS.red : INK;
  const box = (
    <group ref={bob}>
      <RoundedBox
        args={[BW, BH - LID, BD]}
        radius={0.06}
        smoothness={1}
        position={[0, (BH - LID) / 2, 0]}
        material={body}
      >
        <Outline mode="hull" thickness={0.025} />
        <Edges threshold={20} lineWidth={1.6} color={edge} />
      </RoundedBox>
      <group ref={lid} position={[0, BH - LID / 2, -BD / 2]}>
        <mesh position={[0, 0, BD / 2]} material={lidInk}>
          <boxGeometry args={[BW + 0.06, LID, BD + 0.06]} />
          <Edges threshold={20} lineWidth={1.6} color={INK} />
        </mesh>
      </group>
    </group>
  );
  return (
    <group position={position} scale={scale}>
      <group ref={fall} position={[0, falling ? 5 : 0, 0]}>
        <SoftShadow position={[0, 0, 0.2]} size={[BW * 1.9, BD * 1.6]} />
        {ring || pick?.selected ? <Ring radius={1.05} /> : null}
        {pick ? (
          <Pickable label={pick.label} selected={pick.selected} onPick={pick.onPick} anchor={[0, BH / 2, 0]}>
            {box}
          </Pickable>
        ) : (
          box
        )}
        {children}
      </group>
    </group>
  );
}

/**
 * The transaction slip inside an open block: a sheet of paper that rises out of the box and turns to
 * face the camera. `children` hang above it (the pop-up card), `lift` world units higher on an ink
 * stalk, so the card can clear whatever stands behind the block.
 */
export function Slip({
  reducedMotion,
  lift = 0.3,
  children,
}: {
  reducedMotion: boolean;
  lift?: number;
  children?: ReactNode;
}) {
  const paper = useInk(PAPER);
  const ink = useInk(INK);
  const ref = useRef<Group>(null);
  const top = BH + 0.55;
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const k = reducedMotion ? 1 : 0.12;
    g.position.y += (top - g.position.y) * k;
    g.rotation.x += (-1.1 - g.rotation.x) * k;
  });
  return (
    <>
      <group
        ref={ref}
        position={[0, reducedMotion ? top : BH * 0.5, 0]}
        rotation={[reducedMotion ? -1.1 : -Math.PI / 2, 0, 0]}
      >
        <mesh material={paper}>
          <boxGeometry args={[BW * 0.62, 0.025, BD * 0.5]} />
          <Outline />
        </mesh>
        {[-0.1, 0.06].map((z) => (
          <mesh key={z} position={[0, 0.014, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <planeGeometry args={[BW * 0.45, 0.03]} />
            <meshBasicMaterial color={COLORS.blue} transparent opacity={0.55} />
          </mesh>
        ))}
      </group>
      {children && lift > 0.4 ? (
        <mesh position={[0, top + 0.2 + (lift - 0.2) / 2, 0]} material={ink} raycast={noRaycast}>
          <boxGeometry args={[0.04, lift - 0.2, 0.04]} />
        </mesh>
      ) : null}
      {children ? (
        <Tag position={[0, top + lift, 0]} place="above" className="pop">
          {children}
        </Tag>
      ) : null}
    </>
  );
}

/** Where a block's card hangs: under the front of the block. */
export const CARD_AT: Vec3 = [0, 0.02, BD / 2 + 0.05];

// ---------- hash links ----------

/**
 * The link from a block back to the block before it: an ink rod with an arrowhead pointing at the
 * previous block. When the stored hash is wrong it turns red and cracks in two.
 */
export function HashLink({
  from,
  to,
  ok,
  faint = false,
  scale = 1,
  reducedMotion,
  children,
}: {
  /** Centre of the previous block (the arrow points here). */
  from: Vec3;
  /** Centre of this block. */
  to: Vec3;
  ok: boolean;
  faint?: boolean;
  scale?: number;
  reducedMotion: boolean;
  children?: ReactNode;
}) {
  const ink = useInk(ok ? (faint ? "#8d8778" : INK) : COLORS.red);
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  // The rod runs between the two blocks' faces, a little off each one.
  const halfBlock = (Math.abs(dx) >= Math.abs(dz) ? BW / 2 : BD / 2) * scale + 0.05;
  const len = Math.hypot(dx, dz) - 2 * halfBlock;
  const mid: Vec3 = [(from[0] + to[0]) / 2, (BH / 2) * scale, (from[2] + to[2]) / 2];
  // Local +x runs from the previous block to this one.
  const yaw = Math.atan2(-dz, dx);
  const a = useRef<Group>(null);
  const b = useRef<Group>(null);
  const crackT = useRef<number | null>(null);
  const wasOk = useRef(ok);
  useLayoutEffect(() => {
    if (wasOk.current && !ok) crackT.current = -1;
    wasOk.current = ok;
  }, [ok]);
  useFrame(({ clock }) => {
    if (!a.current || !b.current) return;
    let shake = 0;
    if (crackT.current !== null && !reducedMotion) {
      if (crackT.current < 0) crackT.current = clock.elapsedTime;
      const u = (clock.elapsedTime - crackT.current) / 0.6;
      if (u >= 1) crackT.current = null;
      else shake = Math.sin(u * 40) * 0.12 * (1 - u);
    }
    const tilt = ok ? 0 : 0.22;
    a.current.rotation.z = -tilt + shake;
    b.current.rotation.z = tilt - shake;
  });
  const half = ok ? len / 2 : len / 2 - 0.14;
  const rod = 0.09 * Math.max(0.8, scale);
  return (
    <group position={mid} rotation={[0, yaw, 0]}>
      {/* Left half, with the arrowhead at the previous block. Hinged at its outer end. */}
      <group ref={a} position={[-len / 2, 0, 0]}>
        <mesh position={[half / 2, 0, 0]} material={ink} raycast={noRaycast}>
          <boxGeometry args={[half, rod, rod]} />
        </mesh>
        <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={ink} raycast={noRaycast}>
          <coneGeometry args={[0.16 * Math.max(0.8, scale), 0.3, 16]} />
        </mesh>
      </group>
      <group ref={b} position={[len / 2, 0, 0]}>
        <mesh position={[-half / 2, 0, 0]} material={ink} raycast={noRaycast}>
          <boxGeometry args={[half, rod, rod]} />
        </mesh>
      </group>
      {ok ? null : <Crack />}
      {children}
    </group>
  );
}

/** A jagged red crack where a link broke. */
function Crack() {
  const red = useInk(COLORS.red);
  const pts: [number, number][] = [
    [-0.05, 0.42],
    [0.08, 0.16],
    [-0.08, -0.04],
    [0.07, -0.26],
    [-0.04, -0.44],
  ];
  return (
    <group>
      {pts.slice(1).map(([x, y], i) => {
        const [px, py] = pts[i]!;
        const dx = x - px;
        const dy = y - py;
        return (
          <mesh
            key={i}
            position={[(x + px) / 2, (y + py) / 2, 0]}
            rotation={[0, 0, Math.atan2(dy, dx)]}
            material={red}
            raycast={noRaycast}
          >
            <boxGeometry args={[Math.hypot(dx, dy) + 0.03, 0.05, 0.05]} />
          </mesh>
        );
      })}
    </group>
  );
}
