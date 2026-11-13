// The video's sound, synthesised so there is no licence to worry about: a calm soundtrack (soft pads,
// a felt-piano arpeggio, a low bass, a little room reverb) and a paper swish for page turns.
// Deterministic: the same files every run. Writes public/audio/music.wav and page.wav.
// To use your own track instead, put it in public/audio and point MUSIC.src (src/storyboard.ts) at it.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");

/** A small seeded random, so every run makes the same music. */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function writeWav(path, left, right) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(path, buf);
}

/** A light Schroeder reverb: four damped combs, two allpasses. `spread` offsets the delays per side. */
function reverb(input, spread) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + spread), i: 0, lp: 0 }));
  const alls = [556, 441].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  const outp = new Float32Array(input.length);
  for (let n = 0; n < input.length; n++) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.lp = y * 0.75 + c.lp * 0.25;
      c.buf[c.i] = input[n] + c.lp * 0.84;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    s *= 0.25;
    for (const a of alls) {
      const y = a.buf[a.i];
      a.buf[a.i] = s + y * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      s = y - s * 0.5;
    }
    outp[n] = s;
  }
  return outp;
}

function music(seconds) {
  const N = Math.round(seconds * SR);
  const dry = new Float32Array(N);
  const bass = new Float32Array(N);
  const rand = rng(7);
  const beat = 60 / 72;
  const bar = beat * 4;
  // C, Am, F, G (two bars each): open, warm voicings.
  const chords = [
    { root: 36, pad: [55, 59, 62, 64], keys: [72, 76, 79, 83, 84] },
    { root: 33, pad: [52, 55, 59, 60], keys: [69, 72, 76, 79, 81] },
    { root: 29, pad: [53, 57, 60, 64], keys: [69, 72, 76, 77, 81] },
    { root: 31, pad: [50, 55, 57, 62], keys: [67, 71, 74, 79, 81] },
  ];
  const chordAt = (t) => chords[Math.floor(t / (bar * 2)) % chords.length];

  // Pads: three slightly detuned sines per note, slow swell into each chord.
  for (let n = 0; n < N; n++) {
    const t = n / SR;
    const span = bar * 2;
    const k = Math.floor(t / span);
    const local = t - k * span;
    const cur = chords[k % chords.length];
    const prev = chords[(k + chords.length - 1) % chords.length];
    const x = Math.min(1, local / 1.4); // crossfade from the last chord
    const swell = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / 9);
    let s = 0;
    for (const [notes, g] of [
      [cur.pad, x],
      [prev.pad, k === 0 ? 0 : 1 - x],
    ]) {
      if (g <= 0) continue;
      for (const m of notes) {
        const f = hz(m);
        for (const cents of [-5, 0, 5]) {
          s += g * Math.sin(2 * Math.PI * f * 2 ** (cents / 1200) * t + m);
        }
      }
    }
    dry[n] += s * 0.011 * swell;
  }

  // Felt-piano arpeggio: chord tones, a gentle pattern with rests, from bar 2 on.
  const pattern = [0, 2, 1, 3, 4, 2, 3, 1];
  const step = beat / 2;
  for (let i = 0; i * step < seconds - 2; i++) {
    const t0 = i * step;
    if (t0 < bar * 1.5) continue;
    if (i % 2 === 1 && rand() < 0.45) continue;
    if (rand() < 0.12) continue;
    const ch = chordAt(t0);
    const m = ch.keys[pattern[i % pattern.length]];
    const f = hz(m);
    const vel = (i % 4 === 0 ? 1 : 0.7) * (0.8 + 0.2 * rand());
    const start = Math.round(t0 * SR + rand() * 0.012 * SR);
    const len = Math.min(N - start, Math.round(2.6 * SR));
    for (let j = 0; j < len; j++) {
      const t = j / SR;
      const att = Math.min(1, t / 0.006);
      let s = 0;
      for (const [h, a] of [
        [1, 1],
        [2, 0.32],
        [3, 0.1],
        [4, 0.04],
      ]) {
        s += a * Math.exp(-t * (2.0 + h * 1.4)) * Math.sin(2 * Math.PI * f * h * t);
      }
      dry[start + j] += s * att * vel * 0.075;
    }
  }

  // Bass: a soft low note on each bar.
  for (let b = 0; b * bar < seconds; b++) {
    const t0 = b * bar;
    const f = hz(chordAt(t0).root);
    const start = Math.round(t0 * SR);
    const len = Math.min(N - start, Math.round(bar * SR));
    for (let j = 0; j < len; j++) {
      const t = j / SR;
      const env = Math.min(1, t / 0.08) * Math.exp(-t * 0.9);
      bass[start + j] += env * (Math.sin(2 * Math.PI * f * t) + 0.18 * Math.sin(4 * Math.PI * f * t)) * 0.11;
    }
  }

  const wetL = reverb(dry, 0);
  const wetR = reverb(dry, 23);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  let peak = 0;
  for (let n = 0; n < N; n++) {
    const fade = Math.min(1, n / (2 * SR), (N - n) / (3 * SR));
    L[n] = Math.tanh((dry[n] * 0.8 + wetL[n] * 0.55 + bass[n]) * 1.2) * fade;
    R[n] = Math.tanh((dry[n] * 0.8 + wetR[n] * 0.55 + bass[n]) * 1.2) * fade;
    peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
  }
  for (let n = 0; n < N; n++) {
    L[n] = (L[n] / peak) * 0.8;
    R[n] = (R[n] / peak) * 0.8;
  }
  return [L, R];
}

/** A page turning: a short breath of filtered noise that rises and falls. */
function pageSound() {
  const N = Math.round(0.7 * SR);
  const rand = rng(3);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  let lp = 0;
  let hp = 0;
  let prev = 0;
  let peak = 0;
  for (let n = 0; n < N; n++) {
    const t = n / SR;
    const white = rand() * 2 - 1;
    const cut = 0.08 + 0.25 * Math.exp(-t * 5); // brighter at the start, duller as it lands
    lp += cut * (white - lp);
    hp = 0.97 * (hp + lp - prev);
    prev = lp;
    const env = Math.min(1, t / 0.05) * Math.exp(-t * 6) * (1 + 0.35 * Math.sin(2 * Math.PI * 9 * t));
    const s = hp * env;
    L[n] = s;
    R[n] = s * 0.85;
    peak = Math.max(peak, Math.abs(s));
  }
  for (let n = 0; n < N; n++) {
    L[n] = (L[n] / peak) * 0.6;
    R[n] = (R[n] / peak) * 0.6;
  }
  return [L, R];
}

mkdirSync(out, { recursive: true });
writeWav(join(out, "music.wav"), ...music(62));
writeWav(join(out, "page.wav"), ...pageSound());
console.log("video: soundtrack written to public/audio");
