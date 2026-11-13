/**
 * Where things stand in lesson 5.2 (world units, y up, z toward the reader), on the right page of the
 * book. Left: the developer's laptop (with the bot's .env) at the back and the developer's key in front.
 * Middle: the agent's enclave in front, the agent contract (a scroll) at the back. Right: the signing
 * network (three nodes) at the back and the contract's Ethereum address (a mailbox) in front. The 2D
 * view draws the same plan from above. Pure.
 */
import type { Vec3 } from "../../../scene-kit/motion";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.4, maxX: 4.4, minZ: -2.5, maxZ: 2.3 } as const;

export const LAPTOP: Vec3 = [-3.3, 0, -1.1];
export const KEY: Vec3 = [-2.9, 0, 1.3];
export const ENCLAVE: Vec3 = [-0.5, 0, 0.8];
export const CONTRACT: Vec3 = [1.0, 0, -1.3];
export const SIGNER: Vec3 = [3.2, 0, -1.2];
export const ETH: Vec3 = [3.1, 0, 1.3];

/** The three signing nodes, around SIGNER. */
export const NODES: Vec3[] = [
  [SIGNER[0] - 0.7, 0, SIGNER[2] + 0.2],
  [SIGNER[0], 0, SIGNER[2] - 0.4],
  [SIGNER[0] + 0.7, 0, SIGNER[2] + 0.2],
];

/** The agent's signing request (a parcel): in the enclave, at the contract, then at the signer. */
export const REQUEST_AT = {
  home: [ENCLAVE[0] + 0.9, 0, ENCLAVE[2] + 0.6] as Vec3,
  contract: [CONTRACT[0] + 0.9, 0, CONTRACT[2] + 0.7] as Vec3,
  signer: [SIGNER[0] - 1.0, 0, SIGNER[2] + 1.0] as Vec3,
};
