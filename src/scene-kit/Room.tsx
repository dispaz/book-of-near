import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Edges } from "@react-three/drei";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Mesh, type Texture } from "three";
import { ROOM, type RoomLayout } from "./roomLayout";
import {
  ceiling,
  deskLight,
  deskPlant,
  floor,
  frontWall,
  landscape,
  leftWall,
  mullions,
  paintSurface,
  rightWall,
  windowWall,
} from "./roomPaint";
import { INK } from "./theme";

const noRaycast = () => undefined;
const BOOK_PART = { book: true };

/**
 * How much each surface is blurred (see paintSurface): the landscape far outside most, the walls a
 * little, the window frame and the plant on the desk least, as a camera focused on the book would.
 */
const BLUR = { landscape: 4, wall: 8, window: 4, plant: 2, light: 4 };

const textures = new Map<string, Texture>();

/**
 * A painted surface as a texture, cached by what it shows and its size, so page turns and remounts do
 * not repaint it. The paintings are the setting: the same on every lesson.
 */
function surface(
  id: string,
  w: number,
  h: number,
  blur: number,
  paint: (g: CanvasRenderingContext2D) => void,
) {
  const key = `${id}:${w.toFixed(1)}x${h.toFixed(1)}`;
  let t = textures.get(key);
  if (!t) {
    t = new CanvasTexture(paintSurface(w, h, blur, paint));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    textures.set(key, t);
  }
  return t;
}

type Plane = {
  map: Texture;
  size: [number, number];
  position: [number, number, number];
  rotation: [number, number, number];
  cutout?: boolean;
  /** The landscape: it rides up and down with the camera so its horizon stays at eye level. */
  horizon?: boolean;
};

/**
 * The room round the desk at sunset, out of focus: a wide window behind the book with the landscape far
 * outside (a real distance away, so it shifts as the camera turns), a bookshelf with a trailing pothos,
 * warm dim walls. Painted, blurred planes: a few textures and no lighting. Decorative, never pickable.
 */
export function Room({ layout }: { layout: RoomLayout }) {
  const { walls, floor: fy, top, window: win, landscape: land } = layout;
  const width = walls.right - walls.left;
  const depth = walls.front - walls.back;
  const height = walls.ceiling - fy;
  const cx = (walls.left + walls.right) / 2;
  const cz = (walls.back + walls.front) / 2;
  const cy = (fy + walls.ceiling) / 2;
  const lw = land.x1 - land.x0;
  const lh = land.y1 - land.y0;
  const planes = useMemo<Plane[]>(() => {
    // The window in the wall's own units: x from the left wall, y down from the ceiling.
    const hole: [number, number, number, number] = [
      win.x0 - walls.left,
      walls.ceiling - win.y1,
      win.x1 - walls.left,
      walls.ceiling - win.y0,
    ];
    return [
      {
        map: surface(
          `window${hole.map((n) => n.toFixed(1))}`,
          width,
          height,
          BLUR.window,
          windowWall(width, height, hole),
        ),
        size: [width, height],
        position: [cx, cy, walls.back],
        rotation: [0, 0, 0],
        cutout: true,
      },
      {
        map: surface("land", lw, lh, BLUR.landscape, landscape(lw, lh, ROOM.landscape.above)),
        size: [lw, lh],
        position: [(land.x0 + land.x1) / 2, (land.y0 + land.y1) / 2, land.z],
        rotation: [0, 0, 0],
        horizon: true,
      },
      {
        map: surface("front", width, height, BLUR.wall, frontWall(width, height)),
        size: [width, height],
        position: [cx, cy, walls.front],
        rotation: [0, Math.PI, 0],
      },
      {
        map: surface("left", depth, height, BLUR.wall, leftWall(depth, height)),
        size: [depth, height],
        position: [walls.left, cy, cz],
        rotation: [0, Math.PI / 2, 0],
      },
      {
        map: surface("right", depth, height, BLUR.wall, rightWall(depth, height)),
        size: [depth, height],
        position: [walls.right, cy, cz],
        rotation: [0, -Math.PI / 2, 0],
      },
      {
        map: surface("floor", width, depth, BLUR.wall, floor(width, depth)),
        size: [width, depth],
        position: [cx, fy, cz],
        rotation: [-Math.PI / 2, 0, 0],
      },
      {
        map: surface("ceiling", width, depth, BLUR.wall, ceiling(width, depth)),
        size: [width, depth],
        position: [cx, walls.ceiling, cz],
        rotation: [Math.PI / 2, 0, 0],
      },
    ];
  }, [width, depth, height, cx, cy, cz, walls, win, land, lw, lh, fy]);
  const plant = useMemo(() => surface("plant", 8, 12, BLUR.plant, deskPlant(8, 12)), []);
  // A far landscape's horizon is always at eye level: keep the painted one there as the camera moves.
  const land3d = useRef<Mesh>(null);
  const toCentre = ROOM.landscape.above - lh / 2;
  useFrame(({ camera }) => {
    if (land3d.current) land3d.current.position.y = camera.position.y + toCentre;
  });
  const sillDepth = 3.4;
  return (
    <group>
      {planes.map((p, i) => (
        <mesh
          key={i}
          ref={p.horizon ? land3d : undefined}
          position={p.position}
          rotation={p.rotation}
          raycast={noRaycast}
          userData={BOOK_PART}
        >
          <planeGeometry args={p.size} />
          <meshBasicMaterial map={p.map} transparent={p.cutout} alphaTest={p.cutout ? 0.5 : 0} />
        </mesh>
      ))}
      {/* The window sill: a dark wooden ledge along the back of the desk, its front edge lit. */}
      <mesh
        position={[(win.x0 + win.x1) / 2, top + ROOM.sill / 2, walls.back + sillDepth / 2]}
        raycast={noRaycast}
        userData={BOOK_PART}
      >
        <boxGeometry args={[win.x1 - win.x0 + 6, ROOM.sill, sillDepth]} />
        <meshBasicMaterial attach="material-0" color="#5c3420" />
        <meshBasicMaterial attach="material-1" color="#5c3420" />
        <meshBasicMaterial attach="material-2" color="#8a4f2c" />
        <meshBasicMaterial attach="material-3" color="#3d2216" />
        <meshBasicMaterial attach="material-4" color="#c9773f" />
        <meshBasicMaterial attach="material-5" color="#3d2216" />
      </mesh>
      {/* A plant on the desk, in the back corner on the right: always faces the camera, turning about y. */}
      <Billboard position={[layout.plant[0], top + 6, layout.plant[1]]} lockX lockZ>
        <mesh raycast={noRaycast} userData={BOOK_PART}>
          <planeGeometry args={[8, 12]} />
          <meshBasicMaterial map={plant} transparent alphaTest={0.4} />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Edge, leg and apron colours of the desk. */
const TABLE = { edge: "#9c5e36", underside: "#5c3420", leg: "#6e3f24" };

/**
 * The desk the book lies on: a warm wooden top (the `wood` texture, repeating every `tile` units) with an
 * ink outline round its edge and low sun falling across it through the window, an apron and four legs.
 */
export function Table({ layout, wood, tile }: { layout: RoomLayout; wood: Texture; tile: number }) {
  const { table, top, legs, floor: fy, window: win } = layout;
  const w = table.maxX - table.minX;
  const d = table.maxZ - table.minZ;
  const t = ROOM.tableThick;
  const map = useMemo(() => {
    const m = wood.clone();
    m.wrapS = m.wrapT = RepeatWrapping;
    m.repeat.set(w / tile, d / tile);
    m.needsUpdate = true;
    return m;
  }, [wood, w, d, tile]);
  const light = useMemo(() => {
    const bars = mullions(win.x0, win.x1).map((x) => x - table.minX);
    return surface(`light${bars.map((b) => b.toFixed(1))}`, w, d, BLUR.light, deskLight(w, d, bars));
  }, [w, d, win.x0, win.x1, table.minX]);
  const cx = (table.minX + table.maxX) / 2;
  const cz = (table.minZ + table.maxZ) / 2;
  const legH = top - t - fy;
  const apron = 4;
  return (
    <group>
      <mesh position={[cx, top - t / 2, cz]} raycast={noRaycast} userData={BOOK_PART}>
        <boxGeometry args={[w, t, d]} />
        {/* Box faces: +x, -x, +y (the top), -y, +z, -z. */}
        <meshBasicMaterial attach="material-0" color={TABLE.edge} />
        <meshBasicMaterial attach="material-1" color={TABLE.edge} />
        <meshBasicMaterial attach="material-2" map={map} />
        <meshBasicMaterial attach="material-3" color={TABLE.underside} />
        <meshBasicMaterial attach="material-4" color={TABLE.edge} />
        <meshBasicMaterial attach="material-5" color={TABLE.edge} />
        <Edges threshold={30} lineWidth={1.4} color={INK} />
      </mesh>
      {/* Sunlight and the window's shadows on the desk, just above the wood. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, top + 0.006, cz]}
        raycast={noRaycast}
        userData={BOOK_PART}
      >
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial map={light} transparent depthWrite={false} />
      </mesh>
      <mesh position={[cx, top - t - apron / 2, cz]} raycast={noRaycast} userData={BOOK_PART}>
        <boxGeometry args={[w - 2 * ROOM.legInset, apron, d - 2 * ROOM.legInset]} />
        <meshBasicMaterial color={TABLE.underside} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, fy + legH / 2, z]} raycast={noRaycast} userData={BOOK_PART}>
          <boxGeometry args={[ROOM.leg, legH, ROOM.leg]} />
          <meshBasicMaterial color={TABLE.leg} />
        </mesh>
      ))}
    </group>
  );
}
