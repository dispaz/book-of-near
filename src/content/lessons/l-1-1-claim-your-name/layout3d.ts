/**
 * Where things stand in lesson 1.1's figure, on the right page of the book (world units; y is up). Pure,
 * so it is unit tested and never pulls three.js into the 2D view.
 *
 * Steps 1 to 4 (and the check) show a row: you, the registrar, the new account. The compare step shows
 * only the named account and its hex twin, side by side.
 */
import type { Box } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import { mailboxDims, scrollDims } from "../../../scene-kit/objects";
import { COMPARE, HOOK } from "./useClaim";

/** The size every object is drawn at. */
export const OBJ = 1.75;
export const ME: Vec3 = [-3.1, 0, 0];
export const REGISTRAR: Vec3 = [0, 0, 0];
export const NEW_ACCOUNT: Vec3 = [3.1, 0, 0];
/** Compare step: the named account and the account the same key would have as a hex id. */
export const NAMED: Vec3 = [-2, 0, 0];
export const HEX: Vec3 = [2, 0, 0];

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.6, maxX: 4.6, minZ: -1.2, maxZ: 2.2 } as const;

export type Part = "me" | "registrar" | "new" | "named" | "hex";

const AT: Record<Part, Vec3> = { me: ME, registrar: REGISTRAR, new: NEW_ACCOUNT, named: NAMED, hex: HEX };

/** Which parts a step draws. */
export function partsAt(step: number): Part[] {
  if (step === HOOK) return ["me"];
  if (step === COMPARE) return ["named", "hex"];
  return ["me", "registrar", "new"];
}

/** Each object with the labels around it: [minX, maxX, minZ, maxZ, height]. Name tags in front. */
export function boxOf(part: Part): Box {
  const [x, , z] = AT[part];
  return [x - 1.4, x + 1.4, z - 0.8, z + 1.9, 2.6];
}

type Sending = { busy: boolean; created: boolean };

const BESIDE = mailboxDims(OBJ).width / 2 + 0.45;
const SCROLL_TOP = scrollDims(OBJ).height;

/** The create transaction, a stamped parcel on the ground: beside your mailbox, then at the registrar. */
export function parcelAt({ busy, created }: Sending): Vec3 {
  return busy || created
    ? [REGISTRAR[0] - 0.95, 0, REGISTRAR[2] + 0.75]
    : [ME[0] + BESIDE + 0.1, 0, ME[2] - 0.35];
}

/** The 0.1 NEAR deposit: over the registrar while it works, then on the ground by the new mailbox. */
export function coinAt({ busy, created }: Sending): Vec3 | null {
  if (created) return [NEW_ACCOUNT[0] + BESIDE, 0.07, NEW_ACCOUNT[2] + 0.5];
  if (busy) return [REGISTRAR[0], SCROLL_TOP + 0.25, REGISTRAR[2]];
  return null;
}
