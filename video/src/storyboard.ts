/**
 * The storyboard: the one place for the video's order, timing and copy. Edit here, then preview in
 * `npm run studio`. The total must stay under 60 s (checked in Root.tsx).
 *
 * `clip` names a recording made by `npm run capture` (capture/shots.ts has the same ids). A scene without
 * a recording yet shows a labelled placeholder, so the video always renders.
 */
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export type ClipId = "home" | "book-open" | "learn" | "stages" | "check" | "claim" | "proof";

export type Scene =
  | { kind: "intro"; id: string; seconds: number }
  | {
      kind: "clip";
      id: string;
      seconds: number;
      clip: ClipId;
      /** Stage accent for the frame and the margin note. */
      stage: number;
      /** Small label over the note, like a chapter heading. */
      eyebrow: string;
      /** The margin note: plain English, short, no hype (CLAUDE.md "Learner copy"). */
      note: string;
      /** Slow push-in on the footage: end scale (1 = none). */
      zoom?: number;
      /** Where the push-in heads, as CSS transform-origin. */
      focus?: string;
    }
  | { kind: "badges"; id: string; seconds: number }
  | { kind: "wallet"; id: string; seconds: number }
  | { kind: "outro"; id: string; seconds: number };

export const SCENES: Scene[] = [
  { kind: "intro", id: "intro", seconds: 4 },
  {
    kind: "clip",
    id: "home",
    clip: "home",
    seconds: 5,
    stage: 0,
    eyebrow: "The contents",
    note: "Eight stages, from a blank page to chain abstraction.",
    zoom: 1.04,
  },
  {
    kind: "clip",
    id: "book-open",
    clip: "book-open",
    seconds: 6,
    stage: 0,
    eyebrow: "Every lesson is a book",
    note: "Open it, and the page pops up into 3D.",
    zoom: 1.06,
    focus: "65% 55%",
  },
  {
    kind: "clip",
    id: "learn",
    clip: "learn",
    seconds: 9,
    stage: 0,
    eyebrow: "Learn by doing",
    note: "Send coins, open blocks, break the chain and watch it heal.",
    zoom: 1.03,
  },
  {
    kind: "clip",
    id: "stages",
    clip: "stages",
    seconds: 8,
    stage: 2,
    eyebrow: "Turn to any stage",
    note: "Named accounts, shards, contracts, one account on every chain.",
  },
  {
    kind: "clip",
    id: "check",
    clip: "check",
    seconds: 4,
    stage: 0,
    eyebrow: "Then a quick check",
    note: "Three questions, and an honest take on NEAR.",
  },
  {
    kind: "clip",
    id: "claim",
    clip: "claim",
    seconds: 6,
    stage: 0,
    eyebrow: "Finish a stage, earn its badge",
    // True for both takes: the demo capture (badge kept in the browser) and --testnet (a real NFT).
    note: "Claim it. On testnet it is minted to your own account.",
    zoom: 1.05,
    focus: "50% 40%",
  },
  {
    kind: "clip",
    id: "proof",
    clip: "proof",
    seconds: 4,
    stage: 0,
    eyebrow: "Anyone can check it",
    note: "A real NFT on NEAR testnet. It cannot be sold or sent.",
  },
  { kind: "badges", id: "badges", seconds: 6 },
  { kind: "wallet", id: "wallet", seconds: 5 },
  { kind: "outro", id: "outro", seconds: 4 },
];

/** Frames each scene overlaps the next (the page-turn transition). */
export const TURN = 12;

export const totalFrames = (scenes: Scene[] = SCENES) =>
  scenes.reduce((n, s) => n + Math.round(s.seconds * FPS), 0) - TURN * (scenes.length - 1);

export const LINKS = {
  site: "book-of-near.pages.dev",
  repo: "github.com/dispaz/book-of-near",
} as const;
