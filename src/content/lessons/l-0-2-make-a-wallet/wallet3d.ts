/**
 * Pure layout and text for the 3D view of lesson 0.2. No three.js here, so it is unit tested and
 * never pulls 3D code into the 2D view.
 */
import { focusOf, type Box, type Focus, type Reserve } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
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

/** What the paper shows: the warning sign, empty places for the keys, or the keys themselves. */
export type Drawn = "warning" | "ghosts" | "keys";

/**
 * The warning sign stands for the whole first step (and step 2 until the box is ticked); without keys
 * the paper shows empty places; otherwise the words, keys and address.
 */
export function drawnFor(step: number, { ack, alive }: { ack: boolean; alive: boolean }): Drawn {
  if (step === STEP.warning || (step === STEP.generate && !ack && !alive)) return "warning";
  return alive ? "keys" : "ghosts";
}

const around = (p: Vec3, hx: number, hz: number, h: number): Box => [
  p[0] - hx,
  p[0] + hx,
  p[2] - hz,
  p[2] + hz,
  h,
];

const SIGN: Box = [-1.6, 1.6, -0.7, 1.3, 3];
const WORDS = around(POS.words, 1.9, 1.7, 1.2);
const KEY = around(POS.key, 1.1, 1.0, 2.0);
const LOCK = around(POS.lock, 0.9, 1.0, 2.1);
const ADDRESS = around(POS.address, 1.0, 1.4, addressHeight(64) + 0.9);
const CARD = around(POS.card, 1.3, 1.3, 2.6);
const BIN = around(POS.bin, 1.0, 0.8, 2.7);
/** The four empty places, with the hint beside them. */
const PLACES: Box = [-1, 3.4, POS.words[2] - 0.7, POS.address[2] + 0.7, 0.6];
/** Step 5: three address blocks side by side, with their names and rules in front. */
const ROW: Box = [-4, 4, POS.address[2] - 1, POS.address[2] + 3.3, addressHeight(64) + 0.9];

/**
 * Looking along the chain from the front, a little from the right: the words stand at the top and the
 * address at the bottom, like the 2D drawing, which suits the tall free frame beside the note.
 */
const ALONG_TALL = 20;
const SIDE = 75;

/**
 * What the camera must keep in view at each step (fitted into the free frame with `frameCamera`), and
 * the pixels to keep free around it for labels.
 */
export function shotFor(
  step: number,
  drawn: Drawn,
  compact: boolean,
  /** The free frame is taller than wide (beside the note); otherwise a wide band (phones). */
  tall = true,
): { focus: Focus; reserve: Reserve } {
  const reserve: Reserve = compact ? { top: 10, bottom: 6 } : { top: 24, bottom: 16 };
  // In a wide band, look from the side instead, so the chain runs across it.
  const ALONG = tall ? ALONG_TALL : SIDE;
  const shot = (boxes: Box[], elevation: number, azimuth: number) => ({
    focus: focusOf(boxes, elevation, azimuth),
    reserve,
  });
  if (drawn === "warning") return shot([SIGN], 23, 11);
  if (drawn === "ghosts") return shot(step >= STEP.custody ? [PLACES, BIN] : [PLACES], 45, ALONG);
  const o = objectsFor(step);
  const chain = [o.words ? WORDS : null, o.key ? KEY : null, o.lock ? LOCK : null].filter(
    (b): b is Box => b !== null,
  );
  switch (step) {
    case STEP.generate:
      return shot(chain, 40, ALONG);
    case STEP.seed:
      return shot(chain, 46, tall ? 12 : 68);
    case STEP.address:
      return shot([...chain, ADDRESS], 36, tall ? 28 : SIDE);
    case STEP.compare:
      return shot([ROW], 21, 0);
    case STEP.sign:
      return shot([...chain, CARD], 40, ALONG);
    case STEP.verify:
      return shot([...chain, CARD], 38, 26);
    default:
      return shot([BIN, ...chain, ADDRESS], 45, ALONG);
  }
}

/**
 * Which of the words, private key and public key stand on the paper. Each step keeps only what it is
 * about, so nothing it does not frame hangs out under the panel or the step heading.
 */
export function objectsFor(step: number): { words: boolean; key: boolean; lock: boolean; address: boolean } {
  switch (step) {
    case STEP.address:
      return { words: false, key: true, lock: true, address: true };
    case STEP.compare:
      return { words: false, key: false, lock: false, address: true };
    case STEP.sign:
      return { words: false, key: true, lock: false, address: false };
    case STEP.verify:
      return { words: false, key: false, lock: true, address: false };
    default:
      return { words: true, key: true, lock: true, address: step >= STEP.custody };
  }
}

/** Which labels and objects a step shows. Fewer on small screens, so names never pile up. */
export interface Shown {
  /** Small free area (phones): fewer, smaller labels. */
  compact: boolean;
  /** Words, keys and arrows stand on the paper (step 5 clears them away for the three address blocks). */
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

/** The words picked objects show (docs/lessons/stage-0/0.2.md, "Reactions"). Never a key value. */
export const REACTION = {
  noKeys: "Generate a key pair first",
  noMessage: "Write a message first",
  noAddress: "Turn it into an address first",
  noSignature: "Sign the message first",
  words: "12 BIP-39 seed words: they rebuild this key",
  rebuilt: "Same key again: 12 BIP-39 words along the SLIP-10 path m/44'/397'/0'",
  key: "ed25519 private key: secret, used to sign",
  signature: "Signature: 64 bytes, made by this key",
  implicit: "NEAR implicit address: 64 hex characters",
  eth: "Ethereum address: 42 characters starting with 0x",
  named: "Named account: a readable name, like ana.testnet",
  sealed: "Sealed: a 64-byte ed25519 signature covers this text",
  tampered: "One letter changed: the signature does not match",
  cleared: "Memory cleared: 0 keys left on this page",
} as const;

/** What a pick does besides its action: a "not yet" hint, or a detail once the step is done. */
export type Reaction = { disabledHint?: string; detail?: string };

export interface ReactionState {
  keys: boolean;
  cleared: boolean;
  /** The message box is not empty. */
  message: boolean;
  /** The current message is signed. */
  signed: boolean;
  rebuilt: boolean;
  /** The address conversion has finished. */
  addressDone: boolean;
  /** Ethereum, implicit, named: whose rule was shown. */
  flipped: readonly boolean[];
  verdict: Verdict;
}

const hint = (text: string): Reaction => ({ disabledHint: text });
const detail = (text: string): Reaction => ({ detail: text });
const none: Reaction = {};

/** The reaction of each clickable object at this step (rule 10a in docs/book-scene.md). */
export function reactionsFor(step: number, s: ReactionState) {
  const at = (...steps: number[]) => steps.includes(step);
  return {
    /** The empty places drawn before any key exists. */
    ghost: s.cleared ? none : hint(REACTION.noKeys),
    words: at(STEP.seed) ? (s.rebuilt ? detail(REACTION.rebuilt) : none) : detail(REACTION.words),
    key: at(STEP.sign)
      ? !s.message
        ? hint(REACTION.noMessage)
        : s.signed
          ? detail(REACTION.signature)
          : none
      : detail(REACTION.key),
    address: at(STEP.address)
      ? s.addressDone
        ? detail(REACTION.implicit)
        : hint(REACTION.noAddress)
      : at(STEP.compare) && !s.flipped[1]
        ? none
        : detail(REACTION.implicit),
    eth: s.flipped[0] ? detail(REACTION.eth) : none,
    named: s.flipped[2] ? detail(REACTION.named) : none,
    card: !s.signed
      ? hint(REACTION.noSignature)
      : at(STEP.verify)
        ? s.verdict === "fail"
          ? detail(REACTION.tampered)
          : none
        : detail(REACTION.sealed),
    bin: s.cleared ? detail(REACTION.cleared) : none,
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
