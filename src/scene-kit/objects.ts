/**
 * The scene-object vocabulary (docs/scene-objects.md): one shape per concept, the same in 3D and 2D.
 * Pure: no three.js, no React, so the SVG kit, manifests and tests can import it.
 */
import { COLORS } from "./theme";

/** How every object shows what is happening to it. Lessons do not restyle objects. */
export type ObjectState = "ok" | "pending" | "failed" | "gone";

export interface ObjectLook {
  /** Fill colour, or null for an outline only. */
  fill: string | null;
  /** Dashed outline: not created yet. */
  dashed: boolean;
  /** A red cross over the object: refused or failed. */
  cross: boolean;
  /** A line through it: deleted, revoked. */
  struck: boolean;
}

export function lookOf(state: ObjectState, accent: string): ObjectLook {
  switch (state) {
    case "pending":
      return { fill: null, dashed: true, cross: false, struck: false };
    case "failed":
      return { fill: COLORS.red, dashed: false, cross: true, struck: false };
    case "gone":
      return { fill: COLORS.slab, dashed: false, cross: false, struck: true };
    default:
      return { fill: accent, dashed: false, cross: false, struck: false };
  }
}

/** The concepts and their shapes. One shape per concept. */
export const OBJECTS = {
  account: { shape: "mailbox", note: "a named place that receives things" },
  transaction: { shape: "parcel", note: "packed with actions, addressed to one receiver" },
  action: { shape: "card", note: "one item packed inside the parcel" },
  signature: { shape: "stamp", note: "the sender's mark on the parcel" },
  contract: { shape: "scroll", note: "written rules that run as code (the gear)" },
  fullAccessKey: { shape: "key", note: "opens everything" },
  functionCallKey: { shape: "tagged-key", note: "a key with a tag: one contract, an allowance" },
  token: { shape: "coin", note: "money" },
  app: { shape: "screen", note: "an app: a program that can hold a key and sign with it" },
  receipt: { shape: "slip", note: "a delivery slip: what an action becomes when it moves on" },
  shard: { shape: "ribbon", note: "a section of the book, marked by its own ribbon" },
  signingNode: {
    shape: "figure at a desk",
    note: "one node of the chain-signature network: it holds a key share and adds it to a signature",
  },
  blockchain: {
    shape: "page row",
    note: "a short row of linked block pages; another chain, another page edge",
  },
  chainArea: {
    shape: "marked area",
    note: "another chain's ground on the page: a tinted area in a dashed border, its chain along the back",
  },
} as const;

export type Concept = keyof typeof OBJECTS;

/** How full a function-call key's allowance gauge is: left / initial, 0..1. */
export function gaugeShare(left: bigint | null, initial: bigint | null): number {
  if (left === null || initial === null || initial <= 0n) return 0;
  const permille = Number((left * 1000n) / initial);
  return Math.max(0, Math.min(1, permille / 1000));
}

// ---------- dimensions (world units), shared by the 3D objects and their anchors ----------

/** A mailbox: a post, a box with a round roof, a flag. `size` is about its height. */
export function mailboxDims(size: number) {
  const post = size * 0.42;
  const body = size * 0.24;
  const width = size * 0.56;
  const depth = size * 0.8;
  return {
    post,
    body,
    width,
    depth,
    /** Middle of the box part. */
    bodyY: post + body / 2,
    height: post + body + width / 2,
  };
}

/** A parcel: a box, a lid (flaps when open), a label and a stamp. */
export function parcelDims(size: number) {
  const width = size * 1.1;
  const height = size * 0.7;
  const depth = size * 0.8;
  return { width, height, depth };
}

/** A scroll standing up: a sheet between two rollers, a gear on its seal. */
export function scrollDims(size: number) {
  const height = size;
  const width = size * 0.78;
  const roller = size * 0.07;
  return { width, height, roller, gear: size * 0.12 };
}

/** An app: a screen on a small stand, a title bar across its top. */
export function screenDims(size: number) {
  const width = size * 0.9;
  const height = size * 0.62;
  const stand = size * 0.3;
  return { width, height, stand, total: stand + height };
}

/** A receipt: a small delivery slip standing up, its top right corner folded over. */
export function slipDims(size: number) {
  const width = size * 0.62;
  const height = size * 0.4;
  return { width, height, depth: size * 0.03, fold: height * 0.32 };
}

/** How deep the swallowtail notch at a ribbon's left end is cut. */
export const ribbonNotch = (length: number, width: number) => Math.min(width * 0.6, length * 0.1);

/**
 * A shard ribbon lying flat, as (x, z) points of its outline: a strip of `length` along x centred on
 * 0, `width` across, with a swallowtail notch cut into its left end (where its name goes).
 */
export function ribbonOutline(length: number, width: number): [number, number][] {
  const l = length / 2;
  const w = width / 2;
  const notch = ribbonNotch(length, width);
  return [
    [-l, -w],
    [l, -w],
    [l, w],
    [-l, w],
    [-l + notch, 0],
  ];
}

/**
 * Where the action cards stand when a parcel is open: a column above the box, the first action on top.
 * Offsets from the parcel's top middle. At most `max` cards (the lesson shows "+n more").
 */
export function itemSlots(count: number, max: number, gap = 0.4): { y: number; z: number }[] {
  const n = Math.min(count, max);
  return Array.from({ length: n }, (_, i) => ({ y: 0.75 + (n - 1 - i) * gap, z: 0.02 * i }));
}

/** A signing node: a small figure behind a desk, its key share lying on the desk. `size` is about its height. */
export function signerNodeDims(size: number) {
  const desk = { width: size * 0.7, height: size * 0.3, depth: size * 0.36 };
  const body = { radius: size * 0.13, height: size * 0.44 };
  const head = size * 0.12;
  return { desk, body, head, height: body.height + head * 2, share: [size * 0.26, size * 0.18] as const };
}

/** A blockchain: `pages` block pages standing in a row, linked by a string. `size` is about a page's height. */
export function ledgerDims(size: number, pages: number) {
  const width = size * 0.66;
  const gap = size * 0.24;
  const pitch = width + gap;
  return {
    width,
    height: size,
    depth: 0.04,
    pitch,
    length: pages * width + (pages - 1) * gap,
    edge: size * 0.14,
  };
}
