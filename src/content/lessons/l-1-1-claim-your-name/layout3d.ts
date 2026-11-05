/**
 * Where things stand in the 3D view of lesson 1.1, and what the camera frames at each step (world
 * units; y is up). Pure, so it is unit tested and never pulls three.js into the 2D view.
 *
 * Steps 1 to 4 show a row: you, the registrar, the new account. The compare step shows only the
 * named account and its hex twin, side by side.
 */
import { focusOf as kitFocus, type Box, type Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import { COMPARE, HOOK } from "./useClaim";

export const SIZE = 1.3;
export const ME: Vec3 = [-3.1, 0, 0];
export const REGISTRAR: Vec3 = [0, 0, 0];
export const NEW_ACCOUNT: Vec3 = [3.1, 0, 0];
/** Compare step: the named account and the account the same key would have as a hex id. */
export const NAMED: Vec3 = [-2, 0, 0];
export const HEX: Vec3 = [2, 0, 0];

// Each block with the labels around it. Name tags in front are wider than the block (about 2.6 units).
const box = (p: Vec3): Box => [p[0] - 1.4, p[0] + 1.4, p[2] - 0.8, p[2] + 1.3, 2.6];

/** Seen from the front, aimed a little low, at the blocks rather than their tags. */
const focusOf = (boxes: Box[], elevation: number): Focus => kitFocus(boxes, elevation, 0, 0.3);

export function shotFor(step: number, phone: boolean): Focus {
  const elevation = phone ? 52 : 36;
  if (step === HOOK) return focusOf([box(ME)], elevation);
  if (step === COMPARE) return focusOf([box(NAMED), box(HEX)], elevation);
  return focusOf([box(ME), box(REGISTRAR), box(NEW_ACCOUNT)], elevation);
}
