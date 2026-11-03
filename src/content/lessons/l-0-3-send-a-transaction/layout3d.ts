/**
 * Where things stand in the 3D view of lesson 0.3, and what the camera frames at each step (world
 * units; y is up). Pure, so it is unit tested and never pulls three.js into the 2D view.
 */
import type { Focus } from "../../../scene-kit/framing";
import type { Vec3 } from "../../../scene-kit/motion";
import { BUILD, FEE, SEND, SIGN } from "./useTransaction";

export const ACCT = 1.3;
export const SENDER: Vec3 = [-2.6, 0, 2];
export const RECEIVER: Vec3 = [2.6, 0, 2];
export const DESK: Vec3 = [-1.6, 0, -0.1];
export const NODE: Vec3 = [0.5, 0, -0.3];
export const NODE_H = 1.6;
export const CHAIN_Z = -3;
export const CUBE = 0.9;
export const GAP = 1.25;
export const OLD_BLOCKS = [-2.5, -1.25, 0, 1.25];
export const NEW_BLOCK: Vec3 = [2.5, 0, CHAIN_Z];

/** A box of the paper: x from..to, z from..to, and how tall it is with its labels. */
type Box = [minX: number, maxX: number, minZ: number, maxZ: number, height: number];

// Each object with the labels around it (names in front, balances and hints above).
// An account's name tag in front is wider than the block (about 2.4 units).
const ACCOUNT_BOX = (p: Vec3): Box => [p[0] - 1.2, p[0] + 1.2, p[2] - 0.7, p[2] + 1.2, 2];
const DESK_BOX: Box = [DESK[0] - 1.45, DESK[0] + 1.35, DESK[2] - 1, DESK[2] + 1, 1.9];
const NODE_BOX: Box = [NODE[0] - 0.6, NODE[0] + 0.6, NODE[2] - 0.6, NODE[2] + 1, NODE_H + 0.3];
const CHAIN_BOX: Box = [OLD_BLOCKS[0]! - 0.6, NEW_BLOCK[0] + 0.6, CHAIN_Z - 0.6, CHAIN_Z + 1.1, 2.6];
const ALL = [ACCOUNT_BOX(SENDER), ACCOUNT_BOX(RECEIVER), DESK_BOX, NODE_BOX, CHAIN_BOX];

function focusOf(boxes: Box[], elevation: number): Focus {
  const minX = Math.min(...boxes.map((b) => b[0]));
  const maxX = Math.max(...boxes.map((b) => b[1]));
  const minZ = Math.min(...boxes.map((b) => b[2]));
  const maxZ = Math.max(...boxes.map((b) => b[3]));
  const h = Math.max(...boxes.map((b) => b[4]));
  return {
    center: [(minX + maxX) / 2, h * 0.3, (minZ + maxZ) / 2],
    width: maxX - minX,
    depth: maxZ - minZ,
    height: h,
    elevation,
  };
}

/**
 * The box of the world each step keeps in view; `frameCamera` fits it into the 3D window, whatever
 * its size. Phones' small, short windows look down more steeply and frame only the step's own objects:
 * the desk while building and signing, the node and the chain while sending.
 */
export function shotFor(step: number, phone: boolean): Focus {
  if (step === BUILD || step === FEE || step === SIGN)
    return phone ? focusOf([DESK_BOX], 50) : focusOf([ACCOUNT_BOX(SENDER), DESK_BOX], 43);
  if (step === SEND && phone) return focusOf([NODE_BOX, CHAIN_BOX], 50);
  return focusOf(ALL, phone ? 55 : 37);
}
