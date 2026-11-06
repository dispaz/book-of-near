/**
 * Where things stand in the 3D view of lesson 1.3 (world units; y is up). Pure, so it is unit tested and
 * never pulls three.js into the 2D view.
 *
 * Left: the signer (the practice account at step 2, the workshop account after). Right: the receiver
 * (the `testnet` registrar at step 2, the new sub-account after). Back right: the account the step makes
 * (the workshop account at step 2, the rolled-back one at step 4). The transaction is a stack of action
 * slabs that hops from the signer to the receiver when it is sent.
 */
import { focusOf as kitFocus, type Box, type Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";

export const SIZE = 1.4;
export const SIGNER: Vec3 = [-3.4, 0, 0.6];
export const RECEIVER: Vec3 = [3.4, 0, 0.6];
export const MADE: Vec3 = [3.4, 0, -2.6];
/** Slab size of one action in the stack. */
export const SLAB = { w: 2.4, h: 0.4, d: 1.1 } as const;
export const MAX_SLABS = 6;

const ACCOUNT = (p: Vec3): Box => [p[0] - 1.3, p[0] + 1.3, p[2] - 0.8, p[2] + 1.2, 2.6];
const STACK: Box = [-2, 2.4, 1.2, 3, (SLAB.h + 0.06) * MAX_SLABS + 0.8];

/** Seen from the front, aimed a little low (at the blocks rather than their name tags). */
const focusOf = (boxes: Box[], elevation: number): Focus => kitFocus(boxes, elevation, 0, 0.3);

/** The box of the world kept in view; `frameCamera` fits it to the 3D window. Phones look down more. */
export function shot(phone: boolean): Focus {
  return focusOf([ACCOUNT(SIGNER), ACCOUNT(RECEIVER), ACCOUNT(MADE), STACK], phone ? 55 : 36);
}

/** Where the transaction stack stands: in front of the signer while it is built, near the receiver once sent. */
export function stackAt(sent: boolean): Vec3 {
  return sent ? [0.9, 0, 2.1] : [-0.6, 0, 2.1];
}

/** Height of slab `i` (0 = the first action, on top, because the list is read from the top). */
export function slabY(i: number, count: number): number {
  const n = Math.min(count, MAX_SLABS);
  return (n - 1 - Math.min(i, MAX_SLABS - 1)) * (SLAB.h + 0.06) + SLAB.h / 2;
}
