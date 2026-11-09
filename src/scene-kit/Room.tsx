import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { ROOM, type RoomLayout } from "./roomLayout";
import { backWall, ceiling, floor, frontWall, leftWall, paintSurface, rightWall } from "./roomPaint";
import { INK } from "./theme";

const noRaycast = () => undefined;
const BOOK_PART = { book: true };

/** How much each surface is blurred (see paintSurface): the floor near the table is a little sharper. */
const BLUR = { wall: 16, floor: 8 };

const textures = new Map<string, Texture>();

/**
 * A painted surface as a texture, cached by what it shows and its size, so page turns and remounts do
 * not repaint it. The paintings are the setting: the same on every lesson.
 */
function surface(
  key: string,
  w: number,
  h: number,
  blur: number,
  paint: (w: number, h: number) => (g: CanvasRenderingContext2D) => void,
) {
  const id = `${key}:${w.toFixed(1)}x${h.toFixed(1)}`;
  let t = textures.get(id);
  if (!t) {
    t = new CanvasTexture(paintSurface(w, h, blur, paint(w, h)));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    textures.set(id, t);
  }
  return t;
}

/**
 * The cosy flat round the table, out of focus: a balcony onto a garden behind the book, a sofa and a
 * window on the right, a sideboard on the left. Painted, blurred planes, so it costs a few textures and
 * no lighting. Decorative and never pickable.
 */
export function Room({ layout }: { layout: RoomLayout }) {
  const { walls, floor: fy, table } = layout;
  const width = walls.right - walls.left;
  const depth = walls.front - walls.back;
  const height = walls.ceiling - fy;
  const cx = (walls.left + walls.right) / 2;
  const cz = (walls.back + walls.front) / 2;
  const cy = (fy + walls.ceiling) / 2;
  const maps = useMemo(() => {
    // The rug lies under the table, with room for the chairs round it.
    const rug: [number, number, number, number] = [
      table.minX - walls.left - 14,
      table.minZ - walls.back - 12,
      table.maxX - table.minX + 28,
      table.maxZ - table.minZ + 24,
    ];
    return {
      back: surface("back", width, height, BLUR.wall, backWall),
      front: surface("front", width, height, BLUR.wall, frontWall),
      left: surface("left", depth, height, BLUR.wall, leftWall),
      right: surface("right", depth, height, BLUR.wall, rightWall),
      ceiling: surface("ceiling", width, depth, BLUR.wall, ceiling),
      floor: surface(`floor${rug.map((n) => n.toFixed(1)).join(",")}`, width, depth, BLUR.floor, (w, h) =>
        floor(w, h, rug),
      ),
    };
  }, [width, depth, height, table, walls]);
  const planes: {
    map: Texture;
    size: [number, number];
    position: [number, number, number];
    rotation: [number, number, number];
  }[] = [
    { map: maps.back, size: [width, height], position: [cx, cy, walls.back], rotation: [0, 0, 0] },
    { map: maps.front, size: [width, height], position: [cx, cy, walls.front], rotation: [0, Math.PI, 0] },
    { map: maps.left, size: [depth, height], position: [walls.left, cy, cz], rotation: [0, Math.PI / 2, 0] },
    {
      map: maps.right,
      size: [depth, height],
      position: [walls.right, cy, cz],
      rotation: [0, -Math.PI / 2, 0],
    },
    { map: maps.floor, size: [width, depth], position: [cx, fy, cz], rotation: [-Math.PI / 2, 0, 0] },
    {
      map: maps.ceiling,
      size: [width, depth],
      position: [cx, walls.ceiling, cz],
      rotation: [Math.PI / 2, 0, 0],
    },
  ];
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

/** Edge, leg and apron colours of the ash table. */
const TABLE = { edge: "#c7b08c", underside: "#a88e6a", leg: "#b59a74" };

/**
 * The table the book lies on: an ash top (the `wood` texture, repeating every `tile` units) with an
 * ink outline round its edge, an apron and four legs down to the floor.
 */
export function Table({ layout, wood, tile }: { layout: RoomLayout; wood: Texture; tile: number }) {
  const { table, top, legs, floor: fy } = layout;
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
