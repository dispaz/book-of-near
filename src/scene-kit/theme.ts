/**
 * The app's palette: the one source of truth for colour. See docs/palette.md for the layers and rules.
 *
 * `src/ui/ink.css` repeats these values as CSS custom properties on `:root` (CSS needs them before any
 * script runs); `palette.test.ts` fails if the two drift apart, if a token's hex is hard-coded anywhere
 * else in `src`, or if text contrast drops below WCAG AA. CSS uses `var(--…)`; scripts import from here.
 */

/** Ink: outlines and text. */
export const INK = "#16141f";
/** The book's page colour (`--page`): the ground figures stand on. */
export const PAGE = "#f3efe4";
/** Card white (`--card`): slips, notes, cards and screens lying on the page. */
export const CARD = "#fffdf7";
/** Secondary text (`--mute`): a warm grey, like NEAR's neutrals (5.6:1 on --paper). */
export const MUTE = "#625f57";

/**
 * NEAR's brand colours (the --near-* tokens): green, black and off-white.
 * `forest` is a deep shade of the green for the book's cloth cover, where the full brand green would
 * shout over the lesson's figure.
 */
export const NEAR = {
  green: "#00ec97",
  black: "#000000",
  offWhite: "#f2f1e9",
  /** A deep shade of the brand green: the book's cloth cover. */
  forest: "#145c43",
} as const;

export const COLORS = {
  orange: "#ff8a3d",
  blue: "#5f7bff",
  pink: "#ff5fa2",
  violet: "#9a70f7",
  /** Stage 3. A sky blue: well clear of NEAR green, so a stage-3 highlight never reads as a coin. */
  cerulean: "#1e9bd7",
  ochre: "#c9a227",
  /** Stage 5. An orchid: clear of NEAR green and of stage 2 pink and stage 4 violet. */
  orchid: "#c86bd6",
  /** Stage 6. An olive: civic and earthy, well clear of NEAR green. */
  olive: "#8f9e2a",
  /** The "pass" mark (checks, verdicts). Not a NEAR colour. */
  green: "#2fa36b",
  red: "#d8433b",
  gold: "#f2c230",
  /** NEAR tokens: coins are NEAR green and carry the NEAR mark (see nearMark.ts). */
  near: NEAR.green,
  slab: "#e9e2d0",
  contract: "#cfc6f2",
  chain: "#d7e3d0",
  /** Parcels (transactions): brown paper. */
  kraft: "#e3c79b",
  /** Light tints for action cards: dark small text stays readable on them; the marks carry the meaning. */
  greenTint: "#bfe6cf",
  redTint: "#f4bdb8",
  /** Paper white for figures in 3D and SVG: the same value as CARD (`--card`). */
  paper: CARD,
} as const;

/** A token at partial opacity for canvas and three.js (CSS uses `color-mix()` instead). */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** One accent per stage (`StageManifest.accent`). Ink text sits on it, so each keeps 4.5:1 with INK. */
export const STAGE_ACCENTS = {
  0: COLORS.orange,
  1: COLORS.blue,
  2: COLORS.pink,
  3: COLORS.cerulean,
  4: COLORS.violet,
  5: COLORS.orchid,
  6: COLORS.olive,
  7: COLORS.ochre,
} as const;

/** Every colour custom property on ink.css's `:root`, with its value. */
export const CSS_TOKENS = {
  "--ink": INK,
  /** The app background: NEAR off-white. */
  "--paper": NEAR.offWhite,
  /** Raised panels and cards in the app's chrome. */
  "--paper-2": "#f7f6f0",
  "--page": PAGE,
  "--card": CARD,
  "--desk": "#d8dfd6",
  "--wood": "#e9e1cf",
  "--orange": COLORS.orange,
  "--blue": COLORS.blue,
  "--pink": COLORS.pink,
  "--green": COLORS.green,
  "--red": COLORS.red,
  "--glass": "#ffffffcc",
  "--mute": MUTE,
  "--near-green": NEAR.green,
  "--near-black": NEAR.black,
  "--near-off-white": NEAR.offWhite,
  "--near-forest": NEAR.forest,
} as const;
