/** Ink palette shared by the 3D kit and the SVG kit (matches src/ui/ink.css). */
export const INK = "#16141f";
export const GROUND = "#f3efe4";
export const PAPER = "#fffdf7";

/**
 * NEAR's brand colours (matches the --near-* tokens in src/ui/ink.css). `green` is the brand green;
 * the deeper greens and the mint are tints and shades of it for the book's setting (cloth cover,
 * felt mat, rug, cushions), where the full brand green would shout over the lesson's figure.
 */
export const NEAR = {
  green: "#00ec97",
  black: "#000000",
  offWhite: "#f2f1ea",
  /** Shades and tints of the brand green, for the setting. */
  deep: "#0a7d55",
  forest: "#145c43",
  mint: "#cfeedd",
  sage: "#b9dccb",
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
