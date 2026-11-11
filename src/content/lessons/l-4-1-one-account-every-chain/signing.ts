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

/**
 * Nodes lit at a moment: none before the request reaches the signer, more as it waits (never the whole
 * threshold, which only the real answer brings), all of them once the signature is back.
 */
export function sharesLit(phase: SignPhase, elapsedMs: number, expectedMs = EXPECTED_MS): number {
  if (phase === "answered") return NODES;
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
