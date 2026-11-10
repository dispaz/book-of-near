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
export const GROUND = "#f3efe4";
/** Card white (`--card`): slips, notes, cards and screens lying on the page. */
export const PAPER = "#fffdf7";

/**
 * NEAR's brand colours (the --near-* tokens): green, black and off-white.
 * `forest` is a deep shade of the green for the book's cloth cover, where the full brand green would
 * shout over the lesson's figure.
 */
export const NEAR = {
  green: "#00ec97",
  black: "#000000",
  offWhite: "#f2f1ea",
  /** A deep shade of the brand green: the book's cloth cover. */
  forest: "#145c43",
} as const;

export const COLORS = {
  orange: "#ff8a3d",
  blue: "#4d6bff",
  pink: "#ff5fa2",
  violet: "#8a5cf6",
  ochre: "#c9a227",
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
  paper: PAPER,
} as const;

/** One accent per stage (`StageManifest.accent`). Ink text sits on it, so each keeps 4.5:1 with INK. */
export const STAGE_ACCENTS = {
  0: COLORS.orange,
  1: COLORS.blue,
  2: COLORS.pink,
  3: COLORS.green,
  4: COLORS.violet,
  7: COLORS.ochre,
} as const;

/** Every colour custom property on ink.css's `:root`, with its value. */
export const CSS_TOKENS = {
  "--ink": INK,
  /** The app background. */
  "--paper": "#efeadd",
  /** Raised panels and cards in the app's chrome. */
  "--paper-2": "#f6f2e8",
  "--page": GROUND,
  "--card": PAPER,
  "--desk": "#d8dfd6",
  "--wood": "#e9e1cf",
  "--orange": COLORS.orange,
  "--blue": COLORS.blue,
  "--pink": COLORS.pink,
  "--green": COLORS.green,
  "--red": COLORS.red,
  "--glass": "#ffffffcc",
  /** Secondary text. */
  "--mute": "#5d5a68",
  "--near-green": NEAR.green,
  "--near-black": NEAR.black,
  "--near-off-white": NEAR.offWhite,
  "--near-forest": NEAR.forest,
} as const;
