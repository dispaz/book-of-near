/** Ink palette shared by the 3D kit and the SVG kit (matches src/ui/ink.css). */
export const INK = "#16141f";
export const GROUND = "#f3efe4";
export const PAPER = "#fffdf7";

/**
 * NEAR's brand colours (matches the --near-* tokens in src/ui/ink.css): green, black and off-white.
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
