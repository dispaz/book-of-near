/**
 * Where things stand in lesson 5.1 (world units, y up, z toward the reader), on the right page of the
 * book. Left: your terminal. Middle: an ordinary cloud server at the back, the sealed enclave in front,
 * and root access (a key) between them. Right: the attestation quote (a slip) and Intel's root
 * certificate (a seal). The 2D view draws the same plan from above. Pure.
 */
import type { Vec3 } from "../../../scene-kit/motion";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.4, maxX: 4.4, minZ: -2.5, maxZ: 2.3 } as const;

export const TERMINAL: Vec3 = [-3.3, 0, 0.5];
export const SERVER: Vec3 = [-0.7, 0, -1.4];
export const ENCLAVE: Vec3 = [0.5, 0, 1.0];
export const ROOT: Vec3 = [1.7, 0, -1.7];
export const QUOTE: Vec3 = [2.75, 0, 1.25];
export const SEAL: Vec3 = [3.4, 0, -1.0];

/** Your prompt (a parcel): by your terminal, then sealed inside the enclave. */
export const PROMPT_AT = {
  home: [-2.2, 0, 1.4] as Vec3,
  enclave: [ENCLAVE[0] - 1.6, 0, ENCLAVE[2] + 0.5] as Vec3,
};
