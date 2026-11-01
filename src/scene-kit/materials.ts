import {
  BackSide,
  CanvasTexture,
  Color,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type ColorRepresentation,
} from "three";
import { INK } from "./theme";

/**
 * A colour as raw sRGB numbers. The ink shaders shade and write sRGB directly (no colour management),
 * so hex colours come out exactly as written, like in the prototype.
 */
function srgb(color: ColorRepresentation): Vector3 {
  const { r, g, b } = new Color(color).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  return new Vector3(r, g, b);
}

const inkCache = new Map<string, ShaderMaterial>();

/**
 * The ink material from docs/prototype/ink-stage.html: flat colour, lit from one fixed side, with
 * diagonal pen hatching on the shaded faces. Cached per colour, so meshes share one material.
 */
export function inkMaterial(color: ColorRepresentation, dpr = 1, faceted = false): ShaderMaterial {
  const key = `${new Color(color).getHexString()}@${dpr}${faceted ? "f" : ""}`;
  let m = inkCache.get(key);
  if (!m) {
    m = new ShaderMaterial({
      uniforms: { uColor: { value: srgb(color) }, uDpr: { value: dpr } },
      defines: faceted ? { FACETED: "" } : {},
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          // World space: the light stays put while the learner orbits, like a printed drawing.
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uDpr;
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          #ifdef FACETED
            // One normal per face, so big flat faces shade evenly (rounded boxes).
            vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
          #else
            vec3 n = normalize(vN);
          #endif
          float l = max(dot(n, normalize(vec3(0.35, 0.8, 0.45))), 0.0);
          float sh = 0.3 + 0.7 * l;
          float h = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) / (uDpr * 5.0)));
          vec3 c = uColor * (0.58 + 0.42 * sh);
          if (sh < 0.62) c = mix(c, c * 0.42, h);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    inkCache.set(key, m);
  }
  return m;
}

const hullCache = new Map<number, ShaderMaterial>();

/** Inverted-hull outline for curved shapes (coins, key rings): the back faces, pushed out, in ink. */
export function hullMaterial(thickness: number): ShaderMaterial {
  let m = hullCache.get(thickness);
  if (!m) {
    m = new ShaderMaterial({
      side: BackSide,
      uniforms: { uInk: { value: srgb(INK) }, uThick: { value: thickness } },
      vertexShader: /* glsl */ `
        uniform float uThick;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uThick, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uInk;
        void main() {
          gl_FragColor = vec4(uInk, 1.0);
        }`,
    });
    hullCache.set(thickness, m);
  }
  return m;
}

function radialTexture(w: number, h: number, stops: [number, string][]): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, Math.min(w, h) / 2);
  stops.forEach(([o, col]) => r.addColorStop(o, col));
  g.fillStyle = r;
  g.fillRect(0, 0, w, h);
  return new CanvasTexture(c);
}

let glow: CanvasTexture | null = null;
/** Soft white dot for glows and trails (tinted by the sprite colour). */
export const glowTexture = () =>
  (glow ??= radialTexture(64, 64, [
    [0, "rgba(255,255,255,1)"],
    [0.35, "rgba(255,255,255,0.55)"],
    [1, "rgba(255,255,255,0)"],
  ]));

let shadow: CanvasTexture | null = null;
/** Soft ink blot for contact shadows under objects. */
export const shadowTexture = () =>
  (shadow ??= radialTexture(128, 64, [
    [0, "rgba(22,20,31,0.38)"],
    [1, "rgba(22,20,31,0)"],
  ]));
