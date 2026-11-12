/**
 * Where things stand in the 3D view of lesson 1.2 (world units; y is up). Pure, so it is unit tested and
 * never pulls three.js into the 2D view.
 *
 * The Counter app (a screen) with its key on a tag; your account (a mailbox) with your full-access key, and
 * the counter contract on it (a scroll); the attacker's mailbox and another contract (the testnet
 * registrar). Each try is a stamped parcel that goes to what it aims at.
 *
 * Two arrangements. In a wide window the five places stand in one row, left to right. In a tall or square
 * window (phones) one row would be drawn tiny, so they stand in two rows: your account, its counter and
 * the registrar at the back, the app and the attacker at the front.
 */
import { focusOf as kitFocus, type Box, type Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import type { Intent } from "./key";

/** Size the objects are drawn at. */
export const OBJ = 1.9;

export type Layout = {
  tall: boolean;
  APP: Vec3;
  HOME: Vec3;
  COUNTER: Vec3;
  THIEF: Vec3;
  OTHER: Vec3;
  /** Your full-access key, hanging in front of your mailbox. */
  MY_KEY: Vec3;
  /** The app's function-call key, in front of the app (its tag hangs below it). */
  APP_KEY: Vec3;
  /** Where the label of your key is written: above it in one row, under it in two (clear of the parcel). */
  MY_KEY_LABEL: Vec3;
  /** Where hints (the chain's reason, what a picked object is) are written: in front of everything. */
  HINT: Vec3;
  /** The box of the world kept in view; `frameCamera` fits it to the 3D window. */
  shot: Focus;
  /** Where the latest try (a stamped parcel) stands: in front of what it aimed at, or by the app. */
  parcelAt(aim: Intent | null): Vec3;
};

const box = (p: Vec3, half = 1.3): Box => [p[0] - half, p[0] + half, p[2] - 0.9, p[2] + 1.4, 3];

/** Seen from the front, aimed a little low (at the objects rather than their name tags). */
const focusOf = (boxes: Box[], elevation: number): Focus => kitFocus(boxes, elevation, 0, 0.3);

function build(tall: boolean, at: Pick<Layout, "APP" | "HOME" | "COUNTER" | "THIEF" | "OTHER">): Layout {
  const { APP, HOME, COUNTER, THIEF, OTHER } = at;
  const MY_KEY: Vec3 = [HOME[0] + (tall ? -0.3 : 0.2), 0.55, HOME[2] + 1.3];
  const APP_KEY: Vec3 = [APP[0] + 1.2, 1.1, APP[2] + 0.9];
  const MY_KEY_LABEL: Vec3 = tall
    ? [MY_KEY[0], 0.05, MY_KEY[2] + 0.55]
    : [MY_KEY[0], MY_KEY[1] + 0.6, MY_KEY[2]];
  const front = Math.max(APP[2], THIEF[2]);
  const HINT: Vec3 = [tall ? 0 : 0.6, 0.05, front + (tall ? 3.0 : 1.9)];
  const all = [box(APP), box(HOME), box(COUNTER), box(THIEF), box(OTHER)];
  // In two rows, keep the hint's strip in view too (one row already leaves room in front).
  const hint: Box = [HINT[0] - 1.5, HINT[0] + 1.5, HINT[2] - 0.3, HINT[2] + 0.5, 0.2];
  const shot = tall ? focusOf([...all, hint], 58) : focusOf(all, 36);
  const before = (p: Vec3): Vec3 => [p[0] - 0.2, 0, p[2] + 1.0];
  return {
    tall,
    ...at,
    MY_KEY,
    MY_KEY_LABEL,
    APP_KEY,
    HINT,
    shot,
    parcelAt(aim) {
      switch (aim) {
        case "count":
          return before(COUNTER);
        case "send":
          return before(THIEF);
        case "other":
          return before(OTHER);
        case "addkey":
          // Beside your mailbox, clear of your key in front of it (to the right in one row, between it and the
          // counter in two, where its label stays inside a narrow window).
          return tall ? [HOME[0] + 1.3, 0, HOME[2] + 0.3] : [HOME[0] + 0.9, 0, HOME[2] + 1.0];
        default:
          return [APP[0] + 0.9, 0, APP[2] + 1.0];
      }
    },
  };
}

const ONE_ROW = build(false, {
  APP: [-4.2, 0, 0.9],
  HOME: [-1.0, 0, 0],
  COUNTER: [0.9, 0, -0.5],
  THIEF: [4.6, 0, 1.4],
  OTHER: [3.3, 0, -2.0],
});

const TWO_ROWS = build(true, {
  HOME: [-2.6, 0, -1.4],
  COUNTER: [0, 0, -1.6],
  OTHER: [2.6, 0, -1.4],
  APP: [-2.6, 0, 2.5],
  THIEF: [2.4, 0, 2.5],
});

export function layout(tall: boolean): Layout {
  return tall ? TWO_ROWS : ONE_ROW;
}

/**
 * The arrangement for a 3D window of `width` x `height` pixels: two rows when it is no more than a little
 * wider than tall; short labels when it is narrow, and short names too when it is narrower still (the names
 * of neighbours would touch).
 */
export function layoutFor(
  width: number,
  height: number,
): Layout & { shortLabels: boolean; shortNames: boolean } {
  const tall = width < height * 1.25;
  return { ...layout(tall), shortLabels: width < 820, shortNames: width < 640 };
}
