/**
 * Fitting a recorded take into its scene: the take plays at one base rate, except between ramp beats,
 * which play at the ramp's rate. Everything timed to a beat (notes, push-ins) goes through `frameAt`.
 */
import { FPS, type Ramp } from "./storyboard";

export interface ClipInfo {
  /** File name in public/clips. */
  file: string;
  /** Seconds to skip at the start (page load, warm-up). */
  trimStart: number;
  /** Seconds of useful footage after trimStart. */
  duration: number;
  /** Named moments, seconds after trimStart. */
  beats?: Record<string, number>;
  /** claim and proof: where the take was recorded. */
  network?: "demo" | "testnet";
}

export interface Segment {
  /** Source seconds (after trimStart). */
  from: number;
  to: number;
  rate: number;
  /** Scene frame this segment starts at, and how many frames it lasts. */
  start: number;
  frames: number;
  label?: string;
}

/** The base rate stays in this range: footage never crawls or races. */
const MIN_RATE = 0.8;
const MAX_RATE = 1.6;

export function planClip(info: ClipInfo, sceneFrames: number, ramps: Ramp[] = []) {
  const beats = info.beats ?? {};
  const fast = ramps
    .map((r) => ({ a: beats[r.from], b: beats[r.to], rate: r.rate, label: r.label }))
    .filter(
      (r): r is { a: number; b: number; rate: number; label: string | undefined } =>
        r.a !== undefined && r.b !== undefined && r.b > r.a,
    )
    .sort((x, y) => x.a - y.a);
  const fastSource = fast.reduce((n, r) => n + (r.b - r.a), 0);
  const fastScene = fast.reduce((n, r) => n + (r.b - r.a) / r.rate, 0);
  const sceneSeconds = sceneFrames / FPS;
  const base = Math.min(
    MAX_RATE,
    Math.max(MIN_RATE, (info.duration - fastSource) / Math.max(0.5, sceneSeconds - fastScene)),
  );

  const segments: Segment[] = [];
  let t = 0;
  let frame = 0;
  const push = (from: number, to: number, rate: number, label?: string) => {
    if (to - from <= 0.001) return;
    const frames = Math.max(1, Math.round(((to - from) / rate) * FPS));
    segments.push({ from, to, rate, start: frame, frames, label });
    frame += frames;
  };
  for (const r of fast) {
    push(t, r.a, base);
    push(r.a, r.b, r.rate, r.label);
    t = r.b;
  }
  push(t, info.duration, base);

  /** The scene frame where source second `s` shows. */
  const frameAt = (s: number) => {
    for (const seg of segments) {
      if (s <= seg.to) return seg.start + Math.round(((Math.max(s, seg.from) - seg.from) / seg.rate) * FPS);
    }
    return frame;
  };
  const beatFrame = (name: string | undefined, fallback: number) =>
    name && beats[name] !== undefined ? frameAt(beats[name]) : fallback;

  return { segments, base, frameAt, beatFrame, endFrame: frame };
}
