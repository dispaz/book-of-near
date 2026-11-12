/**
 * Where things stand in lesson 3.3's figure (world units, y up), on the right page of the book. The 2D
 * view draws the same layout, so both views agree. Pure: no three.js, unit tested.
 */
import type { RpcEndpointId } from "../../../chain/rpcEndpoints";
import type { Vec3 } from "../../../scene-kit/motion";
import { ARCHIVE } from "./steps";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.3, maxX: 4.3, minZ: -2.0, maxZ: 2.7 } as const;

/** The counter windows, in a row at the back of the page. The archival one shows at the archive step. */
export const WINDOWS: Record<RpcEndpointId, Vec3> = {
  fastnear: [-3.3, 0, -0.9],
  "near-org": [-1.1, 0, -0.9],
  "fastnear-2": [1.1, 0, -0.9],
  archival: [3.3, 0, -0.9],
};
/** Short names printed on the figure (the facts panel and the pick labels use the full names). */
export const LABELS: Record<RpcEndpointId, string> = {
  fastnear: "FastNEAR",
  "near-org": "Foundation",
  "fastnear-2": "FastNEAR 2",
  archival: "Archival",
};
/** The latency bar stands just right of its window; it is at most this tall (below the names). */
export const BAR = { dx: 0.8, maxHeight: 1.4, width: 0.22 };
/** Where a window's status tag (offline, answered, not found) lies on the page, in front of it. */
export const TAG_DZ = 0.95;
/** The learner's mailbox (their app), at the front. */
export const MAILBOX: Vec3 = [0, 0, 1.7];

export type Part = "windows" | "bars" | "archive" | "mailbox";

/** Which windows a step draws. */
export function windowsAt(step: number): RpcEndpointId[] {
  const regular: RpcEndpointId[] = ["fastnear", "near-org", "fastnear-2"];
  return step === ARCHIVE ? [...regular, "archival"] : regular;
}

/** Ground boxes [minX, maxX, minZ, maxZ, height] of each part, for framing and tour shots. */
export function boxOf(part: Part): [number, number, number, number, number] {
  switch (part) {
    case "windows":
      return [WINDOWS.fastnear[0] - 0.8, WINDOWS["fastnear-2"][0] + 1.1, -1.6, -0.1, 2.4];
    case "bars":
      return [WINDOWS.fastnear[0] - 0.2, WINDOWS["fastnear-2"][0] + 1.2, -1.3, -0.4, BAR.maxHeight + 0.6];
    case "archive":
      return [WINDOWS.fastnear[0] - 0.8, WINDOWS.archival[0] + 1.0, -1.6, -0.1, 2.4];
    case "mailbox":
      return [MAILBOX[0] - 0.9, MAILBOX[0] + 0.9, MAILBOX[2] - 0.6, MAILBOX[2] + 0.8, 2.2];
  }
}

/** Which parts a step frames. */
export function partsAt(step: number): Part[] {
  return step === ARCHIVE ? ["archive", "mailbox"] : ["windows", "bars", "mailbox"];
}
