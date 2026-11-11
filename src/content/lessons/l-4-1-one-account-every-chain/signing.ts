/**
 * Pure helpers for lesson 4.1: how far the signing nodes have got while the request waits, the path
 * rules and short forms for long ids. No React, no three.js, so both views and the tests share them.
 */

/** Signing nodes drawn round the signer contract. An illustration: the real network's size differs. */
export const NODES = 8;
/** Shares the drawing needs before the signature is whole (k of n). Also illustrative. */
export const THRESHOLD = 6;
/** About how long the signing network takes (spike 5: about 5.5 s). */
export const EXPECTED_MS = 5500;

export type SignPhase = "idle" | "sending" | "waiting" | "answered" | "failed";

/** The request is out and the answer is not back yet. */
export const isWaiting = (phase: SignPhase) => phase === "sending" || phase === "waiting";

/** Seconds left of the usual wait, for the countdown (0 once it runs over). */
export const secondsLeft = (elapsedMs: number, expectedMs = EXPECTED_MS) =>
  Math.max(0, Math.ceil((expectedMs - elapsedMs) / 1000));

/**
 * Nodes lit at a moment: none before the request reaches the signer, more as it waits (never the whole
 * threshold, which only the real answer brings), the threshold once the signature is back.
 */
export function sharesLit(phase: SignPhase, elapsedMs: number, expectedMs = EXPECTED_MS): number {
  // The answer means enough shares agreed: the threshold, not every node.
  if (phase === "answered") return THRESHOLD;
  if (phase !== "waiting") return 0;
  const share = Math.floor((elapsedMs / expectedMs) * THRESHOLD);
  return Math.max(0, Math.min(THRESHOLD - 1, share));
}

/** A derivation path is any label up to 64 characters. */
export function cleanPath(text: string): { ok: true; path: string } | { ok: false; why: string } {
  const path = text.trim();
  if (!path) return { ok: false, why: "Type a path, for example ethereum-1." };
  if (path.length > 64) return { ok: false, why: "Keep the path to 64 characters or fewer." };
  return { ok: true, path };
}

/** `0x2F9e15…1280`. */
export const shortHex = (h: string, head = 8, tail = 4) =>
  h.length > head + tail + 1 ? `${h.slice(0, head)}…${h.slice(-tail)}` : h;

/** A 64-hex implicit account id is shortened; a named account is kept whole. */
export const shortName = (id: string) =>
  /^[0-9a-f]{64}$/.test(id) ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;

/**
 * After the answer comes back, the figure plays a short finale before it settles: "shares" (the last
 * shares fly in, up to the threshold), then "sealed" (a flash, and the r, s and v slips form on the
 * parcel), then null (the parcel comes home with them). Never under reduced motion.
 */
export type Finale = "shares" | "sealed" | null;
/** How long the last shares take to fly in, then how long the sealed parcel stays in the ring (ms). */
export const FINALE_MS = { shares: 800, sealed: 700 } as const;

/**
 * What the signing figure is doing, for both views and the tests (`data-sign-anim`): the parcel
 * travels to the signer, the nodes work, the last shares fly in, the signature is sealed, done.
 */
export type SignAnim = "idle" | "travel" | "work" | "shares" | "sealed" | "done";

export function signAnim(phase: SignPhase, finale: Finale): SignAnim {
  if (phase === "sending") return "travel";
  if (phase === "waiting") return "work";
  if (phase === "answered") return finale ?? "done";
  return "idle";
}

/** Shares gathered at the signer: the lit ones while waiting, the threshold's once the answer is in. */
export const sharesIn = (anim: SignAnim, lit: number) =>
  anim === "work" ? lit : anim === "shares" ? THRESHOLD : 0;

/** The r, s and v slips are on the parcel once the signature is sealed. */
export const slipsShown = (anim: SignAnim) => anim === "sealed" || anim === "done";

/** Where the parcel is: by your NEAR mailbox, in the ring while it is signed, or delivered to Ethereum. */
export type ParcelSpot = "near" | "signer" | "ethereum";

/** The parcel waits in the ring from the request until the finale is over; at step 5 it is delivered. */
export function parcelSpot(anim: SignAnim, signing: boolean, delivered: boolean): ParcelSpot {
  if (delivered) return "ethereum";
  if (signing && anim !== "idle" && anim !== "done") return "signer";
  return "near";
}
