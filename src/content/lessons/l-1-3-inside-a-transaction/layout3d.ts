/**
 * Where things stand in the 3D view of lesson 1.3 (world units; y is up). Pure, so it is unit tested and
 * never pulls three.js into the 2D view.
 *
 * Left: the signer (the practice account at step 2, the workshop account after), a mailbox. Right: the
 * receiver (the `testnet` registrar, a scroll, at step 2; the new sub-account, a mailbox, after). Back
 * right: the account the step makes. The transaction is an open parcel with its action cards above it; it
 * hops from the signer to the receiver when it is sent.
 */
import { focusOf as kitFocus, type Box, type Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import { itemSlots, parcelDims } from "../../../scene-kit/objects";

export const SIZE = 1.4;
/** The size the account and contract objects are drawn at (slimmer than the old blocks). */
export const OBJ = SIZE * 1.35;
export const SIGNER: Vec3 = [-3.4, 0, 0.6];
export const RECEIVER: Vec3 = [3.4, 0, 0.6];
export const MADE: Vec3 = [-1.0, 0, -3.4];
/** The transaction parcel's size, and the most action cards shown above it ("+n more" after). */
export const PARCEL = 1.7;
export const MAX_ITEMS = 5;

const ACCOUNT = (p: Vec3): Box => [p[0] - 1.3, p[0] + 1.3, p[2] - 0.8, p[2] + 1.2, 2.6];
const PARCEL_HEIGHT = parcelDims(PARCEL).height + itemSlots(MAX_ITEMS, MAX_ITEMS)[0]!.y + 0.45;
const STACK: Box = [-2, 2.4, 1.2, 3, PARCEL_HEIGHT];

/** Seen from the front, aimed a little low (at the objects rather than their name tags). */
const focusOf = (boxes: Box[], elevation: number): Focus => kitFocus(boxes, elevation, 0, 0.3);

/** The box of the world kept in view; `frameCamera` fits it to the 3D window. Phones look down more. */
export function shot(phone: boolean): Focus {
  return focusOf([ACCOUNT(SIGNER), ACCOUNT(RECEIVER), ACCOUNT(MADE), STACK], phone ? 55 : 36);
}

/** Where the transaction parcel stands: in front of the signer while it is packed, near the receiver once sent. */
export function parcelAt(sent: boolean): Vec3 {
  return sent ? [0.9, 0, 2.1] : [-0.6, 0, 2.1];
}
