/**
 * The video's palette and stage data. Colours come from the app's single source of truth
 * (src/scene-kit/theme.ts, docs/palette.md): never hard-code a token here.
 */
import { CARD, INK, MUTE, NEAR, PAGE, STAGE_ACCENTS, withAlpha } from "../../src/scene-kit/theme.ts";

export { CARD, INK, MUTE, NEAR, PAGE, STAGE_ACCENTS, withAlpha };

export const FONTS = {
  serif: "Newsreader, Georgia, serif",
  hand: "Caveat, 'Comic Sans MS', cursive",
  ui: "'DM Sans', system-ui, sans-serif",
} as const;

/** The eight stages, as src/content/stages/<n>-<slug>/stage.ts names them. */
export const STAGES = [
  { id: 0, name: "Blank Page", title: "Crypto foundations" },
  { id: 1, name: "Named", title: "First steps on NEAR" },
  { id: 2, name: "Nightshade", title: "Under the hood" },
  { id: 3, name: "Wasm", title: "Builder" },
  { id: 4, name: "Any Chain", title: "Chain abstraction" },
  { id: 5, name: "Enclave", title: "User-owned AI" },
  { id: 6, name: "Citizen", title: "Ecosystem and governance" },
  { id: 7, name: "Book of NEAR", title: "Veteran capstone" },
] as const;

export const accentOf = (stage: number): string => STAGE_ACCENTS[stage as keyof typeof STAGE_ACCENTS] ?? INK;
