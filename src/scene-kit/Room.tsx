import { useEffect, useMemo, useState } from "react";
import { Edges } from "@react-three/drei";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { ROOM, type RoomLayout } from "./roomLayout";
import {
  backWall,
  ceiling,
  deskLight,
  floor,
  frameXs,
  frontWall,
  leftWall,
  paintSurface,
  rightWall,
  underWall,
} from "./roomPaint";
import { INK } from "./theme";
import sunsetWindow from "./assets/sunset-window.jpg";

const noRaycast = () => undefined;
const BOOK_PART = { book: true };

/** How much the painted surfaces are softened (see paintSurface): the room sits a little out of focus. */
const BLUR = { wall: 4, light: 4 };

let picture: HTMLImageElement | null = null;
let loading: Promise<HTMLImageElement | null> | null = null;

/**
 * The window painting for the back wall, loaded once for every lesson. Null until it has loaded (or if it
 * cannot load): the wall is then plain dark wood, and the lesson works the same.
 */
function usePicture(): HTMLImageElement | null {
  const [img, setImg] = useState(picture);
  useEffect(() => {
    if (img) return;
    loading ??= new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve((picture = i));
      i.onerror = () => resolve(null);
      i.src = sunsetWindow;
    });
    let live = true;
    void loading.then((i) => live && setImg(i));
    return () => {
      live = false;
    };
  }, [img]);
  return img;
}

const textures = new Map<string, Texture>();

/** A texture from a canvas, cached by `key`, so page turns and remounts do not paint it again. */
function cached(key: string, make: () => HTMLCanvasElement): Texture {
  let t = textures.get(key);
  if (!t) {
    t = new CanvasTexture(make());
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    textures.set(key, t);
  }
  return t;
}

/** A surface painted in world units (see paintSurface), cached by name and size. */
function surface(
  id: string,
  w: number,
  h: number,
  blur: number,
  paint: (g: CanvasRenderingContext2D) => void,
) {
  return cached(`${id}:${w.toFixed(1)}x${h.toFixed(1)}`, () => paintSurface(w, h, blur, paint));
}

type Plane = {
  map: Texture;
  size: [number, number];
  position: [number, number, number];
  rotation: [number, number, number];
};

/**
 * The window nook round the desk at sunset. The back wall is a painting (a bookshelf with a trailing
 * pothos, a three-pane window onto mountains and a garden, a plant on the sill) standing on the back of
 * the desk; the side walls are warm wood, the left one lined with the same shelves. Painted planes: a
 * few textures and no lighting. Decorative and never pickable.
 */
export function Room({ layout }: { layout: RoomLayout }) {
  const img = usePicture();
  const { walls, floor: fy, top, backdrop } = layout;
  const width = walls.right - walls.left;
  const depth = walls.front - walls.back;
  const height = walls.ceiling - fy;
  const above = walls.ceiling - top;
  const cx = (walls.left + walls.right) / 2;
  const cz = (walls.back + walls.front) / 2;
  const cy = (fy + walls.ceiling) / 2;
  const share = (backdrop.y1 - backdrop.y0) / above;
  const planes = useMemo<Plane[]>(
    () => [
      {
        map: img
          ? cached(`back:${share.toFixed(3)}`, () => backWall(img, share))
          : surface("back-plain", width, above, 1, underWall(width, above)),
        size: [width, above],
        position: [cx, top + above / 2, walls.back],
        rotation: [0, 0, 0],
      },
      {
        map: surface("under", width, top - fy, 1, underWall(width, top - fy)),
        size: [width, top - fy],
        position: [cx, (fy + top) / 2, walls.back],
        rotation: [0, 0, 0],
      },
      {
        map: surface("front", width, height, BLUR.wall, frontWall(width, height)),
        size: [width, height],
        position: [cx, cy, walls.front],
        rotation: [0, Math.PI, 0],
      },
      {
        map: surface(img ? "left" : "left-plain", depth, height, BLUR.wall, leftWall(img, depth, height)),
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
    ],
    [
      img,
      share,
      width,
      depth,
      height,
      above,
      cx,
      cy,
      cz,
      top,
      fy,
      walls.back,
      walls.front,
      walls.left,
      walls.right,
    ],
  );
  return (
    <group>
      {planes.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation} raycast={noRaycast} userData={BOOK_PART}>
          <planeGeometry args={p.size} />
          <meshBasicMaterial map={p.map} />
        </mesh>
      ))}
    </group>
  );
}

/** Edge, leg and apron colours of the desk. */
const TABLE = { edge: "#8e4a28", underside: "#4a2a1a", leg: "#5a3322" };

/**
 * The desk the book lies on: a warm wooden top (the `wood` texture, repeating every `tile` units) with an
 * ink outline round its edge and low sun falling across it through the painted window, an apron and legs.
 */
export function Table({ layout, wood, tile }: { layout: RoomLayout; wood: Texture; tile: number }) {
  const { table, top, legs, floor: fy, walls } = layout;
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
  const offset = walls.left - table.minX;
  const span = walls.right - walls.left;
  const light = useMemo(() => {
    const bars = frameXs(span).map((x) => x + offset);
    return surface(`light${bars.map((b) => b.toFixed(1))}`, w, d, BLUR.light, deskLight(w, d, bars));
  }, [w, d, span, offset]);
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
      {/* Sunlight and the window frames' shadows on the desk, just above the wood. */}
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
