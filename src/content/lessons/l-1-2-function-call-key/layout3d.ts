/**
 * Where things stand in the 3D view of lesson 1.2 (world units; y is up). Pure, so it is unit tested and
 * never pulls three.js into the 2D view.
 */
import { focusOf as kitFocus, type Box, type Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import type { Intent } from "./key";

export const SIZE = 1.5;
export const AGENT: Vec3 = [-3.6, 0, 1.4];
export const HOME: Vec3 = [-0.2, 0, 0.4];
export const THIEF: Vec3 = [3.6, 0, 2.2];
export const OTHER: Vec3 = [3.6, 0, -1.6];

const box = (p: Vec3, half = 1.3): Box => [p[0] - half, p[0] + half, p[2] - 0.9, p[2] + 1.2, 3];
const ALL = [box(AGENT), box(HOME), box(THIEF), box(OTHER)];

/** Seen from the front, aimed a little low (at the blocks rather than their name tags). */
const focusOf = (boxes: Box[], elevation: number): Focus => kitFocus(boxes, elevation, 0, 0.3);

/** The box of the world kept in view; `frameCamera` fits it to the 3D window. Phones look down more. */
export function shot(phone: boolean): Focus {
  return focusOf(ALL, phone ? 55 : 38);
}

/** Where the agent's key rests: with the agent, or at the thing it just tried to reach. */
export function keyAt(aim: Intent | null): Vec3 {
  const up = SIZE + 0.35;
  switch (aim) {
    case "send":
      return [THIEF[0], up, THIEF[2]];
    case "other":
      return [OTHER[0], up, OTHER[2]];
    case "count":
    case "addkey":
      return [HOME[0], up, HOME[2] + 0.9];
    default:
      return [AGENT[0] + 1.1, 1.1, AGENT[2] + 0.2];
  }
}

export const POINTS = { AGENT, HOME, THIEF, OTHER };
