/**
 * Pure layout and text for the 3D view of lesson 0.2. No three.js here, so it is unit tested and
 * never pulls 3D code into the 2D view.
 */
import type { CameraView, Vec3 } from "../../../scene-kit/motion";
import { STEP, type ArtFocus, type Verdict } from "./useWallet";

/** Where things stand on the paper. The chain runs back to front: words, private key, public key, address. */
export const POS = {
  words: [0, 0, -6],
  key: [0, 0, -1.9],
  lock: [0, 0, 2.2],
  address: [0, 0, 6.2],
  card: [3.6, 0, -0.2],
  bin: [-3.8, 0, -0.2],
} as const satisfies Record<string, Vec3>;

/** Block height for an address of `chars` characters: taller means longer to type. */
export function addressHeight(chars: number): number {
  return Math.max(0.45, (2.4 * chars) / 64);
}

/** Keeps the start and the end of a long value: `ed25519:Ex4stL…dY2vg`. */
export function shorten(value: string, max: number): string {
  if (value.length <= max) return value;
  const tail = Math.max(4, Math.floor(max / 3));
  return `${value.slice(0, max - tail - 1)}…${value.slice(-tail)}`;
}

/** A camera that looks at `target` from `offset` away. */
const v = (target: Vec3, offset: Vec3): CameraView => ({
  target,
  position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]],
});

// From the side, so the whole chain (back to front) reads left to right in a wide picture.
const OVERVIEW = v([-1.2, 0.5, 0.2], [15, 13, 4]);

/** One camera preset per step: it looks at what the step is about. */
export function cameraFor(step: number, focus: ArtFocus): CameraView {
  if (focus === "warning") return v([0, 1.2, 0], [2.5, 5.5, 13]);
  if (focus === "gone") return OVERVIEW;
  switch (step) {
    case STEP.generate:
      return v([0, 0.8, 0.1], [6, 6.5, 11]);
    case STEP.seed:
      return v([0, 0.5, -3.8], [3, 7, 9]);
    case STEP.address:
      return v([0, 1, 4.2], [10, 6.5, 6]);
    case STEP.compare:
      return v([0, 1, 6.2], [0, 5.5, 14]);
    case STEP.sign:
      return v([1.8, 0.6, -1], [4, 8, 10]);
    case STEP.verify:
      return v([1.8, 0.6, 1], [5, 8, 10]);
    default:
      return OVERVIEW;
  }
}

/** Which labels and objects a step shows. Fewer on small screens, so names never pile up. */
export interface Shown {
  /** Words, keys and arrows stand on the paper (step 5 clears them away for the three address blocks). */
  /** Small free area (phones): fewer, smaller labels. */
  compact: boolean;
  pipeline: boolean;
  words: boolean;
  /** The twelve words on their tiles. */
  wordList: boolean;
  key: boolean;
  lock: boolean;
  address: boolean;
  /** Key, address and message values under the objects. */
  values: boolean;
  /** The one arrow name that matters in this step. */
  arrow: string | null;
}

export function labelsFor(step: number, compact: boolean): Shown {
  const late = step >= STEP.custody;
  const at = (...steps: number[]) => steps.includes(step);
  return {
    compact,
    pipeline: step !== STEP.compare,
    words: compact ? at(STEP.seed) : at(STEP.generate, STEP.seed) || late,
    wordList: !compact && at(STEP.seed),
    key: compact ? at(STEP.generate) : at(STEP.generate, STEP.seed, STEP.sign) || late,
    lock: compact ? at(STEP.generate) : at(STEP.generate, STEP.address, STEP.verify) || late,
    address: compact ? at(STEP.address, STEP.compare) : at(STEP.address, STEP.compare) || late,
    values: !compact && step < STEP.check,
    arrow: compact
      ? null
      : step === STEP.generate
        ? "ed25519"
        : step === STEP.seed
          ? "SLIP-10 path"
          : step === STEP.address
            ? "write as hex"
            : null,
  };
}

/** What the 3D view shows, in one sentence, for screen readers. */
export function describe3d(focus: ArtFocus, verdict: Verdict, cleared: boolean): string {
  if (focus === "warning") return "A warning sign. No practice keys exist yet.";
  if (cleared) return "The seed words and both keys were dropped into a bin. They are gone from this page.";
  if (focus === "gone")
    return "Empty places for the seed words, the keys and the address. There are no keys on this page.";
  const base =
    "Twelve word tiles fold into a covered private key. The key casts a padlock, the public key. The padlock becomes an address block.";
  if (focus === "address")
    return `${base} Three address blocks can stand side by side; their height shows how long each address is.`;
  if (focus === "sign") return `${base} The private key stamps a seal, the signature, onto a message card.`;
  if (focus === "verify")
    return `${base} The public key checks the seal on the card: ${
      verdict === "pass"
        ? "it matches, the seal turns green"
        : verdict === "fail"
          ? "it does not match, the seal cracks red"
          : "not checked yet"
    }.`;
  return base;
}
