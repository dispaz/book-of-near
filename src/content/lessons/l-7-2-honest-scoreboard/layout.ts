/**
 * Where things stand in lesson 7.2 (world units, y up, z toward the reader), on the right page of the
 * book: four chain pillars along the back (NEAR, Ethereum, Solana, Cosmos) and the four dimension cards
 * lying in front of them. The 2D view draws the same row from the front. Pure.
 */
import { COLORS } from "../../../scene-kit/theme";
import type { ChainId, DimId } from "./board";

/** The ground box (x, z) that holds every step's objects and labels. */
export const FIGURE = { minX: -4.1, maxX: 4.1, minZ: -1.4, maxZ: 2.2 } as const;

export const PILLAR_X: Record<ChainId, number> = { near: -3, ethereum: -1, solana: 1, cosmos: 3 };
export const PILLAR_Z = -0.6;
export const PILLAR_W = 0.9;

export const CARD_X: Record<DimId, number> = { accounts: -3, scaling: -1, execution: 1, liquidity: 3 };
export const CARD_Z = 1.45;
export const CARD = { width: 1.6, depth: 0.95, thick: 0.08 } as const;

/** Each chain's colour (both views). NEAR is NEAR green, as its coins are. */
export const CHAIN_COLOR: Record<ChainId, string> = {
  near: COLORS.near,
  ethereum: COLORS.violet,
  solana: COLORS.cerulean,
  cosmos: COLORS.blue,
};
