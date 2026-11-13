#!/usr/bin/env node
/**
 * `npm run badges:art`: draws the eight stage badges (0 to 7) and the four final badge tiers as SVG in the book's ink style (black
 * outline on paper-white) in NEAR's own palette into public/badges/, and writes public/badges/art.json
 * with each file's base64 sha256 for the contract's `set_art` (`node scripts/deploy-badge.mjs art`).
 * The art is code: revise a motif here and re-run; nothing else changes.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// The palette's one source of truth (Node runs the .ts file directly: it has no imports).
import { NEAR } from "../src/scene-kit/theme.ts";

/**
 * Badges are NEAR-branded proof, so they use NEAR's palette only (docs/palette.md, "Badge art"): NEAR
 * black outlines, NEAR off-white ground and paper, NEAR green, and its deep forest shade for second parts.
 */
const INK = NEAR.black;
const PAPER = NEAR.offWhite;
const GREEN = NEAR.green;
const FOREST = NEAR.forest;

export const NAMES = [
  "Blank Page",
  "Named",
  "Nightshade",
  "Wasm",
  "Any Chain",
  "Enclave",
  "Citizen",
  "Book of NEAR",
];

const lineW = (w) =>
  `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const line = lineW(10);
const shape = (fill, w = 10) => `fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;

/** Stage 0: a quill over a blank page. */
function quillOnPage() {
  return `
  <g transform="rotate(-6 256 236)">
    <path d="M170 128 h150 l30 30 v170 h-180 z" ${shape(PAPER)}/>
    <path d="M320 128 v30 h30" ${line}/>
  </g>
  <path d="M352 96 C300 120 236 196 210 300 C262 262 330 200 368 112 Z" ${shape(GREEN)}/>
  <path d="M352 104 C300 160 252 230 214 296" ${lineW(7)}/>
  <path d="M210 300 L196 336" ${line}/>
  <path d="M168 344 q30 -14 56 0" ${lineW(7)}/>`;
}

/** Stage 1: a name tag with a key. */
function nameTagWithKey() {
  return `
  <path d="M150 150 h170 a20 20 0 0 1 20 20 v120 a20 20 0 0 1 -20 20 h-170 l-46 -80 z" ${shape(GREEN)}/>
  <circle cx="142" cy="230" r="12" ${shape(PAPER)}/>
  <path d="M188 206 h110 M188 248 h80" ${line}/>
  <path d="M342 318 L404 260 M378 284 l18 18 M394 270 l14 14" ${line}/>
  <circle cx="318" cy="340" r="38" ${shape(PAPER)}/>
  <circle cx="318" cy="340" r="11" ${shape(FOREST)}/>`;
}

/** Stage 2: a moon split into shards. */
function moonInShards() {
  const shard = (d, dx, dy) => `<path d="${d}" transform="translate(${dx} ${dy})" ${shape(GREEN)}/>`;
  return `
  ${shard("M256 106 A130 130 0 0 1 380 196 L300 214 L256 160 Z", 8, -8)}
  ${shard("M380 196 A130 130 0 0 1 300 352 L282 278 L300 214 Z", 12, 6)}
  ${shard("M300 352 A130 130 0 0 1 140 300 L216 262 L282 278 Z", -2, 14)}
  ${shard("M140 300 A130 130 0 0 1 256 106 L256 160 L216 262 Z", -12, -4)}
  <circle cx="226" cy="200" r="12" ${shape(FOREST, 7)}/>
  <circle cx="318" cy="262" r="9" ${shape(FOREST, 7)}/>
  <path d="M126 132 l8 18 l18 8 l-18 8 l-8 18 l-8 -18 l-18 -8 l18 -8 z" ${shape(PAPER, 7)}/>
  <path d="M398 330 l6 13 l13 6 l-13 6 l-6 13 l-6 -13 l-13 -6 l13 -6 z" ${shape(PAPER, 7)}/>`;
}

/** Stage 3: a gear pressed into a wax seal. */
function gearInSeal() {
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
  <path d="M200 356 q-8 34 10 44 q16 -16 6 -46" ${shape(GREEN)}/>
  <path d="${seal}" ${shape(GREEN)}/>
  ${teeth.join("\n  ")}
  <circle cx="256" cy="232" r="72" ${shape(PAPER)}/>
  <circle cx="256" cy="232" r="24" ${shape(FOREST)}/>`;
}

/** A block of a chain: an ink cube (top and side faces, then the front with a header line). */
function block([x, y], size, fill) {
  const d = 14;
  return `<g data-part="block">
    <path d="M${x} ${y} l${d} ${-d} h${size} l${-d} ${d} z" ${shape(fill, 8)}/>
    <path d="M${x + size} ${y} l${d} ${-d} v${size} l${-d} ${d} z" ${shape(fill, 8)}/>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="4" ${shape(fill, 8)}/>
    <path d="M${x + 12} ${y + 16} h${size - 24}" ${lineW(6)}/>
  </g>`;
}

/**
 * A chain link from (x1, y1) to (x2, y2): two interlocked loops, one flat and one seen edge-on. The
 * ends tuck under the blocks, so only the middle shows.
 */
function link(x1, y1, x2, y2) {
  const len = Math.round(Math.hypot(x2 - x1, y2 - y1));
  const rot = Math.round((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI);
  const w = Math.round(len * 0.62);
  const loop = (cx, h) =>
    `<rect x="${cx - w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="none" stroke="${INK}" stroke-width="9"/>`;
  return `<g data-part="link" transform="translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${rot})">
    ${loop(-len * 0.19, 30)}
    ${loop(len * 0.19, 9)}
  </g>`;
}

/**
 * Stage 4: three short blockchains (three different chains: green, forest, paper), each a row of
 * linked blocks, and chain links joining the chains to each other.
 */
function blockchains() {
  const s = 50;
  // Three columns; the middle one is where the chains meet.
  const [c0, c1, c2] = [116, 228, 340];
  const A = [
    [c0, 126],
    [c1, 126],
  ];
  const B = [
    [c1, 222],
    [c2, 222],
  ];
  const C = [
    [c0, 318],
    [c1, 318],
  ];
  const links = [];
  // Along each chain: block i's middle to block i+1's middle (the blocks cover the ends).
  for (const chain of [A, B, C])
    for (let i = 1; i < chain.length; i++) {
      const [x1, y1] = chain[i - 1];
      const [x2] = chain[i];
      links.push(link(x1 + s / 2 + 10, y1 + s / 2, x2 + s / 2 - 10, y1 + s / 2));
    }
  // Between chains, down the middle column: A to B, B to C.
  const down = (top, bottom) => link(top[0] + s / 2, top[1] + s / 2, bottom[0] + s / 2, bottom[1] + s / 2);
  links.push(down(A[1], B[0]), down(B[0], C[1]));
  return `<g data-motif="blockchains">
  ${links.join("\n  ")}
  ${A.map((p) => block(p, s, GREEN)).join("\n  ")}
  ${B.map((p) => block(p, s, FOREST)).join("\n  ")}
  ${C.map((p) => block(p, s, PAPER)).join("\n  ")}
  </g>`;
}

/** Stage 5: a chip with a padlock on it (an enclave: private compute whose code can be checked). */
function lockedChip() {
  const pins = [];
  for (let i = 0; i < 4; i++) {
    const o = 172 + i * 56;
    pins.push(`M${o} 108 v-22`, `M${o} 356 v22`, `M128 ${o - 30} h-22`, `M384 ${o - 30} h22`);
  }
  const shackle = "M212 222 v-34 a44 44 0 0 1 88 0 v34";
  return `
  <path d="${pins.join(" ")}" ${lineW(12)}/>
  <rect x="128" y="108" width="256" height="248" rx="22" ${shape(FOREST)}/>
  <rect x="152" y="132" width="208" height="200" rx="12" fill="none" stroke="${PAPER}" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>
  <path d="${shackle}" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>
  <path d="${shackle}" fill="none" stroke="${PAPER}" stroke-width="12" stroke-linecap="round"/>
  <rect x="186" y="216" width="140" height="104" rx="14" ${shape(GREEN)}/>
  <path d="M256 250 a15 15 0 0 1 8 27 l6 24 h-28 l6 -24 a15 15 0 0 1 8 -27 z" ${shape(INK, 4)}/>`;
}

/** Stage 6: a ballot with a tick going into a ballot box (a citizen's vote). */
function ballotBox() {
  return `
  <g transform="rotate(-8 270 170)">
    <path d="M206 92 h112 l20 20 v128 h-132 z" ${shape(PAPER)}/>
    <path d="M232 156 l22 24 l44 -52" ${lineW(14)}/>
  </g>
  <path d="M124 220 l40 -32 h184 l40 32 z" ${shape(FOREST)}/>
  <rect x="124" y="220" width="264" height="140" rx="10" ${shape(GREEN)}/>
  <path d="M190 220 h132" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>
  <rect x="210" y="262" width="92" height="52" rx="10" ${shape(PAPER, 8)}/>
  <path d="M232 288 h48" ${lineW(8)}/>`;
}

/** Stage 7: an open book with one dotted trail across both pages, start to flag (one intent, end to end). */
function tracedBook() {
  return `
  <path d="M108 320 v18 c52 -10 106 -4 148 20 c42 -24 96 -30 148 -20 v-18" ${shape(FOREST)}/>
  <path d="M256 150 C214 124 160 120 108 130 v190 c52 -10 106 -6 148 20 z" ${shape(PAPER)}/>
  <path d="M256 150 C298 124 352 120 404 130 v190 c-52 -10 -106 -6 -148 20 z" ${shape(PAPER)}/>
  <path d="M256 150 v190" ${lineW(8)}/>
  <path d="M164 272 C186 214 226 252 256 216 C284 182 318 236 346 188" fill="none" stroke="${INK}" stroke-width="10" stroke-dasharray="2 18" stroke-linecap="round"/>
  <circle cx="156" cy="284" r="20" ${shape(GREEN)}/>
  <path d="M352 184 v-76" ${line}/>
  <path d="M352 108 h52 l-14 18 l14 18 h-52 z" ${shape(GREEN)}/>`;
}

const MOTIFS = [
  quillOnPage,
  nameTagWithKey,
  moonInShards,
  gearInSeal,
  blockchains,
  lockedChip,
  ballotBox,
  tracedBook,
];

/** The SVG for one stage badge. Deterministic: the same input gives the same bytes (and sha256). */
export function badgeSvg(stage) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Book of NEAR, stage ${stage} badge: ${NAMES[stage]}">
  <title>Book of NEAR: Stage ${stage} (${NAMES[stage]})</title>
  <circle cx="256" cy="256" r="240" fill="${PAPER}" stroke="${INK}" stroke-width="12"/>
  <circle cx="256" cy="256" r="214" fill="none" stroke="${GREEN}" stroke-width="12"/>
  <circle cx="256" cy="256" r="200" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="1 14" stroke-linecap="round"/>
  ${MOTIFS[stage]().trim()}
  <path d="M120 392 h272 l-18 30 l18 30 h-272 l18 -30 z" ${shape(PAPER)}/>
  <text x="256" y="434" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="700" letter-spacing="4" fill="${INK}">STAGE ${stage}</text>
</svg>
`;
}

/** The final badge's tiers (contracts/badge `claim_final`), lowest first. */
export const RARITIES = ["common", "rare", "epic", "legendary"];

/** A five-point star centred on (cx, cy). */
function star(cx, cy, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<path data-part="star" d="M${pts.join(" L")} Z" ${shape(fill, 6)}/>`;
}

/**
 * The final badge for one tier: a closed book with a seal on its cover. The tier shows in three ways
 * that need no colour: one to four stars, the ring (single for common, doubled from rare up, green
 * filled band for legendary) and its name on the ribbon.
 */
export function finalSvg(rarity) {
  const tier = RARITIES.indexOf(rarity);
  if (tier < 0) throw new Error(`Unknown rarity: ${rarity}`);
  const n = tier + 1;
  const stars = [...Array(n).keys()]
    .map((i) => star(256 + (i - (n - 1) / 2) * 56, 102, 20, tier >= 2 ? GREEN : PAPER))
    .join("\n  ");
  const ring =
    tier === 3
      ? `<circle cx="256" cy="256" r="214" fill="none" stroke="${GREEN}" stroke-width="26"/>`
      : `<circle cx="256" cy="256" r="214" fill="none" stroke="${GREEN}" stroke-width="12"/>`;
  const inner =
    tier >= 1 ? `\n  <circle cx="256" cy="256" r="192" fill="none" stroke="${INK}" stroke-width="4"/>` : "";
  const label = rarity.toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Book of NEAR, final badge: ${rarity}" data-rarity="${rarity}">
  <title>Book of NEAR: Final badge (${rarity})</title>
  <circle cx="256" cy="256" r="240" fill="${PAPER}" stroke="${INK}" stroke-width="12"/>
  ${ring}${inner}
  <path d="M164 150 h176 a12 12 0 0 1 12 12 v196 h-188 z" ${shape(FOREST)}/>
  <path d="M164 358 h188 v20 h-176 a12 12 0 0 1 -12 -12 z" ${shape(PAPER)}/>
  <path d="M190 150 v208" ${lineW(6)}/>
  <circle cx="272" cy="248" r="52" ${shape(GREEN)}/>
  <circle cx="272" cy="248" r="36" fill="none" stroke="${INK}" stroke-width="5" stroke-dasharray="1 10" stroke-linecap="round"/>
  <path d="M252 250 l14 14 l26 -30" ${line}/>
  ${stars}
  <path d="M110 392 h292 l-18 30 l18 30 h-292 l18 -30 z" ${shape(PAPER)}/>
  <text x="256" y="434" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="700" letter-spacing="2" fill="${INK}">${label}</text>
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
  for (const r of RARITIES) {
    const svg = finalSvg(r);
    writeFileSync(join(dir, `final-${r}.svg`), svg);
    list.push({ key: `final-${r}`, media: `final-${r}.svg`, sha256: sha256b64(svg) });
  }
  writeFileSync(join(dir, "art.json"), JSON.stringify(list, null, 2) + "\n");
  return list;
}

/**
 * The art.json entries `deploy-badge.mjs art` sends: all of them, or only `--keys stage-0,stage-4`.
 * Throws on `--keys` with no value, and names the keys that are not in art.json.
 */
export function selectArt(all, argv) {
  const at = argv.indexOf("--keys");
  if (at < 0) return all;
  const value = argv[at + 1];
  if (!value || value.startsWith("--")) throw new Error("--keys needs a value, for example --keys stage-4");
  const keys = value.split(",").filter(Boolean);
  const unknown = keys.filter((k) => !all.some((a) => a.key === k));
  if (unknown.length) throw new Error(`Unknown key in --keys: ${unknown.join(", ")}`);
  return all.filter((a) => keys.includes(a.key));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "badges");
  for (const a of writeArt(dir)) console.log(`${a.media}  sha256 ${a.sha256}`);
}
