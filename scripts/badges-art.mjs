#!/usr/bin/env node
/**
 * `npm run badges:art`: draws the five stage badges as SVG in the book's ink style (black outline on
 * paper-white, one stage accent colour) into public/badges/, and writes public/badges/art.json with each
 * file's base64 sha256 for the contract's `set_art` (`node scripts/deploy-badge.mjs art`).
 * The art is code: revise a motif here and re-run; nothing else changes.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// The palette's one source of truth (Node runs the .ts file directly: it has no imports).
import { CARD, INK, NEAR, STAGE_ACCENTS } from "../src/scene-kit/theme.ts";

const PAPER = CARD;
/** The badge disc: NEAR off-white, the app's `--paper`. */
const PAGE = NEAR.offWhite;
/** Stage accents (STAGE_ACCENTS in src/scene-kit/theme.ts). */
export const ACCENTS = [0, 1, 2, 3, 4].map((s) => STAGE_ACCENTS[s]);
export const NAMES = ["Blank Page", "Named", "Nightshade", "Wasm", "Any Chain"];

const lineW = (w) =>
  `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const line = lineW(10);
const shape = (fill, w = 10) => `fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;

/** Stage 0: a quill over a blank page. */
function quillOnPage(a) {
  return `
  <g transform="rotate(-6 256 236)">
    <path d="M170 128 h150 l30 30 v170 h-180 z" ${shape(PAPER)}/>
    <path d="M320 128 v30 h30" ${line}/>
  </g>
  <path d="M352 96 C300 120 236 196 210 300 C262 262 330 200 368 112 Z" ${shape(a)}/>
  <path d="M352 104 C300 160 252 230 214 296" ${lineW(7)}/>
  <path d="M210 300 L196 336" ${line}/>
  <path d="M168 344 q30 -14 56 0" ${lineW(7)}/>`;
}

/** Stage 1: a name tag with a key. */
function nameTagWithKey(a) {
  return `
  <path d="M150 150 h170 a20 20 0 0 1 20 20 v120 a20 20 0 0 1 -20 20 h-170 l-46 -80 z" ${shape(a)}/>
  <circle cx="142" cy="230" r="12" ${shape(PAPER)}/>
  <path d="M188 206 h110 M188 248 h80" ${line}/>
  <path d="M342 318 L404 260 M378 284 l18 18 M394 270 l14 14" ${line}/>
  <circle cx="318" cy="340" r="38" ${shape(PAPER)}/>
  <circle cx="318" cy="340" r="11" ${shape(PAGE)}/>`;
}

/** Stage 2: a moon split into shards. */
function moonInShards(a) {
  const shard = (d, dx, dy) => `<path d="${d}" transform="translate(${dx} ${dy})" ${shape(a)}/>`;
  return `
  ${shard("M256 106 A130 130 0 0 1 380 196 L300 214 L256 160 Z", 8, -8)}
  ${shard("M380 196 A130 130 0 0 1 300 352 L282 278 L300 214 Z", 12, 6)}
  ${shard("M300 352 A130 130 0 0 1 140 300 L216 262 L282 278 Z", -2, 14)}
  ${shard("M140 300 A130 130 0 0 1 256 106 L256 160 L216 262 Z", -12, -4)}
  <circle cx="226" cy="200" r="12" ${shape(PAGE, 7)}/>
  <circle cx="318" cy="262" r="9" ${shape(PAGE, 7)}/>
  <path d="M126 132 l8 18 l18 8 l-18 8 l-8 18 l-8 -18 l-18 -8 l18 -8 z" ${shape(PAPER, 7)}/>
  <path d="M398 330 l6 13 l13 6 l-13 6 l-6 13 l-6 -13 l-13 -6 l13 -6 z" ${shape(PAPER, 7)}/>`;
}

/** Stage 3: a gear pressed into a wax seal. */
function gearInSeal(a) {
  // The wax: a lumpy disc (12 bulges) with a drip.
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const r = i % 2 ? 132 : 146;
    pts.push(`${(256 + Math.cos(t) * r).toFixed(1)} ${(232 + Math.sin(t) * r).toFixed(1)}`);
  }
  const seal =
    `M${pts[0]} ` +
    pts
      .slice(1)
      .map((p) => `L${p}`)
      .join(" ") +
    " Z";
  const teeth = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * 360;
    teeth.push(
      `<rect x="240" y="138" width="32" height="34" rx="4" transform="rotate(${t} 256 232)" ${shape(PAPER)}/>`,
    );
  }
  return `
  <path d="M200 356 q-8 34 10 44 q16 -16 6 -46" ${shape(a)}/>
  <path d="${seal}" ${shape(a)}/>
  ${teeth.join("\n  ")}
  <circle cx="256" cy="232" r="72" ${shape(PAPER)}/>
  <circle cx="256" cy="232" r="24" ${shape(a)}/>`;
}

/** Stage 4: three linked rings. */
function linkedRings(a) {
  return `
  <circle cx="196" cy="200" r="66" fill="none" stroke="${INK}" stroke-width="30"/>
  <circle cx="196" cy="200" r="66" fill="none" stroke="${PAPER}" stroke-width="12"/>
  <circle cx="316" cy="200" r="66" fill="none" stroke="${INK}" stroke-width="30"/>
  <circle cx="316" cy="200" r="66" fill="none" stroke="${a}" stroke-width="12"/>
  <circle cx="256" cy="296" r="66" fill="none" stroke="${INK}" stroke-width="30"/>
  <circle cx="256" cy="296" r="66" fill="none" stroke="${PAPER}" stroke-width="12"/>
  <path d="M370 240 A66 66 0 0 1 310 266" fill="none" stroke="${INK}" stroke-width="30"/>
  <path d="M370 240 A66 66 0 0 1 310 266" fill="none" stroke="${a}" stroke-width="12"/>`;
}

const MOTIFS = [quillOnPage, nameTagWithKey, moonInShards, gearInSeal, linkedRings];

/** The SVG for one stage badge. Deterministic: the same input gives the same bytes (and sha256). */
export function badgeSvg(stage) {
  const a = ACCENTS[stage];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Book of NEAR, stage ${stage} badge: ${NAMES[stage]}">
  <title>Book of NEAR: Stage ${stage} (${NAMES[stage]})</title>
  <circle cx="256" cy="256" r="240" fill="${PAGE}" stroke="${INK}" stroke-width="12"/>
  <circle cx="256" cy="256" r="214" fill="none" stroke="${a}" stroke-width="10"/>
  <circle cx="256" cy="256" r="200" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="1 14" stroke-linecap="round"/>
  ${MOTIFS[stage](a).trim()}
  <path d="M120 392 h272 l-18 30 l18 30 h-272 l18 -30 z" ${shape(PAPER)}/>
  <text x="256" y="434" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="700" letter-spacing="4" fill="${INK}">STAGE ${stage}</text>
</svg>
`;
}

export const sha256b64 = (text) => createHash("sha256").update(text, "utf8").digest("base64");

/** Write every badge and art.json into `dir`; returns the art.json entries. */
export function writeArt(dir) {
  mkdirSync(dir, { recursive: true });
  const list = [];
  for (let s = 0; s < MOTIFS.length; s++) {
    const svg = badgeSvg(s);
    writeFileSync(join(dir, `stage-${s}.svg`), svg);
    list.push({ key: `stage-${s}`, media: `stage-${s}.svg`, sha256: sha256b64(svg) });
  }
  writeFileSync(join(dir, "art.json"), JSON.stringify(list, null, 2) + "\n");
  return list;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "badges");
  for (const a of writeArt(dir)) console.log(`${a.media}  sha256 ${a.sha256}`);
}
