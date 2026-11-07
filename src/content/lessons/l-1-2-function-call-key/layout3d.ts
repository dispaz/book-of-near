/**
 * Where things stand in the 3D view of lesson 1.2 (world units; y is up). Pure, so it is unit tested and
 * never pulls three.js into the 2D view.
 *
 * Left: the Counter app (a screen) with its key on a tag. Middle: your account (a mailbox) with your
 * full-access key, and the counter contract on it (a scroll). Right: the attacker's mailbox and another
 * contract (the testnet registrar). Each try is a stamped parcel that goes to what it aims at.
 */
import { focusOf as kitFocus, type Box, type Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import type { Intent } from "./key";

/** Size the objects are drawn at. */
export const OBJ = 1.9;
export const APP: Vec3 = [-4.2, 0, 0.9];
export const HOME: Vec3 = [-1.0, 0, 0];
export const COUNTER: Vec3 = [0.9, 0, -0.5];
export const THIEF: Vec3 = [4.6, 0, 1.4];
export const OTHER: Vec3 = [2.9, 0, -2.0];
/** Your full-access key, hanging in front of your mailbox. */
export const MY_KEY: Vec3 = [HOME[0] + 0.2, 0.55, HOME[2] + 1.3];
/** The app's function-call key, in front of the app (its tag hangs below it). */
export const APP_KEY: Vec3 = [APP[0] + 1.2, 1.1, APP[2] + 0.9];

const box = (p: Vec3, half = 1.3): Box => [p[0] - half, p[0] + half, p[2] - 0.9, p[2] + 1.4, 3];
const ALL = [box(APP), box(HOME), box(COUNTER), box(THIEF), box(OTHER)];

/** Seen from the front, aimed a little low (at the objects rather than their name tags). */
const focusOf = (boxes: Box[], elevation: number): Focus => kitFocus(boxes, elevation, 0, 0.3);

/** The box of the world kept in view; `frameCamera` fits it to the 3D window. Phones look down more. */
export function shot(phone: boolean): Focus {
  return focusOf(ALL, phone ? 55 : 36);
}

/** Where the latest try (a stamped parcel) stands: in front of what it aimed at, or by the app. */
export function parcelAt(aim: Intent | null): Vec3 {
  const front = (p: Vec3): Vec3 => [p[0] - 0.2, 0, p[2] + 1.0];
  switch (aim) {
    case "count":
      return front(COUNTER);
    case "send":
      return front(THIEF);
    case "other":
      return front(OTHER);
    case "addkey":
      // To the right of your mailbox, clear of your key in front of it.
      return [HOME[0] + 0.9, 0, HOME[2] + 1.0];
    default:
      return [APP[0] + 0.9, 0, APP[2] + 1.0];
  }
}
