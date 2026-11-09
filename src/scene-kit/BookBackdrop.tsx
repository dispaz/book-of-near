import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Edges, Line } from "@react-three/drei";
import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  ExtrudeGeometry,
  Object3D,
  PCFShadowMap,
  Shape,
  ShaderMaterial,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  type LineSegments,
  type Mesh,
} from "three";
import { inkMaterial, REVEAL } from "./materials";
import { INK, NEAR } from "./theme";
import { roomFor } from "./roomLayout";
import { deskWood } from "./roomPaint";
import { BOOK_PART, noRaycast, Room, Table } from "./Room";
import { BOOK, curlProfile, pageHeight, type Spread } from "./book";
import { usePop } from "./PopUp";

/** Words printed on the pages: running heads, page numbers and a figure caption. Decoration only. */
export interface BookPrint {
  /** Running heads, small caps at the top of the left and right page. */
  heads?: [string, string];
  /** Page numbers of the left and right page. */
  folios?: [number, number];
  /** Caption at the foot of the right page, for example "Fig. 1  Three copies of one ledger". */
  caption?: string;
}

export interface BookBackdropProps extends BookPrint {
  spread: Spread;
  /** Cloth colour of the cover boards. */
  cover?: string;
  /** Colour of the ribbon bookmark. */
  ribbon?: string;
}

const PAGE = "#fbf8f1";
/** Light for the cast shadows: the same side as the ink shading in materials.ts. */
const SUN = new Vector3(0.35, 0.8, 0.45).normalize();

/**
 * An open pop-up book on a desk under a window at sunset (Room.tsx), for a 3D scene to stand on (pass it
 * as InkStage's `backdrop`).
 * The pages lie at y = 0, so objects need no changes. Objects cast hatched ink shadows on the pages.
 * Purely decorative: nothing in it is pickable, and the words on its pages repeat nothing the lesson needs.
 */
export function BookBackdrop({
  spread,
  cover = NEAR.forest,
  ribbon = NEAR.green,
  heads,
  folios,
  caption,
}: BookBackdropProps) {
  const { pageWidth: W, pageDepth: D, center } = spread;
  const [cx, , cz] = center;
  const deskY = -BOOK.stack - BOOK.cover;
  // The desk area: a little past the book at the sides and the back (the window is just behind it),
  // and well past it towards the reader, so low camera shots see desk in front of the book.
  const area = useMemo<[number, number]>(
    () => [2 * (W + BOOK.overhang) + 9, D + 2 * BOOK.overhang + 26],
    [W, D],
  );
  return (
    <group>
      <Shadows spread={spread} />
      <CastShadows />
      <Desk y={deskY - 0.001} at={[cx, cz + 10]} size={area} />
      <group position={[cx, 0, cz]}>
        <Cover W={W} D={D} color={cover} />
        {([-1, 1] as const).map((side) => (
          <Page
            key={side}
            side={side}
            W={W}
            D={D}
            print={
              side === -1
                ? { head: heads?.[0], folio: folios?.[0] }
                : { head: heads?.[1], folio: folios?.[1], caption }
            }
          />
        ))}
        <Ribbon D={D} deskY={deskY} color={ribbon} />
        <TurningPage W={W} D={D} />
      </group>
    </group>
  );
}

// ---------- shadows ----------

/** Turns on shadow maps and adds the light that casts them (lights do not change the ink colours). */
function Shadows({ spread }: { spread: Spread }) {
  const gl = useThree((s) => s.gl);
  const light = useRef<DirectionalLight>(null);
  useLayoutEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = PCFShadowMap;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);
  const [cx, , cz] = spread.center;
  const reach = Math.max(spread.pageWidth, spread.pageDepth) + 2.5;
  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -reach;
    cam.right = reach;
    cam.top = reach;
    cam.bottom = -reach;
    cam.near = 1;
    cam.far = 80;
    cam.updateProjectionMatrix();
  }, [cx, cz, reach]);
  const at = SUN.clone()
    .multiplyScalar(30)
    .add(new Vector3(cx, 0, cz));
  return (
    <directionalLight
      ref={light}
      position={at}
      intensity={1}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-radius={4}
      shadow-bias={-0.0006}
      shadow-normalBias={0.02}
    />
  );
}

/**
 * Lets every solid object in the scene cast a shadow, so lessons need no changes. Skips the book itself,
 * see-through things (contact blots, glows, hit areas) and fat ink lines (their geometry is not a solid).
 */
function CastShadows() {
  const scene = useThree((s) => s.scene);
  const n = useRef(0);
  useFrame(() => {
    if (n.current++ % 20) return;
    scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh || m.castShadow || m.userData.book) return;
      const mat = m.material;
      if (Array.isArray(mat) || mat.transparent || !mat.visible) return;
      if ("isLineMaterial" in mat || "isLineSegments2" in m || "isLine2" in m) return;
      m.castShadow = true;
    });
  });
  return null;
}

const shadowCache = new Map<number, ShadowMaterial>();

/** Receives shadows only, and draws them as ink: a light wash with diagonal pen hatching. */
function inkShadowMaterial(dpr: number, opacity = 0.26): ShadowMaterial {
  const key = dpr * 1000 + opacity;
  let m = shadowCache.get(key);
  if (!m) {
    m = new ShadowMaterial({ color: INK, opacity, depthWrite: false });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.onBeforeCompile = (s) => {
      s.uniforms.uDpr = { value: dpr };
      // Shadows come in with the fill, after the outlines have popped up.
      s.uniforms.uReveal = REVEAL;
      s.fragmentShader =
        "uniform float uDpr;\nuniform float uReveal;\n" +
        s.fragmentShader.replace(
          "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );",
          /* glsl */ `float sm = 1.0 - getShadowMask();
          float hatch = step(0.62, fract((gl_FragCoord.x - gl_FragCoord.y) / (uDpr * 5.0)));
          gl_FragColor = vec4( color, opacity * sm * (0.5 + 0.9 * hatch) * (0.3 + 0.7 * uReveal) );`,
        );
    };
    shadowCache.set(key, m);
  }
  return m;
}

// ---------- desk ----------

/** World units one repeat of the wood texture covers. */
const WOOD_TILE = 14;

/**
 * A warm wooden desk pushed against a window at sunset, in a cosy, out-of-focus room (Room.tsx). The
 * desk area the book needs is `size` (x, z), centred on `at`; the desk and the room are sized round it
 * (roomLayout.ts). Objects' ink shadows fall on the desk too.
 */
function Desk({ y, at, size }: { y: number; at: [number, number]; size: [number, number] }) {
  const wood = useMemo(() => {
    const t = new CanvasTexture(deskWood());
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  useEffect(() => () => wood.dispose(), [wood]);
  const [x, z] = at;
  const [width, depth] = size;
  const room = useMemo(() => roomFor({ x, z, width, depth }, y - 0.06), [x, z, width, depth, y]);
  const dpr = useThree((s) => s.viewport.dpr);
  const { table } = room;
  return (
    <>
      <Room layout={room} />
      <Table layout={room} wood={wood} tile={WOOD_TILE} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(table.minX + table.maxX) / 2, y + 0.024, (table.minZ + table.maxZ) / 2]}
        raycast={noRaycast}
        receiveShadow
        userData={BOOK_PART}
        material={inkShadowMaterial(dpr, 0.3)}
      >
        <planeGeometry args={[table.maxX - table.minX, table.maxZ - table.minZ]} />
      </mesh>
    </>
  );
}

// ---------- cover ----------

function Cover({ W, D, color }: { W: number; D: number; color: string }) {
  const dpr = useThree((s) => s.viewport.dpr);
  // A clone: the book stays solid while the figure on it pops up (REVEAL).
  const mat = useMemo(() => inkMaterial(color, dpr).clone(), [color, dpr]);
  useEffect(() => () => mat.dispose(), [mat]);
  const o = BOOK.overhang;
  return (
    <mesh
      position={[0, -BOOK.stack - BOOK.cover / 2, 0]}
      material={mat}
      castShadow
      raycast={noRaycast}
      userData={BOOK_PART}
    >
      <boxGeometry args={[2 * (W + o), BOOK.cover, D + 2 * o]} />
      <Edges lineWidth={1.6} color={INK} />
    </mesh>
  );
}

// ---------- pages ----------

const SEGMENTS = 48;

/** The curved top sheet of one page, from the spine (x = 0) out to x = side * W. */
function pageGeometry(side: -1 | 1, W: number, D: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  // Always left to right in x, so the triangles face up for both pages.
  for (let i = 0; i <= SEGMENTS; i++) {
    const x = side === 1 ? (W * i) / SEGMENTS : -W + (W * i) / SEGMENTS;
    const y = pageHeight(Math.abs(x), W);
    const u = i / SEGMENTS;
    pos.push(x, y, -D / 2, x, y, D / 2);
    uv.push(u, 1, u, 0);
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const a = 2 * i; // back
    const b = a + 1; // front
    const c = a + 2;
    const d = a + 3;
    idx.push(a, b, c, c, b, d);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The stack of pages under the top sheet: its profile follows the page curve, extruded along z. */
function stackGeometry(side: -1 | 1, W: number, D: number) {
  const s = new Shape();
  const xs = Array.from({ length: SEGMENTS + 1 }, (_, i) => (W * i) / SEGMENTS);
  s.moveTo(0, -BOOK.stack);
  for (const d of xs) s.lineTo(side * d, pageHeight(d, W) - 0.004);
  s.lineTo(side * W, -BOOK.stack);
  s.closePath();
  // ExtrudeGeometry fixes the winding itself, so the mirrored left profile needs no flipping.
  const g = new ExtrudeGeometry(s, { depth: D, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -D / 2);
  return g;
}

/**
 * Page edges: fine lines that follow the curve of the pages, shaded like the ink material.
 * One per page (it holds the page width), so books of different sizes never share it.
 */
function pageEdgeMaterial(W: number) {
  return new ShaderMaterial({
    uniforms: {
      uW: { value: W },
      uC: { value: new Vector3(0.937, 0.906, 0.827) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vP;
      varying vec3 vN;
      void main() {
        vP = position;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uW;
      uniform vec3 uC;
      varying vec3 vP;
      varying vec3 vN;
      float ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
      void main() {
        float d = abs(vP.x);
        float s = ss(0.0, ${BOOK.gutter.toFixed(3)}, d);
        float top = -${BOOK.valley.toFixed(3)} * (1.0 - s) * (1.0 - s) - ${BOOK.droop.toFixed(3)} * ss(uW - ${BOOK.droopWidth.toFixed(3)}, uW, d);
        float t = (vP.y + ${BOOK.stack.toFixed(3)}) / (top + ${BOOK.stack.toFixed(3)});
        float line = smoothstep(0.55, 0.9, fract(t * 26.0));
        float l = max(dot(normalize(vN), normalize(vec3(0.35, 0.8, 0.45))), 0.0);
        vec3 c = uC * (0.8 + 0.2 * l);
        c = mix(c, c * 0.8, line);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

function Page({
  side,
  W,
  D,
  print,
}: {
  side: -1 | 1;
  W: number;
  D: number;
  print: { head?: string; folio?: number; caption?: string };
}) {
  const dpr = useThree((s) => s.viewport.dpr);
  const sheet = useMemo(() => pageGeometry(side, W, D), [side, W, D]);
  const stack = useMemo(() => stackGeometry(side, W, D), [side, W, D]);
  const edges = useMemo(() => pageEdgeMaterial(W), [W]);
  // A resize can swap the spread (row ↔ loop layout): free the old page's GPU buffers.
  useEffect(
    () => () => {
      sheet.dispose();
      stack.dispose();
    },
    [sheet, stack],
  );
  useEffect(() => () => edges.dispose(), [edges]);
  const fonts = useFontsReady();
  const { head, folio, caption } = print;
  const tex = useMemo(
    () => paperTexture(side, W, D, { head, folio, caption }, fonts),
    [side, W, D, head, folio, caption, fonts],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  // The ink outline round the page: front edge, back edge and the outer edge of the stack.
  const outline = useMemo(() => {
    const curve = (z: number) =>
      Array.from({ length: SEGMENTS + 1 }, (_, i) => {
        const d = (W * i) / SEGMENTS;
        return [side * d, pageHeight(d, W), z] as [number, number, number];
      });
    const outer = side * W;
    const yOut = pageHeight(W, W);
    return [
      curve(D / 2),
      curve(-D / 2),
      [
        [outer, -BOOK.stack, D / 2],
        [outer, yOut, D / 2],
      ],
      [
        [outer, yOut, -D / 2],
        [outer, yOut, D / 2],
      ],
      [
        [outer, -BOOK.stack, -D / 2],
        [outer, yOut, -D / 2],
      ],
    ] as [number, number, number][][];
  }, [side, W, D]);
  return (
    <group>
      <mesh geometry={stack} material={edges} castShadow raycast={noRaycast} userData={BOOK_PART} />
      <mesh geometry={sheet} raycast={noRaycast} userData={BOOK_PART}>
        <meshBasicMaterial map={tex} />
      </mesh>
      <mesh
        geometry={sheet}
        raycast={noRaycast}
        receiveShadow
        userData={BOOK_PART}
        renderOrder={-1}
        material={inkShadowMaterial(dpr)}
      />
      {outline.map((pts, i) => (
        <Line key={i} points={pts} color={INK} lineWidth={1.5} raycast={noRaycast} userData={BOOK_PART} />
      ))}
    </group>
  );
}

/** Webfonts load after the first frame: redraw the printed words once they are in. */
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts) return;
    Promise.all([fonts.load('italic 40px "Newsreader"'), fonts.load('700 20px "DM Sans"')])
      .catch(() => undefined)
      .then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

/**
 * Paper for one page: warm white with a little grain, shading into the spine, a running head, a page
 * number and (right page) a caption. The canvas's left edge is the page's left edge.
 */
function paperTexture(
  side: -1 | 1,
  W: number,
  D: number,
  print: { head?: string; folio?: number; caption?: string },
  _fonts: boolean,
): CanvasTexture {
  const w = 1024;
  const h = Math.round((w * D) / W);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = PAGE;
  g.fillRect(0, 0, w, h);
  // Grain: a seeded scatter of specks, the same on every load.
  let seed = side === 1 ? 7 : 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4200; i++) {
    g.fillStyle = `rgba(90,80,60,${0.025 + rnd() * 0.05})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1);
  }
  // Shade into the spine and, a little, at the outer edge.
  const spineX = side === 1 ? 0 : w;
  const inward = side === 1 ? 1 : -1;
  const sg = g.createLinearGradient(spineX, 0, spineX + inward * w * 0.16, 0);
  sg.addColorStop(0, "rgba(70,58,36,0.34)");
  sg.addColorStop(0.35, "rgba(70,58,36,0.1)");
  sg.addColorStop(1, "rgba(70,58,36,0)");
  g.fillStyle = sg;
  g.fillRect(0, 0, w, h);
  const outerX = side === 1 ? w : 0;
  const og = g.createLinearGradient(outerX, 0, outerX - inward * w * 0.05, 0);
  og.addColorStop(0, "rgba(70,58,36,0.08)");
  og.addColorStop(1, "rgba(70,58,36,0)");
  g.fillStyle = og;
  g.fillRect(0, 0, w, h);

  const margin = Math.round(w * 0.1);
  const inner = side === 1 ? margin + w * 0.06 : margin;
  const outer = side === 1 ? w - margin : w - margin - w * 0.06;
  g.fillStyle = "#8f887a";
  g.strokeStyle = "rgba(143,136,122,0.5)";
  g.lineWidth = 1.5;
  if (print.head) {
    g.font = '700 17px "DM Sans", system-ui, sans-serif';
    g.textBaseline = "alphabetic";
    g.textAlign = side === 1 ? "right" : "left";
    const text = print.head.toUpperCase().split("").join(" ");
    g.fillText(text, side === 1 ? outer : inner, 64);
    g.beginPath();
    g.moveTo(inner, 80);
    g.lineTo(outer, 80);
    g.stroke();
  }
  if (print.folio !== undefined) {
    g.font = 'italic 34px "Newsreader", Georgia, serif';
    g.textAlign = side === 1 ? "right" : "left";
    g.fillText(String(print.folio), side === 1 ? outer : inner, h - 52);
  }
  if (print.caption) {
    g.fillStyle = "#4b4756";
    g.textAlign = "left";
    g.font = 'italic 30px "Newsreader", Georgia, serif';
    g.fillText(print.caption, inner, h - 52);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- the turning page ----------

const TURN_SEGMENTS = 40;

let turnMat: ShaderMaterial | null = null;
/** Paper for the turning page: both sides, shaded by how it faces the light and darker at the spine. */
function turningPageMaterial() {
  turnMat ??= new ShaderMaterial({
    side: DoubleSide,
    uniforms: { uC: { value: new Vector3(0.984, 0.973, 0.945) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying float vU;
      void main() {
        vU = uv.x;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uC;
      varying vec3 vN;
      varying float vU;
      void main() {
        vec3 n = normalize(gl_FrontFacing ? vN : -vN);
        float l = max(dot(n, normalize(vec3(0.35, 0.8, 0.45))), 0.0);
        vec3 c = uC * (0.72 + 0.28 * l);
        c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.18, vU));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return turnMat;
}

/**
 * The page that turns over when the figure changes: it lifts off the right page, curls over the spine
 * and lands on the left page (pop.ts says when). Hidden the rest of the time.
 */
function TurningPage({ W, D }: { W: number; D: number }) {
  const pop = usePop();
  const mesh = useRef<Mesh>(null);
  const lines = useRef<LineSegments>(null);
  const n = TURN_SEGMENTS;
  const { sheet, edge } = useMemo(() => {
    const sheet = new BufferGeometry();
    sheet.setAttribute("position", new Float32BufferAttribute(new Float32Array((n + 1) * 6), 3));
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      uv.push(i / n, 1, i / n, 0);
      if (i < n) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 2, 2 * i + 1, 2 * i + 3);
    }
    sheet.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    sheet.setIndex(idx);
    // The back and front edges (n segments each) and the free edge, as ink lines.
    const edge = new BufferGeometry();
    edge.setAttribute("position", new Float32BufferAttribute(new Float32Array((2 * n + 1) * 6), 3));
    return { sheet, edge };
  }, [n]);
  useEffect(
    () => () => {
      sheet.dispose();
      edge.dispose();
    },
    [sheet, edge],
  );
  useFrame(() => {
    const t = pop.current.turn;
    const m = mesh.current;
    const l = lines.current;
    if (!m || !l) return;
    m.visible = l.visible = t !== null;
    if (t === null) return;
    const pts = curlProfile(t * Math.PI, W, n);
    const p = sheet.attributes.position!.array as Float32Array;
    pts.forEach(([x, y], i) => p.set([x, y, -D / 2, x, y, D / 2], i * 6));
    sheet.attributes.position!.needsUpdate = true;
    sheet.computeVertexNormals();
    const e = edge.attributes.position!.array as Float32Array;
    let k = 0;
    for (const z of [-D / 2, D / 2])
      for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i]!;
        const [x1, y1] = pts[i + 1]!;
        e.set([x0, y0, z, x1, y1, z], k);
        k += 6;
      }
    const [xe, ye] = pts[n]!;
    e.set([xe, ye, -D / 2, xe, ye, D / 2], k);
    edge.attributes.position!.needsUpdate = true;
  });
  return (
    <group>
      <mesh
        ref={mesh}
        geometry={sheet}
        material={turningPageMaterial()}
        castShadow
        frustumCulled={false}
        visible={false}
        raycast={noRaycast}
        userData={BOOK_PART}
      />
      <lineSegments
        ref={lines}
        geometry={edge}
        frustumCulled={false}
        visible={false}
        raycast={noRaycast}
        userData={BOOK_PART}
      >
        <lineBasicMaterial color={INK} />
      </lineSegments>
    </group>
  );
}

// ---------- ribbon ----------

/** A ribbon bookmark lying in the spine and hanging over the front edge onto the desk. */
function Ribbon({ D, deskY, color }: { D: number; deskY: number; color: string }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const mat = useMemo(() => {
    const m = inkMaterial(color, dpr).clone();
    m.side = DoubleSide;
    return m;
  }, [color, dpr]);
  const geo = useMemo(() => {
    const x = 0.14;
    const top = pageHeight(x, 10) + 0.012;
    const lip = D / 2 + 0.012;
    const onCover = -BOOK.stack + 0.01;
    const edge = D / 2 + BOOK.overhang;
    // Lies in the spine, drops down the front of the pages, crosses the cover and falls onto the desk.
    const curve = new CatmullRomCurve3(
      [
        new Vector3(x, top, D / 2 - 0.9),
        new Vector3(x, top, D / 2 - 0.06),
        new Vector3(x, top - 0.03, lip),
        new Vector3(x, (top + onCover) / 2, lip + 0.004),
        new Vector3(x + 0.01, onCover + 0.02, lip + 0.03),
        new Vector3(x + 0.02, onCover, edge - 0.05),
        new Vector3(x + 0.03, (onCover + deskY) / 2, edge + 0.04),
        new Vector3(x + 0.06, deskY + 0.006, edge + 0.22),
        new Vector3(x + 0.16, deskY + 0.006, edge + 0.75),
      ],
      false,
      "catmullrom",
      0.2,
    );
    const n = 120;
    const half = 0.11;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n);
      pos.push(p.x - half, p.y, p.z, p.x + half, p.y, p.z);
      if (i < n) {
        const a = 2 * i;
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [D, deskY]);
  return <mesh geometry={geo} material={mat} castShadow raycast={noRaycast} userData={BOOK_PART} />;
}
