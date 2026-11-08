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

/**
 * A shard ribbon lying flat, as (x, z) points of its outline: a strip of `length` along x centred on
 * 0, `width` across, with a swallowtail notch cut into its left end (where its name goes).
 */
export function ribbonOutline(length: number, width: number): [number, number][] {
  const l = length / 2;
  const w = width / 2;
  const notch = Math.min(width * 0.6, length * 0.1);
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
